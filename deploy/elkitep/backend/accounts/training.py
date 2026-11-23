from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers
from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.views import APIView
from .models import TrainingTopic, TrainingSubjectTopic, TrainingMaterial

MONTHS = (12, 1, 2, 3, 4, 6, 7, 8, 9, 10)

class TrainingPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user.is_authenticated and (user.is_superuser or (request.method in SAFE_METHODS and user.status == 'approved')))

class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingTopic
        fields = ['id', 'section', 'category', 'month', 'title']
    def validate_month(self, value):
        if value not in MONTHS:
            raise serializers.ValidationError('Окуу мезгилиндеги айды тандаңыз.')
        return value

class MaterialSerializer(serializers.ModelSerializer):
    has_file = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    class Meta:
        model = TrainingMaterial
        fields = ['id', 'text', 'links', 'file', 'has_file', 'file_name']
        extra_kwargs = {'file': {'write_only': True}}
    def get_has_file(self, obj):
        return bool(obj.file)
    def get_file_name(self, obj):
        return obj.file.name.rsplit('/', 1)[-1] if obj.file else ''
    def validate_links(self, value):
        if not isinstance(value, list) or len(value) > 50:
            raise serializers.ValidationError('Шилтемелердин тизмесин киргизиңиз (50гө чейин).')
        from django.core.validators import URLValidator
        field = serializers.CharField(validators=[URLValidator(schemes=['http', 'https'])])
        return [field.run_validation(link) for link in value]
    def validate(self, attrs):
        if self.instance and self.partial:
            return attrs
        if not (attrs.get('text', '').strip() or attrs.get('links') or attrs.get('file') or self.context['request'].FILES.getlist('files')):
            raise serializers.ValidationError('Текст, шилтеме же файл кошуңуз.')
        return attrs

class TopicList(generics.ListCreateAPIView):
    permission_classes = [TrainingPermission]
    serializer_class = TopicSerializer
    def get_queryset(self):
        return TrainingTopic.objects.filter(month=self.kwargs['month'], category=self.kwargs.get('category', 'officers'), section=self.kwargs.get('section', 'command')).order_by('id')
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data['month'] = self.kwargs['month']
        data['section'] = self.kwargs.get('section', 'command')
        data['category'] = self.kwargs.get('category', 'officers')
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        from rest_framework.response import Response
        return Response(serializer.data, status=201)

class TopicDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [TrainingPermission]
    serializer_class = TopicSerializer
    queryset = TrainingTopic.objects.all()
    lookup_url_kwarg = 'topic_id'
    def perform_destroy(self, instance):
        if instance.quizzes.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Бул предметке тесттер байланып турат. Адегенде тесттерди өчүрүңүз.')
        instance.delete()

class SubjectTopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSubjectTopic
        fields = ['id', 'subject', 'title']
        read_only_fields = ['subject']

class SubjectTopicList(generics.ListCreateAPIView):
    permission_classes = [TrainingPermission]
    serializer_class = SubjectTopicSerializer
    def get_queryset(self):
        return TrainingSubjectTopic.objects.filter(subject_id=self.kwargs['subject_id']).order_by('id')
    def perform_create(self, serializer):
        subject = get_object_or_404(TrainingTopic, pk=self.kwargs['subject_id'])
        serializer.save(subject=subject)

class SubjectTopicDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [TrainingPermission]
    serializer_class = SubjectTopicSerializer
    queryset = TrainingSubjectTopic.objects.all()

class MaterialList(generics.ListCreateAPIView):
    permission_classes = [TrainingPermission]
    serializer_class = MaterialSerializer
    def get_queryset(self):
        return TrainingMaterial.objects.filter(topic_id=self.kwargs['topic_id']).order_by('id')
    def perform_create(self, serializer):
        from django.db import transaction
        topic = get_object_or_404(TrainingTopic, pk=self.kwargs['topic_id'])
        files = self.request.FILES.getlist('files')
        with transaction.atomic():
            serializer.save(topic=topic, **({'file': files[0]} if files else {}))
            for file in files[1:]:
                TrainingMaterial.objects.create(topic=topic, file=file)

class MaterialDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [TrainingPermission]
    serializer_class = MaterialSerializer
    queryset = TrainingMaterial.objects.all()
    def perform_update(self, serializer):
        files = self.request.FILES.getlist('files')
        serializer.save(**({'file': files[0]} if files else {}))

class SubjectTopicMaterialList(MaterialList):
    def get_queryset(self):
        return TrainingMaterial.objects.filter(subject_topic_id=self.kwargs['subject_topic_id']).order_by('id')
    def perform_create(self, serializer):
        from django.db import transaction
        nested_topic = get_object_or_404(TrainingSubjectTopic, pk=self.kwargs['subject_topic_id'])
        files = self.request.FILES.getlist('files')
        with transaction.atomic():
            serializer.save(topic=nested_topic.subject, subject_topic=nested_topic, **({'file': files[0]} if files else {}))
            for file in files[1:]:
                TrainingMaterial.objects.create(topic=nested_topic.subject, subject_topic=nested_topic, file=file)

class MaterialFileLink(APIView):
    permission_classes = [TrainingPermission]
    def get(self, request, pk):
        from django.core import signing
        from rest_framework.response import Response
        material = get_object_or_404(TrainingMaterial, pk=pk)
        if not material.file:
            from django.http import Http404
            raise Http404
        signature = signing.dumps(pk, salt='training-file')
        url = request.build_absolute_uri(f'/api/auth/training/materials/{pk}/file/?signature={signature}')
        return Response({'url': url})

class MaterialFile(APIView):
    from rest_framework.permissions import AllowAny
    permission_classes = [AllowAny]
    def get(self, request, pk):
        from django.core import signing
        from rest_framework.exceptions import PermissionDenied
        try:
            signed_pk = signing.loads(request.query_params.get('signature', ''), salt='training-file', max_age=300)
            if signed_pk != pk:
                raise PermissionDenied()
        except signing.BadSignature:
            raise PermissionDenied()
        material = get_object_or_404(TrainingMaterial, pk=pk)
        if not material.file:
            from django.http import Http404
            raise Http404
        return FileResponse(material.file.open('rb'), as_attachment=True)
