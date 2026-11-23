from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, DietSubmission
from .diet import GOALS

class DietTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@test.com', study_number='u', military_unit='2022', status='approved')
        self.doctor = User.objects.create_user(username='d', email='d@test.com', study_number='d', military_unit='2022', role='doctor', status='approved')
        self.other = User.objects.create_user(username='o', email='o@test.com', study_number='o', military_unit='2023', role='doctor', status='approved')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.data = dict(gender='Эркек', age=25, height=180, weight=80, goals=GOALS[:2], experience='Жаңы баштадым', location='Үйдө', frequency='2 жолу', chronic=False)

    def test_save_send_read_reply(self):
        self.assertEqual(self.client.post('/api/auth/diet/', self.data, format='json').status_code, 200)
        self.assertEqual(DietSubmission.objects.count(), 0)
        self.client.post('/api/auth/diet/?send=1', self.data, format='json')
        item = DietSubmission.objects.get()
        # Later edits must not change what was sent to the doctor.
        self.client.post('/api/auth/diet/', {**self.data, 'weight': 70}, format='json')
        self.client.force_authenticate(self.doctor)
        self.assertEqual(self.client.get('/api/auth/diet/notifications/').data['unread'], 1)
        url = f'/api/auth/diet/patients/{item.id}/'
        self.assertEqual(self.client.get(url).data['data']['weight'], 80)
        self.assertEqual(self.client.get('/api/auth/diet/notifications/').data['unread'], 0)
        self.assertEqual(self.client.post(url, {'text': 'Жооп'}, format='json').status_code, 201)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/auth/diet/notifications/').data['unread'], 1)
        self.assertEqual(self.client.get('/api/auth/diet/replies/').data[0]['text'], 'Жооп')
        self.client.post('/api/auth/diet/replies/')
        self.assertEqual(self.client.get('/api/auth/diet/notifications/').data['unread'], 0)

    def test_access_isolation_and_validation(self):
        self.client.post('/api/auth/diet/?send=1', self.data, format='json')
        item = DietSubmission.objects.get()
        self.assertEqual(self.client.get('/api/auth/diet/patients/').status_code, 403)
        self.assertEqual(self.client.post('/api/auth/diet/', {**self.data, 'chronic': True}, format='json').status_code, 400)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/auth/diet/patients/').data, [])
        for suffix in ['', 'photo/']:
            self.assertEqual(self.client.get(f'/api/auth/diet/patients/{item.id}/' + suffix).status_code, 404)
        self.assertEqual(self.client.post(f'/api/auth/diet/patients/{item.id}/', {'text': 'No'}, format='json').status_code, 404)
        self.assertEqual(self.client.get('/api/auth/diet/replies/').data, [])

    def test_first_open_has_explicit_empty_response(self):
        response = self.client.get('/api/auth/diet/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b'')
        self.client.post('/api/auth/diet/', self.data, format='json')
        response = self.client.get('/api/auth/diet/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['age'], 25)
