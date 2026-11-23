import io
from tempfile import TemporaryDirectory
from PIL import Image
from django.contrib.admin.sites import AdminSite
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase
from .admin import AccountAdmin
from .models import User

class ApprovalFlowTests(APITestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.settings_override = override_settings(MEDIA_ROOT=self.media.name, REST_FRAMEWORK={
            'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.TokenAuthentication'],
            'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
        })
        self.settings_override.enable()
        self.addCleanup(self.media.cleanup)
        self.addCleanup(self.settings_override.disable)
    def register(self):
        image = io.BytesIO()
        Image.new('RGB', (20, 20)).save(image, format='PNG')
        return self.client.post('/api/auth/register/', {'email': 'CADET@gmail.com', 'study_number': '123', 'military_unit': '2022', 'training_category': 'warrant-sergeants', 'password': 'Training!Strong274', 'photo': SimpleUploadedFile('photo.png', image.getvalue(), content_type='image/png')}, format='multipart')
    def test_approval_login_and_revocation(self):
        self.assertEqual(self.register().status_code, 201)
        user = User.objects.get()
        self.assertFalse(user.is_active)
        self.assertTrue(user.check_password('Training!Strong274'))
        credentials = {'email': 'cadet@gmail.com', 'password': 'Training!Strong274'}
        self.assertEqual(self.client.post('/api/auth/login/', credentials).status_code, 401)
        admin = AccountAdmin(User, AdminSite())
        admin.approve(None, User.objects.all())
        login = self.client.post('/api/auth/login/', credentials)
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.data['user']['training_category'], 'warrant-sergeants')
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + login.data['token'])
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)
        admin.reject(None, User.objects.all())
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
    def test_duplicate_and_private_profile(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.assertEqual(self.client.get('/api/auth/photo/').status_code, 401)
        self.assertEqual(self.register().status_code, 201)
        self.assertEqual(self.register().status_code, 400)
    def test_missing_registration_fields(self):
        self.assertEqual(self.client.post('/api/auth/register/', {'email': 'test@gmail.com'}).status_code, 400)

    def test_registration_category_required_and_validated(self):
        from .serializers import RegistrationSerializer
        for category in (None, 'invalid'):
            data = {'email': 'new@gmail.com', 'study_number': 'new', 'military_unit': 'Unit', 'password': 'Training!Strong274'}
            if category is not None:
                data['training_category'] = category
            serializer = RegistrationSerializer(data=data)
            self.assertFalse(serializer.is_valid())
            self.assertIn('training_category', serializer.errors)

    def test_military_unit_must_be_from_list(self):
        from .serializers import RegistrationSerializer
        serializer = RegistrationSerializer(data={'military_unit': 'arbitrary'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('military_unit', serializer.errors)
