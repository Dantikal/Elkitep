from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import User, QuizAttempt, CourseReferral
from django.utils import timezone
from accounts.units import MILITARY_UNITS
from .permissions import IsAdministrator
from .serializers import ApplicationSerializer, DecisionSerializer

class ApplicationPagination(PageNumberPagination):
    page_size = 20

class ApplicationsView(generics.ListAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = ApplicationSerializer
    pagination_class = ApplicationPagination

    def get_queryset(self):
        queryset = User.objects.filter(is_staff=False, is_superuser=False).order_by('-date_joined', '-id')
        selected = self.request.query_params.get('status', 'pending')
        if selected not in ['pending', 'approved', 'rejected', 'all']:
            raise ValidationError({'status': 'Өтүнмөнүн абалы туура эмес.'})
        return queryset if selected == 'all' else queryset.filter(status=selected)

class DecisionView(APIView):
    permission_classes = [IsAdministrator]

    @transaction.atomic
    def post(self, request, pk):
        serializer = DecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = get_object_or_404(User.objects.select_for_update(), pk=pk, is_staff=False, is_superuser=False)
        user.status = serializer.validated_data['decision']
        user.is_active = user.status == User.Status.APPROVED
        user.save(update_fields=['status', 'is_active'])
        if not user.is_active:
            Token.objects.filter(user=user).delete()
        return Response(ApplicationSerializer(user).data)

class ApplicationPhotoView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk, is_staff=False, is_superuser=False)
        if not user.photo:
            raise Http404
        return FileResponse(user.photo.open('rb'))

class UnitDeputiesView(APIView):
    permission_classes = [IsAdministrator]
    def get(self, request):
        deputies = User.objects.filter(role='deputy').order_by('military_unit', 'study_number')
        grouped = {unit: [] for unit in MILITARY_UNITS}
        for deputy in deputies:
            grouped.setdefault(deputy.military_unit, []).append({
                'id': deputy.id,
                'study_number': deputy.study_number,
                'email': deputy.email,
                'status': deputy.status,
            })
        return Response([{'military_unit': unit, 'deputies': grouped[unit]} for unit in MILITARY_UNITS])

class UnitUsersAdminView(APIView):
    permission_classes = [IsAdministrator]
    def get(self, request):
        unit = request.query_params.get('military_unit', '')
        if unit not in MILITARY_UNITS:
            raise ValidationError({'military_unit': 'Аскер бөлүктү тандаңыз.'})
        users = User.objects.filter(military_unit=unit, is_staff=False, is_superuser=False).order_by('study_number')
        return Response([{
            'id': user.id,
            'email': user.email,
            'study_number': user.study_number,
            'role': user.role,
            'training_category': user.training_category,
            'status': user.status,
        } for user in users])

class QuizResultUnitsView(APIView):
    permission_classes = [IsAdministrator]
    def get(self, request):
        return Response(MILITARY_UNITS)

class QuizResultUsersView(APIView):
    permission_classes = [IsAdministrator]
    def get(self, request, unit, category):
        if category not in ('officers', 'warrant-sergeants'):
            raise ValidationError({'category': 'Категория туура эмес.'})
        if unit not in MILITARY_UNITS:
            raise ValidationError({'military_unit': 'Аскер бөлүктү тандаңыз.'})
        users = User.objects.filter(is_staff=False, is_superuser=False, military_unit=unit, training_category=category).order_by('study_number')
        rows = []
        for user in users:
            attempt = QuizAttempt.objects.filter(user=user).exclude(status='active').order_by('-finished_at', '-id').first()
            rows.append({'id': user.id, 'study_number': user.study_number, 'email': user.email,
                'submitted': bool(attempt)})
        return Response(rows)

class QuizUserHistoryView(APIView):
    permission_classes = [IsAdministrator]
    def get(self, request, user_id):
        user = get_object_or_404(User, pk=user_id, is_staff=False, is_superuser=False)
        attempts = QuizAttempt.objects.filter(user=user).exclude(status='active').select_related('quiz', 'quiz__topic', 'quiz__course').order_by('-finished_at', '-id')
        history = []
        for attempt in attempts:
            total = len(attempt.snapshot)
            correct = sum(attempt.answers.get(q['id']) == q['correct_id'] for q in attempt.snapshot)
            history.append({'id': attempt.id, 'title': attempt.quiz.title, 'topic': attempt.quiz.topic.title if attempt.quiz.topic_id else attempt.quiz.course.title,
                'date': attempt.finished_at.isoformat() if attempt.finished_at else attempt.started_at.isoformat(),
                'status': attempt.status, 'grade': min(5, correct * 5 // total) if total and attempt.status != 'failed' else 0,
                'correct_answers': correct, 'total': total})
        return Response({'user': {'id': user.id, 'email': user.email, 'study_number': user.study_number,
            'military_unit': user.military_unit, 'training_category': user.training_category}, 'attempts': history})


class CancelledReferralsView(APIView):
    """Курстун башчылары жокко чыгарган жолдомолор жана себептери."""
    permission_classes = [IsAdministrator]
    def get(self, request):
        rows = CourseReferral.objects.filter(status='cancelled', admin_deleted=False).select_related('course', 'user', 'sender').order_by('-created_at', '-id')
        return Response({'unread': rows.filter(admin_read_at__isnull=True).count(), 'items': [{
            'id': r.id, 'course_title': r.course.title, 'reason': r.cancel_reason, 'cancelled_at': r.created_at.isoformat(),
            'is_read': r.admin_read_at is not None,
            'course_head': {'email': r.sender.email, 'study_number': r.sender.study_number} if r.sender else None,
            'user': {'id': r.user.id, 'study_number': r.user.study_number, 'email': r.user.email, 'military_unit': r.user.military_unit},
            'correct_answers': r.result.get('correct_answers'), 'total': r.result.get('total'), 'grade': r.result.get('grade'),
            'tests': r.result.get('tests', []),
        } for r in rows]})
    def post(self, request):
        CourseReferral.objects.filter(status='cancelled', admin_deleted=False, admin_read_at__isnull=True).update(admin_read_at=timezone.now())
        return Response(status=204)


class CancelledReferralDetailView(APIView):
    """Администратордун бөлүмүнөн өчүрүү. Жазуу сакталат: колдонуучуга жолдомо автоматтык жөнөтүлбөйт."""
    permission_classes = [IsAdministrator]
    def delete(self, request, pk):
        referral = get_object_or_404(CourseReferral, pk=pk, status='cancelled', admin_deleted=False)
        referral.admin_deleted = True
        referral.save(update_fields=['admin_deleted'])
        return Response(status=204)
