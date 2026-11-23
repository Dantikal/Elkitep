from datetime import timedelta
from random import SystemRandom
from uuid import uuid4
from django.db import transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from rest_framework.views import APIView
from .models import User, TrainingTopic, TrainingQuiz, QuizAttempt
from .training import TrainingPermission

HEARTBEAT_GRACE_SECONDS = 30

class QuestionInput(serializers.Serializer):
    text = serializers.CharField(max_length=10000)
    options = serializers.ListField(child=serializers.CharField(max_length=2000), min_length=2, max_length=10)
    correct_index = serializers.IntegerField(min_value=0)
    def validate(self, attrs):
        if attrs['correct_index'] >= len(attrs['options']):
            raise serializers.ValidationError('Бир туура жоопту тандаңыз.')
        return attrs

class QuizInput(serializers.Serializer):
    title = serializers.CharField(max_length=250)
    duration_seconds = serializers.IntegerField(min_value=10, max_value=86400)
    questions = QuestionInput(many=True, min_length=1, max_length=500)

def get_topic(request, topic_id):
    topic = get_object_or_404(TrainingTopic, pk=topic_id)
    if not request.user.is_superuser and topic.category != request.user.training_category:
        raise PermissionDenied('Өз категорияңыздын тестин тандаңыз.')
    return topic

def get_quiz(request, pk):
    quiz = get_object_or_404(TrainingQuiz.objects.select_related('topic', 'course'), pk=pk)
    user = request.user
    if user.is_superuser:
        return quiz
    if quiz.course_id:
        if quiz.course.owner_id != user.id and not quiz.course.enrollments.filter(user=user).exists():
            raise PermissionDenied('Тестти өтүү үчүн курска жазылыңыз.')
    elif quiz.topic.category != user.training_category:
        raise PermissionDenied()
    return quiz

def finish(attempt, status, reason, now):
    attempt.status, attempt.reason, attempt.finished_at = status, reason, now
    correct = sum(attempt.answers.get(q['id']) == q['correct_id'] for q in attempt.snapshot)
    attempt.percentage = 0 if status == 'failed' else round(correct * 100 / len(attempt.snapshot), 2)
    attempt.save(update_fields=['status', 'reason', 'finished_at', 'percentage'])

def expire(attempt, now):
    if attempt.status != 'active':
        return
    lost_at = attempt.last_seen + timedelta(seconds=HEARTBEAT_GRACE_SECONDS)
    if now >= min(attempt.deadline, lost_at):
        if attempt.deadline <= lost_at:
            finish(attempt, 'timed_out', 'time_limit', now)
        else:
            finish(attempt, 'failed', 'connection_lost', now)

