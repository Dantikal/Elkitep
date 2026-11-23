from django.core import signing
from django.db import transaction, IntegrityError
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, BasePermission, SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import CourseSection, CourseMaterial, CourseEnrollment, TrainingQuiz
from .training import MaterialSerializer
from .quizzes import QuizInput, quiz_data


class CoursePermission(BasePermission):
    """Approved users read; administrators and course heads may write (ownership is checked per object)."""
    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        if user.status != 'approved':
            return False
        return request.method in SAFE_METHODS or user.role == 'course_head'


class ApprovedUser(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user.is_authenticated and (user.is_superuser or user.status == 'approved'))


def course_of(section):
    # Courses are at most two levels deep: course -> topic.
    return section if section.parent_id is None else section.parent


def can_manage(user, section):
    return user.is_superuser or (user.role == 'course_head' and course_of(section).owner_id == user.id)


def require_manage(user, section):
    if not can_manage(user, section):
        raise PermissionDenied('Бул курсту өзгөртүүгө укугуңуз жок.')


def is_enrolled(user, course):
    return CourseEnrollment.objects.filter(course=course, user=user).exists()


def get_course(pk):
    return get_object_or_404(CourseSection, pk=pk, parent__isnull=True)


class SectionSerializer(serializers.ModelSerializer):
    can_manage = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    class Meta:
        model = CourseSection
        fields = ['id', 'title', 'parent', 'can_manage', 'is_enrolled']
        read_only_fields = ['parent']
    def get_can_manage(self, obj):
        return can_manage(self.context['request'].user, obj)
    def get_is_enrolled(self, obj):
        return obj.parent_id is None and is_enrolled(self.context['request'].user, obj)


class SectionList(generics.ListCreateAPIView):
    permission_classes = [CoursePermission]
    serializer_class = SectionSerializer
    def parent(self):
        pk = self.kwargs.get('parent_id')
        return get_object_or_404(CourseSection.objects.select_related('parent'), pk=pk) if pk else None
    def get_queryset(self):
        return CourseSection.objects.filter(parent=self.parent()).select_related('parent').order_by('id')
    def perform_create(self, serializer):
        parent = self.parent()
        if parent:
            require_manage(self.request.user, parent)
            if parent.parent_id is not None:
                raise ValidationError('Бул бөлүмгө материалдарды кошуңуз.')
        serializer.save(parent=parent, owner=None if parent else self.request.user)


class MyCourses(generics.ListAPIView):
    permission_classes = [CoursePermission]
    serializer_class = SectionSerializer
    def get_queryset(self):
        return CourseSection.objects.filter(parent__isnull=True, owner=self.request.user).order_by('id')


class SectionDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [CoursePermission]
    serializer_class = SectionSerializer
    queryset = CourseSection.objects.select_related('parent')
    http_method_names = ['get', 'patch', 'put', 'delete', 'head', 'options']
    def perform_update(self, serializer):
        require_manage(self.request.user, serializer.instance)
        serializer.save()
    def perform_destroy(self, instance):
        require_manage(self.request.user, instance)
        if instance.quizzes.exists():
            raise ValidationError('Адегенде курстун тесттерин өчүрүңүз.')
        instance.delete()


class CourseMaterialSerializer(MaterialSerializer):
    topic = serializers.IntegerField(source='section_id', read_only=True)
    topic_title = serializers.CharField(source='section.title', read_only=True)
    class Meta(MaterialSerializer.Meta):
        model = CourseMaterial
        fields = MaterialSerializer.Meta.fields + ['topic', 'topic_title']


class MaterialList(generics.ListCreateAPIView):
    permission_classes = [CoursePermission]
    serializer_class = CourseMaterialSerializer
    def section(self):
        return get_object_or_404(CourseSection.objects.select_related('parent'), pk=self.kwargs['section_id'])
    def get_queryset(self):
        return CourseMaterial.objects.filter(section=self.section()).select_related('section').order_by('id')
    def perform_create(self, serializer):
        section = self.section()
        require_manage(self.request.user, section)
        if section.parent_id is None:
            raise ValidationError('Материал кошуу үчүн ички бөлүм түзүңүз.')
        files = self.request.FILES.getlist('files')
        with transaction.atomic():
            serializer.save(section=section, **({'file': files[0]} if files else {}))
            for file in files[1:]:
                CourseMaterial.objects.create(section=section, file=file)


class CourseMaterials(generics.ListAPIView):
    """All materials of a course across its topics."""
    permission_classes = [CoursePermission]
    serializer_class = CourseMaterialSerializer
    def get_queryset(self):
        course = get_course(self.kwargs['pk'])
        return CourseMaterial.objects.filter(section__parent=course).select_related('section').order_by('section_id', 'id')


class MaterialDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [CoursePermission]
    serializer_class = CourseMaterialSerializer
    queryset = CourseMaterial.objects.select_related('section', 'section__parent')
    def perform_update(self, serializer):
        require_manage(self.request.user, serializer.instance.section)
        files = self.request.FILES.getlist('files')
        serializer.save(**({'file': files[0]} if files else {}))
    def perform_destroy(self, instance):
        require_manage(self.request.user, instance.section)
        instance.delete()


class MaterialFileLink(APIView):
    permission_classes = [CoursePermission]
    def get(self, request, pk):
        material = get_object_or_404(CourseMaterial, pk=pk)
        if not material.file:
            raise Http404
        signature = signing.dumps(pk, salt='course-file')
        return Response({'url': request.build_absolute_uri(f'/api/auth/courses/materials/{pk}/file/?signature={signature}')})


class MaterialFile(APIView):
    permission_classes = [AllowAny]
    def get(self, request, pk):
        try:
            if signing.loads(request.query_params.get('signature', ''), salt='course-file', max_age=300) != pk:
                raise PermissionDenied()
        except signing.BadSignature:
            raise PermissionDenied()
        material = get_object_or_404(CourseMaterial, pk=pk)
        if not material.file:
            raise Http404
        return FileResponse(material.file.open('rb'), as_attachment=True)


class Enrollment(APIView):
    permission_classes = [ApprovedUser]
    def post(self, request, pk):
        course = get_course(pk)
        if course.owner_id == request.user.id:
            raise ValidationError('Өз курсуңузга жазыла албайсыз.')
        try:
            CourseEnrollment.objects.get_or_create(course=course, user=request.user)
        except IntegrityError:
            pass
        return Response({'is_enrolled': True}, status=201)
    def delete(self, request, pk):
        CourseEnrollment.objects.filter(course=get_course(pk), user=request.user).delete()
        return Response(status=204)


class CourseMembers(APIView):
    permission_classes = [CoursePermission]
    def get(self, request, pk):
        course = get_course(pk)
        require_manage(request.user, course)
        rows = course.enrollments.select_related('user').order_by('user__study_number')
        return Response([{'id': row.user.id, 'study_number': row.user.study_number, 'email': row.user.email,
            'military_unit': row.user.military_unit, 'enrolled_at': row.created_at.isoformat()} for row in rows])


class CourseQuizInput(QuizInput):
    deadline = serializers.DateTimeField()
    module = serializers.ChoiceField(choices=[1, 2], error_messages={'invalid_choice': '1 же 2 модулду тандаңыз.', 'required': 'Модулду тандаңыз.'})


def validate_quiz(data, previous_deadline=None):
    serializer = CourseQuizInput(data=data)
    serializer.is_valid(raise_exception=True)
    deadline = serializer.validated_data['deadline']
    if deadline != previous_deadline and deadline <= timezone.now():
        raise ValidationError({'deadline': 'Мөөнөт келечектеги күн болушу керек.'})
    return serializer.validated_data


class CourseQuizList(APIView):
    permission_classes = [ApprovedUser]
    def get(self, request, pk):
        course = get_course(pk)
        if not can_manage(request.user, course) and not is_enrolled(request.user, course):
            raise PermissionDenied('Тесттерди көрүү үчүн курска жазылыңыз.')
        return Response([quiz_data(quiz, request.user) for quiz in course.quizzes.order_by('module', 'deadline', 'id')])
    def post(self, request, pk):
        course = get_course(pk)
        require_manage(request.user, course)
        quiz = TrainingQuiz.objects.create(course=course, **validate_quiz(request.data))
        return Response(quiz_data(quiz, request.user), status=201)


class CourseQuizDetail(APIView):
    permission_classes = [ApprovedUser]
    def quiz(self, request, pk):
        quiz = get_object_or_404(TrainingQuiz.objects.select_related('course'), pk=pk, course__isnull=False)
        require_manage(request.user, quiz.course)
        return quiz
    def get(self, request, pk):
        quiz = self.quiz(request, pk)
        return Response({**quiz_data(quiz, request.user), 'questions': quiz.questions})
    def patch(self, request, pk):
        quiz = self.quiz(request, pk)
        data = {'title': quiz.title, 'duration_seconds': quiz.duration_seconds, 'questions': quiz.questions, 'deadline': quiz.deadline, 'module': quiz.module or 1}
        data.update(request.data)
        for key, value in validate_quiz(data, quiz.deadline).items():
            setattr(quiz, key, value)
        quiz.save(update_fields=['title', 'duration_seconds', 'questions', 'deadline', 'module'])
        return Response(quiz_data(quiz, request.user))
    def delete(self, request, pk):
        quiz = self.quiz(request, pk)
        if quiz.attempts.exists():
            raise ValidationError('Бул тест боюнча аракеттердин тарыхы бар болгондуктан, аны өчүрүүгө болбойт.')
        quiz.delete()
        return Response(status=204)
