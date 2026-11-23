from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

User = get_user_model()

class AdministratorDashboardTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin', email='admin@example.com', study_number='ADMIN', password='Admin!Strong274')
        self.applicant = User.objects.create_user(username='cadet@gmail.com', email='cadet@gmail.com', study_number='100', military_unit='Unit 1', password='Training!Strong274', is_active=False)
        self.regular = User.objects.create_user(username='regular', email='regular@gmail.com', study_number='101', status='approved')
        self.staff = User.objects.create_user(username='staff', email='staff@gmail.com', study_number='102', is_staff=True)
        self.url = f'/api/auth/admin/applications/{self.applicant.pk}/decision/'

    def test_only_superuser_can_manage_applications(self):
        self.assertEqual(self.client.get('/api/auth/admin/applications/').status_code, 401)
        for user in [self.regular, self.staff]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get('/api/auth/admin/applications/').status_code, 403)
            self.assertEqual(self.client.post(self.url, {'decision': 'approved'}).status_code, 403)
            self.assertEqual(self.client.get(f'/api/auth/admin/applications/{self.applicant.pk}/photo/').status_code, 403)
        self.applicant.refresh_from_db()
        self.assertFalse(self.applicant.is_active)

    def test_superuser_login_list_approve_reject(self):
        login = self.client.post('/api/auth/login/', {'email': 'admin@example.com', 'password': 'Admin!Strong274'})
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data['user']['is_superuser'])
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + login.data['token'])
        result = self.client.get('/api/auth/admin/applications/')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['count'], 1)
        self.assertNotIn('password', result.data['results'][0])
        credentials = {'email': 'cadet@gmail.com', 'password': 'Training!Strong274'}
        self.assertEqual(self.client.post('/api/auth/login/', credentials).status_code, 401)
        self.assertEqual(self.client.post(self.url, {'decision': 'approved'}).status_code, 200)
        approved_login = self.client.post('/api/auth/login/', credentials)
        self.assertEqual(approved_login.status_code, 200)
        self.assertFalse(approved_login.data['user']['is_superuser'])
        self.assertEqual(self.client.get('/api/auth/admin/applications/').data['count'], 0)
        self.assertEqual(self.client.post(self.url, {'decision': 'rejected'}).status_code, 200)
        self.assertFalse(Token.objects.filter(user=self.applicant).exists())
        self.assertEqual(self.client.post('/api/auth/login/', credentials).status_code, 401)
        self.assertEqual(self.client.get('/api/auth/admin/applications/?status=rejected').data['count'], 1)

    def test_validation_and_protected_admin_accounts(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(self.url, {'decision': 'invalid'}).status_code, 400)
        self.assertEqual(self.client.get('/api/auth/admin/applications/?status=invalid').status_code, 400)
        self.assertEqual(self.client.post(f'/api/auth/admin/applications/{self.admin.pk}/decision/', {'decision': 'rejected'}).status_code, 404)
        self.assertEqual(self.client.post(f'/api/auth/admin/applications/{self.staff.pk}/decision/', {'decision': 'rejected'}).status_code, 404)
