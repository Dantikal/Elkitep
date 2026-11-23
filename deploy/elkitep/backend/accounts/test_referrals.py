from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import User, CourseSection, CourseEnrollment, CourseReferral, TrainingQuiz, QuizAttempt


class ReferralTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='a', email='a@test.com', study_number='A1', is_superuser=True)
        self.head = User.objects.create_user(username='h', email='h@gmail.com', study_number='H1', role='course_head', status='approved')
        self.other_head = User.objects.create_user(username='h2', email='h2@gmail.com', study_number='H2', role='course_head', status='approved')
        self.student = User.objects.create_user(username='s', email='s@gmail.com', study_number='S1', status='approved')
        self.weak = User.objects.create_user(username='w', email='w@gmail.com', study_number='W1', status='approved')
        self.late = User.objects.create_user(username='l', email='l@gmail.com', study_number='L1', status='approved')
        self.course = CourseSection.objects.create(title='Курс', owner=self.head)
        for u in (self.student, self.weak, self.late):
            CourseEnrollment.objects.create(course=self.course, user=u)
        self.quizzes = [TrainingQuiz.objects.create(course=self.course, title=f'Модуль {i + 1}', module=i + 1 if i < 2 else 2, duration_seconds=600,
                        questions=[], deadline=timezone.now() + timedelta(days=i + 1)) for i in range(3)]
        self.passers = f'/api/auth/courses/sections/{self.course.id}/test-passers/'
        self.send = f'/api/auth/courses/sections/{self.course.id}/referrals/'
        self.cancel = f'/api/auth/courses/sections/{self.course.id}/referrals/cancel/'

    def attempt(self, user, quiz, correct, total=4, status='completed', ago=timedelta(0)):
        at = timezone.now() - ago
        snapshot = [{'id': f'q{i}', 'text': 't', 'options': [], 'correct_id': 'a'} for i in range(total)]
        answers = {f'q{i}': 'a' if i < correct else 'b' for i in range(total)}
        return QuizAttempt.objects.create(quiz=quiz, user=user, snapshot=snapshot, answers=answers, started_at=at,
                                          deadline=at, last_seen=at, finished_at=at, status=status)

    def row(self, user):
        return next(u for u in self.client.get(self.passers).data['users'] if u['id'] == user.id)

    def test_send_within_window_and_user_bell(self):
        self.attempt(self.student, self.quizzes[0], 1)
        self.attempt(self.student, self.quizzes[0], 4)   # акыркы аракет эсептелет
        self.attempt(self.student, self.quizzes[1], 2)
        self.attempt(self.weak, self.quizzes[0], 4)       # 1 гана тест — тизмеде жок

        self.client.force_authenticate(self.other_head)
        self.assertEqual(self.client.get(self.passers).status_code, 403)

        self.client.force_authenticate(self.head)
        data = self.client.get(self.passers).data
        self.assertEqual((data['required_tests'], data['decision_hours']), (2, 24))
        self.assertEqual([u['study_number'] for u in data['users']], ['S1'])
        row = data['users'][0]
        self.assertEqual((row['correct_answers'], row['total'], row['grade'], row['state']), (6, 8, 3, 'pending'))
        self.assertEqual([t['correct_answers'] for t in row['tests']], [4, 2])

        self.assertEqual(self.client.post(self.send, {'user_id': self.weak.id}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.send, {'user_id': self.student.id}, format='json').status_code, 201)
        self.assertEqual(self.client.post(self.send, {'user_id': self.student.id}, format='json').status_code, 400)  # чечим мурун кабыл алынган
        self.assertEqual(self.client.post(self.cancel, {'user_id': self.student.id, 'reason': 'x'}, format='json').status_code, 400)
        self.assertEqual(self.row(self.student)['state'], 'sent')

        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(self.send, {'user_id': self.student.id}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/auth/referrals/unread/').data['unread'], 1)
        items = self.client.get('/api/auth/referrals/').data
        self.assertIn('S1', items[0]['message'])
        doc = items[0]
        self.assertEqual((doc['study_number'], doc['grade'], doc['passed'], doc['valid_months']), ('S1', 3, True, 1))
        self.assertIsNotNone(doc['test_date'])
        issued = timezone.datetime.fromisoformat(doc['issued_at']); deadline = timezone.datetime.fromisoformat(doc['exam_deadline'])
        self.assertTrue(28 <= (deadline - issued).days <= 31)
        self.assertEqual(self.client.post('/api/auth/referrals/unread/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/referrals/unread/').data['unread'], 0)

    def test_cancel_with_reason_goes_to_admin_not_user(self):
        self.attempt(self.student, self.quizzes[0], 4)
        self.attempt(self.student, self.quizzes[1], 3)
        self.client.force_authenticate(self.head)
        self.assertEqual(self.client.post(self.cancel, {'user_id': self.student.id, 'reason': '   '}, format='json').status_code, 400)
        response = self.client.post(self.cancel, {'user_id': self.student.id, 'reason': 'Сабакка катышкан жок'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data['state'], response.data['cancel_reason']), ('cancelled', 'Сабакка катышкан жок'))
        self.assertEqual(self.client.post(self.send, {'user_id': self.student.id}, format='json').status_code, 400)

        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get('/api/auth/referrals/').data, [])
        self.assertEqual(self.client.get('/api/auth/referrals/unread/').data['unread'], 0)

        self.client.force_authenticate(self.head)
        self.assertEqual(self.client.get('/api/auth/admin/cancelled-referrals/').status_code, 403)
        self.client.force_authenticate(self.admin)
        data = self.client.get('/api/auth/admin/cancelled-referrals/').data
        self.assertEqual(data['unread'], 1)
        item = data['items'][0]
        self.assertEqual((item['reason'], item['user']['study_number'], item['course_head']['email'], item['course_title']),
                         ('Сабакка катышкан жок', 'S1', 'h@gmail.com', 'Курс'))
        self.assertEqual((item['correct_answers'], item['total'], item['grade']), (7, 8, 4))
        self.assertEqual(self.client.post('/api/auth/admin/cancelled-referrals/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/admin/cancelled-referrals/').data['unread'], 0)

        # Өчүрүү: администратордун тизмесинен жоголот, бирок жокко чыгаруу күчүндө калат.
        detail = f"/api/auth/admin/cancelled-referrals/{item['id']}/"
        self.client.force_authenticate(self.head)
        self.assertEqual(self.client.delete(detail).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(detail).status_code, 204)
        self.assertEqual(self.client.delete(detail).status_code, 404)
        self.assertEqual(self.client.get('/api/auth/admin/cancelled-referrals/').data['items'], [])
        CourseReferral.objects.filter(pk=item['id']).update(created_at=timezone.now() - timedelta(days=3))
        self.client.force_authenticate(self.head)
        self.assertEqual(self.row(self.student)['state'], 'cancelled')
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get('/api/auth/referrals/').data, [])

    def test_auto_send_after_24_hours_and_no_cancel(self):
        self.attempt(self.late, self.quizzes[0], 4, ago=timedelta(hours=30))
        self.attempt(self.late, self.quizzes[1], 4, ago=timedelta(hours=25))  # 2-тест 25 саат мурун — мөөнөт өттү
        # Колдонуучу колокольчикти ачканда жолдомо автоматтык түрдө жөнөтүлөт (курстун башчысы тизмени ачпаса да).
        self.client.force_authenticate(self.late)
        self.assertEqual(self.client.get('/api/auth/referrals/unread/').data['unread'], 1)
        referral = CourseReferral.objects.get(user=self.late)
        self.assertTrue(referral.auto_sent)
        self.assertLess(referral.created_at, timezone.now() - timedelta(minutes=59))

        self.client.force_authenticate(self.head)
        row = self.row(self.late)
        self.assertEqual((row['state'], row['auto_sent']), ('sent', True))
        response = self.client.post(self.cancel, {'user_id': self.late.id, 'reason': 'кеч'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('автоматтык', str(response.data))

    def test_window_starts_from_second_test(self):
        self.attempt(self.student, self.quizzes[0], 4, ago=timedelta(hours=40))
        self.attempt(self.student, self.quizzes[1], 4, ago=timedelta(hours=2))  # 24 саат 2-тесттен эсептелет
        self.client.force_authenticate(self.head)
        self.assertEqual(self.row(self.student)['state'], 'pending')
        self.assertEqual(self.client.post(self.cancel, {'user_id': self.student.id, 'reason': 'Себеп'}, format='json').status_code, 201)

    def test_failed_attempt_counts_with_zero(self):
        self.attempt(self.student, self.quizzes[0], 4)
        self.attempt(self.student, self.quizzes[1], 3, status='failed')
        self.client.force_authenticate(self.head)
        row = self.row(self.student)
        self.assertEqual((row['correct_answers'], row['total'], row['grade']), (4, 8, 2))
        self.assertEqual(row['tests'][1]['grade'], 0)

    def test_old_referral_without_result_uses_attempts(self):
        self.attempt(self.student, self.quizzes[0], 4)
        self.attempt(self.student, self.quizzes[1], 4)
        CourseReferral.objects.create(course=self.course, user=self.student, status='sent', result={})
        self.client.force_authenticate(self.student)
        doc = self.client.get('/api/auth/referrals/').data[0]
        self.assertEqual((doc['passed'], doc['grade'], doc['total']), (True, 5, 8))

    def test_registration_numbers_are_sequential_and_never_reused(self):
        from .models import ReferralSequence
        users = [self.student, self.late, self.weak]
        for u in users:
            self.attempt(u, self.quizzes[0], 4)
            self.attempt(u, self.quizzes[1], 4)
        self.client.force_authenticate(self.head)
        self.assertEqual(self.client.post(self.send, {'user_id': self.student.id}, format='json').data['reg_number'], 1)
        self.client.post(self.cancel, {'user_id': self.late.id, 'reason': 'Себеп'}, format='json')  # жокко чыгаруу номер албайт
        self.assertIsNone(self.row(self.late)['reg_number'])
        self.assertEqual(self.client.post(self.send, {'user_id': self.weak.id}, format='json').data['reg_number'], 2)
        # Жолдомо өчүрүлсө да, номер кайра берилбейт.
        CourseReferral.objects.filter(reg_number=2).delete()
        self.assertEqual(ReferralSequence.next(), 3)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get('/api/auth/referrals/').data[0]['reg_number'], 1)


class AddMonthsTests(APITestCase):
    def test_end_of_month(self):
        from datetime import datetime
        from .referrals import add_months
        self.assertEqual(add_months(datetime(2026, 1, 31), 1).date().isoformat(), '2026-02-28')
        self.assertEqual(add_months(datetime(2026, 12, 15), 1).date().isoformat(), '2027-01-15')
