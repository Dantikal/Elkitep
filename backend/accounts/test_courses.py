import tempfile
from urllib.parse import urlsplit
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase
from .models import User, CourseSection, CourseMaterial

class CourseTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', email='admin@test.com', study_number='a', is_superuser=True)
        self.user = User.objects.create_user(username='user', email='user@test.com', study_number='u', status='approved')
        self.root = '/api/auth/courses/sections/'
        self.client.force_authenticate(self.admin)

    def test_hierarchy_content_and_permissions(self):
        first = self.client.post(self.root, {'title': 'Курс'})
        self.assertEqual(first.status_code, 201)
        children = f"{self.root}{first.data['id']}/children/"
        child = self.client.post(children, {'title': 'Бөлүм', 'parent': None}, format='json')
        self.assertEqual(child.status_code, 201)
        self.assertEqual(child.data['parent'], first.data['id'])
        nested = f"{self.root}{child.data['id']}/children/"
        self.assertEqual(self.client.post(nested, {'title': 'Тема'}).status_code, 400)
        self.assertEqual(self.client.post(f"{self.root}{first.data['id']}/materials/", {'text': 'No'}, format='json').status_code, 400)
        route = f"{self.root}{child.data['id']}/materials/"
        self.assertEqual(self.client.post(route, {'text': 'Мазмун', 'links': ['https://example.com']}, format='json').status_code, 201)
        self.assertEqual(self.client.post(route, {}, format='json').status_code, 400)
        self.assertEqual(self.client.post(route, {'links': ['javascript:alert(1)']}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.root, {'title': '   '}).status_code, 400)
        self.assertEqual(self.client.get(f'{self.root}9999/children/').status_code, 404)
        self.client.force_authenticate(self.user)
        self.assertEqual([s['title'] for s in self.client.get(self.root).data], ['Курс'])
        self.assertEqual(self.client.get(children).data[0]['title'], 'Бөлүм')
        self.assertEqual(self.client.get(route).data[0]['text'], 'Мазмун')
        self.assertEqual(self.client.get(f"{self.root}{first.data['id']}/materials/").data, [])
        for url, data in ((self.root, {'title': 'No'}), (children, {'title': 'No'}), (route, {'text': 'No'})):
            self.assertEqual(self.client.post(url, data).status_code, 403)
        self.user.status = 'pending'; self.user.save()
        self.assertEqual(self.client.get(self.root).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.root).status_code, 401)

    def test_multiple_files_and_private_download(self):
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            parent = CourseSection.objects.create(title='Course')
            section = CourseSection.objects.create(title='Files', parent=parent)
            route = f'{self.root}{section.id}/materials/'
            response = self.client.post(route, {'text': 'Files', 'links': '[]', 'files': [SimpleUploadedFile('photo.png', b'image', 'image/png'), SimpleUploadedFile('video.mp4', b'video', 'video/mp4'), SimpleUploadedFile('doc.txt', b'document', 'text/plain')]}, format='multipart')
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(CourseMaterial.objects.filter(section=section).count(), 3)
            self.client.force_authenticate(self.user)
            items = self.client.get(route).data
            self.assertEqual([item['file_name'] for item in items], ['photo.png', 'video.mp4', 'doc.txt'])
            self.assertEqual(items[0]['text'], 'Files')
            pk = items[0]['id']
            link = self.client.get(f'/api/auth/courses/materials/{pk}/file-link/')
            self.assertEqual(link.status_code, 200)
            self.client.force_authenticate(None)
            response = self.client.get(link.data['url'])
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b''.join(response.streaming_content), b'image')
            self.assertEqual(self.client.get(f'/api/auth/courses/materials/{pk}/file/').status_code, 403)
            self.assertEqual(self.client.get(f'/api/auth/courses/materials/{pk}/file-link/').status_code, 401)
            other = items[1]['id']
            parts = urlsplit(link.data['url'])
            self.assertEqual(self.client.get(f'/api/auth/courses/materials/{other}/file/?{parts.query}').status_code, 403)


from datetime import timedelta
from django.utils import timezone
from .models import CourseEnrollment, TrainingQuiz

QUIZ = {'title': 'Тест', 'duration_seconds': 600, 'questions': [{'text': '2+2?', 'options': ['3', '4'], 'correct_index': 1}]}