def result(attempt, include_questions=False):
    correct = sum(attempt.answers.get(q['id']) == q['correct_id'] for q in attempt.snapshot) if attempt.status != 'active' else 0
    total = len(attempt.snapshot)
    data = {
        'id': attempt.id, 'quiz_id': attempt.quiz_id, 'status': attempt.status,
        'reason': attempt.reason, 'percentage': attempt.percentage,
        'answered': len(attempt.answers), 'total': total, 'correct_answers': correct,
        'grade': min(5, correct * 5 // total) if total and attempt.status != 'failed' else 0,
        'deadline': attempt.deadline.isoformat(), 'server_now': timezone.now().isoformat(),
    }
    if include_questions and attempt.status == 'active':
        data['questions'] = [{key: q[key] for key in ('id', 'text', 'options')} for q in attempt.snapshot]
    return data

def quiz_data(quiz, user):
    latest = quiz.attempts.filter(user=user).order_by('-id').first()
    if latest:
        with transaction.atomic():
            latest = QuizAttempt.objects.select_for_update().get(pk=latest.pk)
            expire(latest, timezone.now())
    return {'id': quiz.id, 'title': quiz.title, 'duration_seconds': quiz.duration_seconds,
            'question_count': len(quiz.questions), 'latest_result': result(latest) if latest else None,
            'deadline': quiz.deadline.isoformat() if quiz.deadline else None, 'module': quiz.module}

class QuizList(APIView):
    permission_classes = [TrainingPermission]
    def get(self, request, **kwargs):
        topic = get_topic(request, kwargs['topic_id'])
        return Response([quiz_data(quiz, request.user) for quiz in TrainingQuiz.objects.filter(topic=topic).order_by('id')])
    def post(self, request, **kwargs):
        topic = get_topic(request, kwargs['topic_id'])
        serializer = QuizInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        quiz = TrainingQuiz.objects.create(topic=topic, section=topic.section, category=topic.category, month=topic.month, **serializer.validated_data)
        return Response(quiz_data(quiz, request.user), status=201)

class QuizDetail(APIView):
    permission_classes = [TrainingPermission]
    def get(self, request, pk):
        if not request.user.is_superuser:
            raise PermissionDenied()
        quiz = get_object_or_404(TrainingQuiz, pk=pk)
        return Response({**quiz_data(quiz, request.user), 'questions': quiz.questions})
    def patch(self, request, pk):
        quiz = get_object_or_404(TrainingQuiz, pk=pk)
        data = {'title': quiz.title, 'duration_seconds': quiz.duration_seconds, 'questions': quiz.questions}
        data.update(request.data)
        serializer = QuizInput(data=data)
        serializer.is_valid(raise_exception=True)
        for key, value in serializer.validated_data.items():
            setattr(quiz, key, value)
        quiz.save(update_fields=['title', 'duration_seconds', 'questions'])
        return Response(quiz_data(quiz, request.user))
    def delete(self, request, pk):
        quiz = get_object_or_404(TrainingQuiz, pk=pk)
        if quiz.attempts.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Бул тест боюнча аракеттердин тарыхы бар болгондуктан, аны өчүрүүгө болбойт.')
        quiz.delete()
        return Response(status=204)

class CanTakeQuiz(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user.is_authenticated and (user.is_superuser or user.status == 'approved'))

class StartAttempt(APIView):
    permission_classes = [CanTakeQuiz]
    def post(self, request, pk):
        quiz = get_quiz(request, pk)
        with transaction.atomic():
            # Serialize starts for the same user; the database constraint also prevents duplicates.
            User.objects.select_for_update().get(pk=request.user.pk)
            now = timezone.now()
            for previous in QuizAttempt.objects.select_for_update().filter(user=request.user, status='active'):
                expire(previous, now)
                if previous.status == 'active':
                    return Response({'detail': 'Активдүү тестти бүтүрүңүз.', 'attempt_id': previous.id}, status=409)
            if quiz.deadline and now >= quiz.deadline:
                return Response({'detail': 'Тесттин мөөнөтү бүттү.'}, status=400)
            snapshot = []
            for question in quiz.questions:
                options = [{'id': uuid4().hex, 'text': value} for value in question['options']]
                correct_id = options[question['correct_index']]['id']
                SystemRandom().shuffle(options)
                snapshot.append({'id': uuid4().hex, 'text': question['text'], 'options': options, 'correct_id': correct_id})
            SystemRandom().shuffle(snapshot)
            try:
                attempt = QuizAttempt.objects.create(quiz=quiz, user=request.user, snapshot=snapshot,
                    started_at=now, last_seen=now, deadline=min(now + timedelta(seconds=quiz.duration_seconds), quiz.deadline or now + timedelta(seconds=quiz.duration_seconds)))
            except IntegrityError:
                return Response({'detail': 'Активдүү тестти бүтүрүңүз.'}, status=409)
        return Response(result(attempt, include_questions=True), status=201)

class AttemptAction(APIView):
    permission_classes = [CanTakeQuiz]
    def get(self, request, pk):
        with transaction.atomic():
            attempt = get_object_or_404(QuizAttempt.objects.select_for_update(), pk=pk, user=request.user)
            expire(attempt, timezone.now())
            return Response(result(attempt))
    def post(self, request, pk):
        serializer = AttemptActionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            attempt = get_object_or_404(QuizAttempt.objects.select_for_update(), pk=pk, user=request.user)
            now = timezone.now()
            expire(attempt, now)
            if attempt.status != 'active':
                return Response(result(attempt))
            action = data['action']
            if action == 'answer':
                question = next((q for q in attempt.snapshot if q['id'] == data.get('question_id')), None)
                if question is None or data.get('option_id') not in [option['id'] for option in question['options']]:
                    raise serializers.ValidationError('Жооп туура эмес.')
                attempt.answers[question['id']] = data['option_id']
                attempt.save(update_fields=['answers'])
            elif action == 'finish':
                finish(attempt, 'completed', 'submitted', now)
            elif action == 'violation':
                finish(attempt, 'failed', data['reason'], now)
            if attempt.status == 'active':
                attempt.last_seen = now
                attempt.save(update_fields=['last_seen'])
            return Response(result(attempt))

class AttemptActionInput(serializers.Serializer):
    action = serializers.ChoiceField(choices=['heartbeat', 'answer', 'finish', 'violation'])
    question_id = serializers.CharField(required=False)
    option_id = serializers.CharField(required=False)
    reason = serializers.ChoiceField(choices=['screenshot', 'app_exit', 'navigation'], required=False)
    def validate(self, attrs):
        if attrs['action'] == 'violation' and 'reason' not in attrs:
            raise serializers.ValidationError('Себебин көрсөтүңүз.')
        if attrs['action'] == 'answer' and not all(key in attrs for key in ('question_id', 'option_id')):
            raise serializers.ValidationError('Суроону жана жоопту тандаңыз.')
        return attrs

class RecoverAttempts(APIView):
    permission_classes = [CanTakeQuiz]
    def post(self, request):
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            attempts = list(QuizAttempt.objects.select_for_update().filter(user=request.user, status='active'))
            for attempt in attempts:
                finish(attempt, 'failed', 'app_exit', timezone.now())
            return Response([result(attempt) for attempt in attempts])

class MyQuizResults(APIView):
    permission_classes = [CanTakeQuiz]
    def get(self, request):
        attempts = QuizAttempt.objects.filter(user=request.user).exclude(status='active').select_related('quiz', 'quiz__topic', 'quiz__course').order_by('-finished_at', '-id')
        rows = []
        for attempt in attempts:
            total = len(attempt.snapshot)
            correct = sum(attempt.answers.get(question['id']) == question['correct_id'] for question in attempt.snapshot)
            rows.append({'id': attempt.id, 'title': attempt.quiz.title, 'topic': attempt.quiz.topic.title if attempt.quiz.topic_id else attempt.quiz.course.title,
                'date': attempt.finished_at.isoformat() if attempt.finished_at else attempt.started_at.isoformat(),
                'status': attempt.status, 'grade': min(5, correct * 5 // total) if total and attempt.status != 'failed' else 0,
                'correct_answers': correct, 'total': total})
        return Response(rows)
