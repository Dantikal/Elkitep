from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from .models import User, TrainingTopic, TrainingMaterial

class TrainingTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', email='admin@test.com', study_number='a', is_superuser=True)
        self.user = User.objects.create_user(username='user', email='user@test.com', study_number='u', status='approved')
    def test_permissions_and_content(self):
        route = '/api/auth/training/2026/months/12/topics/'
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(route, {'title': 'Topic'}).status_code, 403)
        self.client.force_authenticate(self.admin)
        response = self.client.post(route, {'title': 'Topic'})
        self.assertEqual(response.status_code, 201)
        topic_id = response.data['id']
        materials = f'/api/auth/training/topics/{topic_id}/materials/'
        response = self.client.post(materials, {'text': 'Text', 'links': ['https://example.com']}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.post(materials, {'text': '', 'links': []}, format='json').status_code, 400)
        self.assertEqual(self.client.post(materials, {'links': ['javascript:alert(1)']}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/auth/training/2026/months/5/topics/', {'title': 'Invalid'}).status_code, 400)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(route).data[0]['title'], 'Topic')
        self.assertEqual(self.client.get(materials).data[0]['text'], 'Text')
        self.assertEqual(self.client.post(materials, {'text': 'Forbidden'}).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(materials).status_code, 401)
    def test_files_and_signed_download(self):
        import tempfile
        from django.test import override_settings
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            self.client.force_authenticate(self.admin)
            topic = TrainingTopic.objects.create(month=6, title='June')
            response = self.client.post(f'/api/auth/training/topics/{topic.id}/materials/', {'links': '[]', 'files': [SimpleUploadedFile('a.txt', b'content'), SimpleUploadedFile('b.txt', b'second')]}, format='multipart')
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(TrainingMaterial.objects.count(), 2)
            material_id = response.data['id']
            self.client.force_authenticate(self.user)
            response = self.client.get(f'/api/auth/training/materials/{material_id}/file-link/')
            self.assertEqual(response.status_code, 200)
            url = response.data['url']
            self.client.force_authenticate(None)
            self.assertEqual(self.client.get(url).status_code, 200)
            self.assertEqual(self.client.get(f'/api/auth/training/materials/{material_id}/file/').status_code, 403)

    def test_categories_have_separate_topics(self):
        officers = '/api/auth/training/2026/officers/months/12/topics/'
        sergeants = '/api/auth/training/2026/warrant-sergeants/months/12/topics/'
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(officers, {'title': 'Officer topic'}).status_code, 201)
        response = self.client.post(sergeants, {'title': 'Sergeant topic', 'category': 'officers'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['category'], 'warrant-sergeants')
        self.assertEqual(self.client.post('/api/auth/training/2026/invalid/months/12/topics/', {'title': 'Invalid'}).status_code, 400)
        self.client.force_authenticate(self.user)
        self.assertEqual([item['title'] for item in self.client.get(officers).data], ['Officer topic'])
        self.assertEqual([item['title'] for item in self.client.get(sergeants).data], ['Sergeant topic'])
        self.assertEqual(self.client.post(sergeants, {'title': 'Forbidden'}).status_code, 403)

    def test_independent_plan_sections_categories_and_materials(self):
        self.client.force_authenticate(self.admin)
        for category in ('officers', 'warrant-sergeants'):
            command = f'/api/auth/training/2026/sections/command/{category}/months/12/topics/'
            independent = f'/api/auth/training/2026/sections/independent/{category}/months/12/topics/'
            self.assertEqual(self.client.post(command, {'title': 'Command'}).status_code, 201)
            response = self.client.post(independent, {'title': f'Independent {category}', 'section': 'command'})
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data['section'], 'independent')
            materials = f"/api/auth/training/topics/{response.data['id']}/materials/"
            self.assertEqual(self.client.post(materials, {'text': f'Material {category}', 'links': ['https://example.com']}, format='json').status_code, 201)
            self.client.force_authenticate(self.user)
            self.assertEqual([item['title'] for item in self.client.get(command).data], ['Command'])
            self.assertEqual([item['title'] for item in self.client.get(independent).data], [f'Independent {category}'])
            self.assertEqual(self.client.get(materials).data[0]['text'], f'Material {category}')
            self.assertEqual(self.client.post(independent, {'title': 'Forbidden'}).status_code, 403)
            self.assertEqual(self.client.post(materials, {'text': 'Forbidden'}).status_code, 403)
            self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post('/api/auth/training/2026/sections/invalid/officers/months/12/topics/', {'title': 'Invalid'}).status_code, 400)
        # Earlier routes still expose the command plan only.
        response = self.client.get('/api/auth/training/2026/officers/months/12/topics/')
        self.assertEqual([item['title'] for item in response.data], ['Command'])