class CourseHeadTests(APITestCase):
    def setUp(self):
        self.head = User.objects.create_user(username='head', email='head@gmail.com', study_number='h-1', status='approved', role='course_head')
        self.other_head = User.objects.create_user(username='head2', email='head2@gmail.com', study_number='h-2', status='approved', role='course_head')
        self.user = User.objects.create_user(username='u', email='u@gmail.com', study_number='а-543', status='approved')
        self.client.force_authenticate(self.head)

    def make_course(self):
        course = self.client.post('/api/auth/courses/sections/', {'title': 'Айдоочулардын курсу'}).data
        topic = self.client.post(f"/api/auth/courses/sections/{course['id']}/children/", {'title': 'Тема 1'}).data
        return course, topic

    def test_registration_role(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO
        from PIL import Image
        buffer = BytesIO(); Image.new('RGB', (2, 2)).save(buffer, 'PNG')
        self.client.force_authenticate(None)
        response = self.client.post('/api/auth/register/', {'email': 'new@gmail.com', 'study_number': 'n-1', 'military_unit': '2021', 'password': 'Strong-pass-123', 'training_category': 'warrant-sergeants', 'role': 'course_head', 'photo': SimpleUploadedFile('p.png', buffer.getvalue(), 'image/png')}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(User.objects.get(email='new@gmail.com').role, 'course_head')

    def test_head_creates_and_manages_only_own_course(self):
        course, topic = self.make_course()
        self.assertTrue(course['can_manage'])
        self.assertEqual(self.client.post(f"/api/auth/courses/sections/{topic['id']}/materials/", {'text': 'Мазмун'}, format='json').status_code, 201)
        self.assertEqual([c['title'] for c in self.client.get('/api/auth/courses/my/').data], ['Айдоочулардын курсу'])
        materials = self.client.get(f"/api/auth/courses/sections/{course['id']}/all-materials/").data
        self.assertEqual(materials[0]['topic_title'], 'Тема 1')
        self.client.force_authenticate(self.other_head)
        self.assertEqual(self.client.get('/api/auth/courses/my/').data, [])
        self.assertFalse(self.client.get('/api/auth/courses/sections/').data[0]['can_manage'])
        self.assertEqual(self.client.post(f"/api/auth/courses/sections/{course['id']}/children/", {'title': 'X'}).status_code, 403)
        self.assertEqual(self.client.post(f"/api/auth/courses/sections/{topic['id']}/materials/", {'text': 'X'}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(f"/api/auth/courses/sections/item/{course['id']}/", {'title': 'X'}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/auth/courses/sections/item/{topic['id']}/").status_code, 403)
        self.assertEqual(self.client.post(f"/api/auth/courses/sections/{course['id']}/quizzes/", {**QUIZ, 'deadline': (timezone.now() + timedelta(days=1)).isoformat()}, format='json').status_code, 403)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post('/api/auth/courses/sections/', {'title': 'X'}).status_code, 403)

    def test_enrollment_members_and_quiz_deadline(self):
        course, _ = self.make_course()
        quizzes = f"/api/auth/courses/sections/{course['id']}/quizzes/"
        past = {**QUIZ, 'deadline': (timezone.now() - timedelta(hours=1)).isoformat()}
        self.assertEqual(self.client.post(quizzes, past, format='json').status_code, 400)
        self.assertEqual(self.client.post(quizzes, QUIZ, format='json').status_code, 400)
        future = (timezone.now() + timedelta(days=2)).isoformat()
        self.assertEqual(self.client.post(quizzes, {**QUIZ, 'deadline': future}, format='json').status_code, 400)  # модуль милдеттүү
        self.assertEqual(self.client.post(quizzes, {**QUIZ, 'deadline': future, 'module': 3}, format='json').status_code, 400)
        created = self.client.post(quizzes, {**QUIZ, 'deadline': future, 'module': 2}, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertIsNotNone(created.data['deadline'])
        self.assertEqual(created.data['module'], 2)
        moved = self.client.patch(f"/api/auth/courses/quizzes/{created.data['id']}/", {'module': 1}, format='json')
        self.assertEqual(moved.data['module'], 1)
        self.assertEqual(self.client.patch(f"/api/auth/courses/quizzes/{created.data['id']}/", {'title': 'Тест'}, format='json').data['module'], 1)
        quiz_id = created.data['id']
        self.assertEqual(self.client.get(f'/api/auth/courses/quizzes/{quiz_id}/').data['questions'][0]['correct_index'], 1)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(quizzes).status_code, 403)
        self.assertEqual(self.client.post(f'/api/auth/training/quizzes/{quiz_id}/start/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/auth/courses/quizzes/{quiz_id}/').status_code, 403)
        self.assertEqual(self.client.post(f"/api/auth/courses/sections/{course['id']}/enroll/").status_code, 201)
        self.assertTrue(self.client.get('/api/auth/courses/sections/').data[0]['is_enrolled'])
        self.assertEqual(len(self.client.get(quizzes).data), 1)
        start = self.client.post(f'/api/auth/training/quizzes/{quiz_id}/start/')
        self.assertEqual(start.status_code, 201, start.data)
        self.client.post(f"/api/auth/training/attempts/{start.data['id']}/", {'action': 'finish'}, format='json')
        self.assertEqual(self.client.get('/api/auth/training/my-quiz-results/').data[0]['topic'], 'Айдоочулардын курсу')
        TrainingQuiz.objects.filter(pk=quiz_id).update(deadline=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.client.post(f'/api/auth/training/quizzes/{quiz_id}/start/').status_code, 400)
        self.assertEqual(self.client.get(f"/api/auth/courses/sections/{course['id']}/members/").status_code, 403)
        self.client.force_authenticate(self.head)
        members = self.client.get(f"/api/auth/courses/sections/{course['id']}/members/").data
        self.assertEqual([m['study_number'] for m in members], ['а-543'])
        self.assertEqual(self.client.post(f"/api/auth/courses/sections/{course['id']}/enroll/").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/auth/courses/sections/item/{course['id']}/").status_code, 400)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.delete(f"/api/auth/courses/sections/{course['id']}/enroll/").status_code, 204)
        self.assertFalse(CourseEnrollment.objects.exists())
