import io
import shutil
import tempfile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient
from .models import User, Achievement

MEDIA = tempfile.mkdtemp()


def png(name='photo.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (4, 4), 'red').save(buffer, 'PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


def pdf(name='diploma.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4\n%%EOF', content_type='application/pdf')


@override_settings(MEDIA_ROOT=MEDIA)
class AchievementTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.user = User.objects.create_user(username='one', email='one@test.com', study_number='1', status='approved')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = '/api/auth/achievements/'

    def test_create_with_text_photo_and_pdf(self):
        response = self.client.post(self.url, {'text': 'Биринчи орун', 'files': [png(), pdf()]}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([f['kind'] for f in response.data['files']], ['image', 'pdf'])
        listed = self.client.get(self.url).data
        self.assertEqual(listed[0]['text'], 'Биринчи орун')
        file_id = listed[0]['files'][0]['id']
        self.assertEqual(self.client.get(f'/api/auth/achievements/files/{file_id}/').status_code, 200)
        link = self.client.get(f'/api/auth/achievements/files/{file_id}/link/').data['url']
        self.assertEqual(APIClient().get(link).status_code, 200)
        self.assertEqual(APIClient().get(f'/api/auth/achievements/files/{file_id}/signed/?signature=bad').status_code, 403)

    def test_rejects_empty_and_wrong_files(self):
        self.assertEqual(self.client.post(self.url, {'text': '  '}, format='multipart').status_code, 400)
        fake = SimpleUploadedFile('virus.png', b'not an image', content_type='image/png')
        self.assertEqual(self.client.post(self.url, {'files': [fake]}, format='multipart').status_code, 400)
        exe = SimpleUploadedFile('a.exe', b'MZ...', content_type='application/octet-stream')
        self.assertEqual(self.client.post(self.url, {'files': [exe]}, format='multipart').status_code, 400)
        self.assertEqual(Achievement.objects.count(), 0)

    def test_others_cannot_see_or_delete(self):
        created = self.client.post(self.url, {'text': 'Менин', 'files': [pdf()]}, format='multipart').data
        other = User.objects.create_user(username='two', email='two@test.com', study_number='2', status='approved')
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(self.url).data, [])
        self.assertEqual(self.client.get(f"/api/auth/achievements/files/{created['files'][0]['id']}/").status_code, 404)
        self.assertEqual(self.client.delete(f"{self.url}{created['id']}/").status_code, 404)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.delete(f"{self.url}{created['id']}/").status_code, 204)
        self.assertEqual(Achievement.objects.count(), 0)

    def test_pending_and_anonymous_denied(self):
        self.user.status = 'pending'
        self.user.save()
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
