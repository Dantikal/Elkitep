from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, PersonalTrainingDay


class PersonalPlanTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='plan', email='plan@test.com', study_number='plan', status='approved')
        self.other = User.objects.create_user(username='other', email='other@test.com', study_number='other', status='approved')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = '/api/auth/training/physical/personal-plan/days/'

    def test_numbering_save_and_reload(self):
        first = self.client.post(self.url, {}, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['number'], 1)
        second = self.client.post(self.url, {'number': 50}, format='json')
        self.assertEqual(second.data['number'], 2)
        detail = f"{self.url}{first.data['id']}/"
        rows = [{'action': 'Чуркоо', 'until': '20 мүнөт'}, {'action': 'Тартылуу', 'until': '10 жолу'}]
        response = self.client.patch(detail, {'activities': rows}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(detail).data['activities'], rows)
        self.assertEqual(self.client.get(self.url).data[0]['activities'], rows)
        rows[0]['until'] = '30 мүнөт'
        self.client.patch(detail, {'activities': rows}, format='json')
        self.assertEqual(self.client.get(detail).data['activities'], rows)

    def test_owner_isolation(self):
        day = PersonalTrainingDay.objects.create(user=self.user, number=1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url).data, [])
        detail = f'{self.url}{day.pk}/'
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.assertEqual(self.client.patch(detail, {'activities': []}, format='json').status_code, 404)
        self.assertEqual(self.client.post(self.url, {}, format='json').data['number'], 1)

    def test_invalid_rows_do_not_overwrite_saved_plan(self):
        rows = [{'action': 'Чуркоо', 'until': '10 мүнөт'}]
        day = PersonalTrainingDay.objects.create(user=self.user, number=1, activities=rows)
        for invalid in [[{'action': '', 'until': '10'}], [{'action': 'Чуркоо'}], 'invalid', [{'action': 'a', 'until': 'b'}] * 201]:
            response = self.client.patch(f'{self.url}{day.pk}/', {'activities': invalid}, format='json')
            self.assertEqual(response.status_code, 400)
        day.refresh_from_db()
        self.assertEqual(day.activities, rows)

    def test_pending_and_anonymous_denied(self):
        self.user.status = 'pending'
        self.user.save()
        self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
