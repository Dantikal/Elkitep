from datetime import timedelta
from unittest.mock import patch
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import User, TrainingTopic, TrainingQuiz, QuizAttempt
from .quizzes import HEARTBEAT_GRACE_SECONDS

class QuizTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='quiz-admin', email='admin@quiz.test', study_number='admin', is_superuser=True)
        self.user = User.objects.create_user(username='quiz-user', email='user@quiz.test', study_number='user', status='approved')
        self.other = User.objects.create_user(username='quiz-other', email='other@quiz.test', study_number='other', training_category='warrant-sergeants', status='approved')
        self.topic = TrainingTopic.objects.create(section='command', category='officers', month=12, title='Shooting')
        self.route = f'/api/auth/training/topics/{self.topic.id}/quizzes/'
        self.payload = {'title': 'December test', 'duration_seconds': 60, 'questions': [
            {'text': 'Question one', 'options': ['correct one', 'wrong one'], 'correct_index': 0},
            {'text': 'Question two', 'options': ['wrong two', 'correct two', 'wrong three'], 'correct_index': 1},
        ]}
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.route, self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.quiz_id = response.data['id']
        self.client.force_authenticate(self.user)

    def start(self, quiz_id=None):
        response = self.client.post(f'/api/auth/training/quizzes/{quiz_id or self.quiz_id}/start/')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def action(self, attempt, **data):
        return self.client.post(f"/api/auth/training/attempts/{attempt['id']}/", data, format='json')

    def answer_correct(self, started, index=0):
        question = QuizAttempt.objects.get(pk=started['id']).snapshot[index]
        response = self.action(started, action='answer', question_id=question['id'], option_id=question['correct_id'])
        self.assertEqual(response.status_code, 200)
        return question

    def test_validation_and_admin_permissions(self):
        self.assertEqual(self.client.post(self.route, self.payload, format='json').status_code, 403)
        self.client.force_authenticate(self.admin)
        for question in [
            {'text': 'q', 'options': ['only'], 'correct_index': 0},
            {'text': 'q', 'options': [str(i) for i in range(11)], 'correct_index': 0},
            {'text': 'q', 'options': ['one', 'two'], 'correct_index': 2},
        ]:
            response = self.client.post(self.route, {**self.payload, 'questions': [question]}, format='json')
            self.assertEqual(response.status_code, 400, response.data)
        # Одинаковые варианты ответа разрешены.
        same = {'text': 'q', 'options': ['same', 'same'], 'correct_index': 0}
        self.assertEqual(self.client.post(self.route, {**self.payload, 'questions': [same]}, format='json').status_code, 201)
        for changes in ({'questions': []}, {'duration_seconds': 0}, {'duration_seconds': 86401}):
            self.assertEqual(self.client.post(self.route, {**self.payload, **changes}, format='json').status_code, 400)
        ten = {'text': 'ten options', 'options': [str(i) for i in range(10)], 'correct_index': 9}
        self.assertEqual(self.client.post(self.route, {**self.payload, 'questions': [ten]}, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/auth/training/topics/999999/quizzes/', self.payload, format='json').status_code, 404)

    def test_results_and_correct_answers_are_server_only(self):
        started = self.start()
        self.assertNotIn('correct_id', str(started))
        self.assertNotIn('correct_index', str(started))
        listing = self.client.get(self.route).data
        self.assertNotIn('questions', listing[0])
        self.answer_correct(started)
        finished = self.action(started, action='finish', percentage=100)
        self.assertEqual(finished.data['percentage'], 50)
        self.assertEqual(finished.data['answered'], 1)
        self.assertEqual(finished.data['status'], 'completed')
        self.assertNotIn('questions', finished.data)
        self.assertEqual(self.action(started, action='finish').data['percentage'], 50)

    def test_deadline_counts_saved_answers_rejects_late_answer(self):
        started = self.start()
        self.answer_correct(started)
        now = timezone.now()
        QuizAttempt.objects.filter(pk=started['id']).update(deadline=now - timedelta(seconds=1), last_seen=now)
        question = QuizAttempt.objects.get(pk=started['id']).snapshot[1]
        result = self.action(started, action='answer', question_id=question['id'], option_id=question['correct_id'])
        self.assertEqual(result.data['status'], 'timed_out')
        self.assertEqual(result.data['percentage'], 50)
        self.assertEqual(result.data['answered'], 1)

    def test_violations_fail_and_cannot_be_changed_by_submission(self):
        for reason in ('screenshot', 'app_exit', 'navigation'):
            started = self.start()
            self.answer_correct(started)
            response = self.action(started, action='violation', reason=reason)
            self.assertEqual(response.data['status'], 'failed')
            self.assertEqual(response.data['percentage'], 0)
            self.assertEqual(response.data['reason'], reason)
            self.assertEqual(self.action(started, action='finish').data['status'], 'failed')

    def test_hard_exit_loses_attempt_and_allows_retry(self):
        started = self.start()
        QuizAttempt.objects.filter(pk=started['id']).update(last_seen=timezone.now() - timedelta(seconds=HEARTBEAT_GRACE_SECONDS + 1))
        response = self.client.get(self.route)
        self.assertEqual(response.data[0]['latest_result']['status'], 'failed')
        self.assertEqual(response.data[0]['latest_result']['reason'], 'connection_lost')
        next_attempt = self.start()
        self.assertNotEqual(next_attempt['id'], started['id'])

    def test_timing_uses_server_clock_and_heartbeat(self):
        started = self.start()
        original_deadline = QuizAttempt.objects.get(pk=started['id']).deadline
        response = self.action(started, action='heartbeat', deadline='2099-01-01', percentage=100)
        self.assertEqual(response.data['status'], 'active')
        self.assertEqual(QuizAttempt.objects.get(pk=started['id']).deadline, original_deadline)
        self.assertEqual(self.client.post(f'/api/auth/training/quizzes/{self.quiz_id}/start/').status_code, 409)

    def test_attempt_owner_and_category_access(self):
        started = self.start()
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.route).status_code, 403)
        self.assertEqual(self.client.post(f'/api/auth/training/quizzes/{self.quiz_id}/start/').status_code, 403)
        self.assertEqual(self.action(started, action='finish').status_code, 404)
        self.assertEqual(self.client.get(f"/api/auth/training/attempts/{started['id']}/").status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.route).status_code, 401)

    def test_questions_and_options_shuffle_between_attempts(self):
        # Fix both permutations to prove IDs and correctness follow the displayed order.
        with patch('accounts.quizzes.SystemRandom.shuffle', side_effect=lambda values: None):
            first = self.start()
        self.assertEqual([q['text'] for q in first['questions']], ['Question one', 'Question two'])
        self.action(first, action='finish')
        with patch('accounts.quizzes.SystemRandom.shuffle', side_effect=lambda values: values.reverse()):
            second = self.start()
        self.assertEqual([q['text'] for q in second['questions']], ['Question two', 'Question one'])
        self.assertEqual([v['text'] for v in second['questions'][0]['options']], ['wrong three', 'correct two', 'wrong two'])
        self.assertNotEqual(first['questions'][0]['id'], second['questions'][1]['id'])
        for question in QuizAttempt.objects.get(pk=second['id']).snapshot:
            self.action(second, action='answer', question_id=question['id'], option_id=question['correct_id'])
        self.assertEqual(self.action(second, action='finish').data['percentage'], 100)

    def test_foreign_question_or_option_rejected(self):
        started = self.start()
        snapshot = QuizAttempt.objects.get(pk=started['id']).snapshot
        response = self.action(started, action='answer', question_id=snapshot[0]['id'], option_id=snapshot[1]['options'][0]['id'])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.action(started, action='answer', question_id='fake', option_id='fake').status_code, 400)
        self.assertEqual(self.action(started, action='violation').status_code, 400)
        self.assertEqual(QuizAttempt.objects.get(pk=started['id']).answers, {})

    def test_sections_and_categories_have_independent_quizzes(self):
        self.client.force_authenticate(self.admin)
        independent_topic = TrainingTopic.objects.create(section='independent', category='officers', month=12, title='Independent study')
        sergeant_topic = TrainingTopic.objects.create(section='independent', category='warrant-sergeants', month=12, title='Sergeant study')
        independent = f'/api/auth/training/topics/{independent_topic.id}/quizzes/'
        sergeants = f'/api/auth/training/topics/{sergeant_topic.id}/quizzes/'
        self.assertEqual(self.client.post(independent, {**self.payload, 'title': 'Independent'}, format='json').status_code, 201)
        self.assertEqual(self.client.post(sergeants, {**self.payload, 'title': 'Sergeants'}, format='json').status_code, 201)
        self.assertEqual([q['title'] for q in self.client.get(self.route).data], ['December test'])
        self.assertEqual([q['title'] for q in self.client.get(independent).data], ['Independent'])
        self.assertEqual([q['title'] for q in self.client.get(sergeants).data], ['Sergeants'])

    def test_restart_immediately_fails_unfinished_attempt(self):
        started = self.start()
        self.answer_correct(started)
        response = self.client.post('/api/auth/training/attempts/recover/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['status'], 'failed')
        self.assertEqual(response.data[0]['reason'], 'app_exit')
        self.assertEqual(response.data[0]['percentage'], 0)
        self.assertEqual(self.client.post('/api/auth/training/attempts/recover/').data, [])
        self.assertEqual(self.action(started, action='finish').data['status'], 'failed')
        self.assertNotEqual(self.start()['id'], started['id'])

    def test_answer_change_and_percentage_rounding(self):
        self.client.force_authenticate(self.admin)
        payload = {**self.payload, 'questions': self.payload['questions'] + [{'text': 'Third', 'options': ['yes', 'no'], 'correct_index': 0}]}
        quiz = self.client.post(self.route, payload, format='json').data
        self.client.force_authenticate(self.user)
        started = self.start(quiz['id'])
        question = self.answer_correct(started)
        wrong = next(option['id'] for option in question['options'] if option['id'] != question['correct_id'])
        self.action(started, action='answer', question_id=question['id'], option_id=wrong)
        self.assertEqual(len(QuizAttempt.objects.get(pk=started['id']).answers), 1)
        self.answer_correct(started)
        self.assertEqual(self.action(started, action='finish').data['percentage'], 33.33)

    def test_tests_belong_to_selected_topic_and_month_route_is_removed(self):
        second_topic = TrainingTopic.objects.create(section='command', category='officers', month=12, title='Tactics')
        second_route = f'/api/auth/training/topics/{second_topic.id}/quizzes/'
        self.client.force_authenticate(self.admin)
        response = self.client.post(second_route, {**self.payload, 'title': 'Tactics test', 'topic_id': self.topic.id}, format='json')
        self.assertEqual(response.status_code, 201)
        quiz = TrainingQuiz.objects.get(pk=response.data['id'])
        self.assertEqual(quiz.topic_id, second_topic.id)
        self.assertEqual(quiz.section, second_topic.section)
        self.assertEqual(quiz.category, second_topic.category)
        self.assertEqual(quiz.month, second_topic.month)
        self.client.force_authenticate(self.user)
        self.assertEqual([q['title'] for q in self.client.get(self.route).data], ['December test'])
        self.assertEqual([q['title'] for q in self.client.get(second_route).data], ['Tactics test'])
        old_route = '/api/auth/training/2026/sections/command/officers/months/12/quizzes/'
        self.assertEqual(self.client.get(old_route).status_code, 404)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(old_route, self.payload, format='json').status_code, 404)
