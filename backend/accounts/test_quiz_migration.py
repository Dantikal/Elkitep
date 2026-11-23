from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class TopicQuizMigrationTests(TransactionTestCase):
    def test_existing_quiz_and_results_are_preserved_in_dedicated_topic(self):
        old_target = [('accounts', '0006_trainingquiz_quizattempt')]
        new_target = [('accounts', '0007_trainingquiz_topic')]
        executor = MigrationExecutor(connection)
        executor.migrate(old_target)
        try:
            apps = executor.loader.project_state(old_target).apps
            User = apps.get_model('accounts', 'User')
            Quiz = apps.get_model('accounts', 'TrainingQuiz')
            Attempt = apps.get_model('accounts', 'QuizAttempt')
            Topic = apps.get_model('accounts', 'TrainingTopic')
            existing_topic = Topic.objects.create(section='command', category='officers', month=12, title='Shooting')
            user = User.objects.create(username='migration', email='migration@test.com', study_number='migration')
            quiz = Quiz.objects.create(section='command', category='officers', month=12, title='December test', duration_seconds=60, questions=[{'text': 'Question', 'options': ['Yes', 'No'], 'correct_index': 0}])
            now = timezone.now()
            attempt = Attempt.objects.create(user_id=user.id, quiz_id=quiz.id, snapshot=[{'id': 'q', 'text': 'Question', 'options': [], 'correct_id': 'a'}], answers={'q': 'a'}, started_at=now, deadline=now, last_seen=now, status='completed', percentage=100)
            executor = MigrationExecutor(connection)
            executor.migrate(new_target)
            apps = executor.loader.project_state(new_target).apps
            migrated = apps.get_model('accounts', 'TrainingQuiz').objects.get(pk=quiz.id)
            self.assertEqual(migrated.topic.title, 'December test')
            self.assertNotEqual(migrated.topic_id, existing_topic.id)
            self.assertEqual(migrated.topic.month, 12)
            self.assertEqual(migrated.questions, quiz.questions)
            result = apps.get_model('accounts', 'QuizAttempt').objects.get(pk=attempt.id)
            self.assertEqual(result.quiz_id, quiz.id)
            self.assertEqual(result.percentage, 100)
            self.assertEqual(result.answers, {'q': 'a'})
        finally:
            MigrationExecutor(connection).migrate(new_target)
