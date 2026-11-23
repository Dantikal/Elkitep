from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, PhysicalCorrection


class CorrectionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='one', email='one@test.com', study_number='1', status='approved')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = '/api/auth/training/physical/corrections/'
        self.data = dict(age=25, altitude=400, sportswear=False, clothing_number=3, equipment=False, exercise_number=4)

    def test_create_and_reload_owned_records(self):
        self.assertEqual(self.client.post(self.url, self.data, format='json').status_code, 201)
        response = self.client.get(self.url)
        self.assertEqual(response.data[0]['altitude'], 400)
        other = User.objects.create_user(username='two', email='two@test.com', study_number='2', status='approved')
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(self.url).data, [])

    def test_sportswear_replaces_number(self):
        self.data.update(sportswear=True)
        response = self.client.post(self.url, self.data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data['clothing_number'])

    def test_validation(self):
        for changes in [dict(age=0), dict(altitude=-1), dict(clothing_number=None), dict(exercise_number=0)]:
            response = self.client.post(self.url, {**self.data, **changes}, format='json')
            self.assertEqual(response.status_code, 400)
        self.assertEqual(PhysicalCorrection.objects.count(), 0)

    def test_pending_and_anonymous_denied(self):
        self.user.status = 'pending'
        self.user.save()
        self.assertEqual(self.client.post(self.url, self.data, format='json').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
