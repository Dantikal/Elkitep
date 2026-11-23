import os
from django.core import signing
from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from PIL import Image, UnidentifiedImageError
from rest_framework import generics, serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Achievement, AchievementFile

MAX_FILES = 10
MAX_FILE_SIZE = 10 * 1024 * 1024
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
SALT = 'achievement-file'


class ApprovedUser(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user.is_authenticated and (user.is_superuser or user.status == 'approved'))


def classify(upload):
    """Файлдын түрүн мазмуну боюнча текшерет: PDF же сүрөт гана кабыл алынат."""
    if upload.size > MAX_FILE_SIZE:
        raise ValidationError({'files': f'«{upload.name}» файлы 10 МБдан ашпашы керек.'})
    extension = os.path.splitext(upload.name)[1].lower()
    head = upload.read(5)
    upload.seek(0)
    if head == b'%PDF-':
        return 'pdf'
    if extension in IMAGE_EXTENSIONS:
        if extension in {'.heic', '.heif'}:
            return 'image'
        try:
            Image.open(upload).verify()
            upload.seek(0)
            return 'image'
        except (UnidentifiedImageError, OSError, SyntaxError):
            pass
    raise ValidationError({'files': f'«{upload.name}»: PDF же сүрөт гана жүктөөгө болот.'})


class AchievementSerializer(serializers.ModelSerializer):
    files = serializers.SerializerMethodField()

    class Meta:
        model = Achievement
        fields = ['id', 'text', 'files', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_files(self, obj):
        return [{'id': f.id, 'kind': f.kind, 'name': f.name} for f in obj.files.all()]


class AchievementList(generics.ListCreateAPIView):
    permission_classes = [ApprovedUser]
    serializer_class = AchievementSerializer

    def get_queryset(self):
        return Achievement.objects.filter(user=self.request.user).prefetch_related('files')

    def perform_create(self, serializer):
        uploads = self.request.FILES.getlist('files')
        text = serializer.validated_data.get('text', '').strip()
        if not text and not uploads:
            raise ValidationError({'text': 'Текст, сүрөт же PDF кошуңуз.'})
        if len(uploads) > MAX_FILES:
            raise ValidationError({'files': f'Бир жолу {MAX_FILES} файлга чейин жүктөөгө болот.'})
        kinds = [classify(upload) for upload in uploads]
        with transaction.atomic():
            achievement = serializer.save(user=self.request.user, text=text)
            for upload, kind in zip(uploads, kinds):
                AchievementFile.objects.create(achievement=achievement, file=upload, kind=kind, name=os.path.basename(upload.name)[:255])


class AchievementDetail(generics.DestroyAPIView):
    permission_classes = [ApprovedUser]

    def get_queryset(self):
        return Achievement.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        stored = [f.file for f in instance.files.all()]
        instance.delete()
        for file in stored:
            file.delete(save=False)


def own_file(request, pk):
    return get_object_or_404(AchievementFile.objects.select_related('achievement'), pk=pk, achievement__user=request.user)


class AchievementFileView(APIView):
    """Колдонуучунун өз файлы (токен менен): тиркемедеги сүрөттөрдү көрсөтүү үчүн."""
    permission_classes = [ApprovedUser]

    def get(self, request, pk):
        item = own_file(request, pk)
        return FileResponse(item.file.open('rb'), filename=item.name)


class AchievementFileLink(APIView):
    """PDFти тышкы программада ачуу үчүн 5 мүнөттүк кол коюлган шилтеме."""
    permission_classes = [ApprovedUser]

    def get(self, request, pk):
        item = own_file(request, pk)
        signature = signing.dumps(item.pk, salt=SALT)
        return Response({'url': request.build_absolute_uri(f'/api/auth/achievements/files/{item.pk}/signed/?signature={signature}')})


class AchievementSignedFile(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            if signing.loads(request.query_params.get('signature', ''), salt=SALT, max_age=300) != pk:
                raise PermissionDenied()
        except signing.BadSignature:
            raise PermissionDenied()
        item = get_object_or_404(AchievementFile, pk=pk)
        if not item.file:
            raise Http404
        return FileResponse(item.file.open('rb'), filename=item.name)
