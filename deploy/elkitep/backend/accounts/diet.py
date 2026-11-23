from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import BasePermission
from .models import DietProfile, DietSubmission, DoctorReply

class ApprovedPermission(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and (request.user.is_superuser or request.user.status == 'approved'))

class DietAPIView(APIView):
    permission_classes = [ApprovedPermission]

GOALS = ['Булчуңдарды чоңойтуу', 'Арыктоо, майды азайтуу', 'Күчтү көбөйтүү', 'Денени чыңдоо', 'Чыдамкайлыкты жогорулатуу']
class DietSerializer(serializers.Serializer):
    gender = serializers.ChoiceField(choices=['Эркек', 'Аял'])
    age = serializers.IntegerField(min_value=1, max_value=120)
    height = serializers.FloatField(min_value=30, max_value=300)
    weight = serializers.FloatField(min_value=1, max_value=500)
    goals = serializers.ListField(child=serializers.ChoiceField(choices=GOALS), allow_empty=False)
    experience = serializers.ChoiceField(choices=['Жаңы баштадым', 'Бир нече ай', '1 жыл жана андан ашык'])
    location = serializers.ChoiceField(choices=['Спорт залда', 'Үйдө', 'Спорт аянтчасында'])
    frequency = serializers.ChoiceField(choices=['2 жолу', '3–4 жолу', 'Күндө'])
    chronic = serializers.BooleanField()
    chronic_details = serializers.CharField(required=False, allow_blank=True, max_length=3000)
    def validate(self, data):
        if data['chronic'] and not data.get('chronic_details', '').strip():
            raise serializers.ValidationError({'chronic_details': 'Кандай оору экенин жазыңыз.'})
        if not data['chronic']:
            data['chronic_details'] = ''
        return data

def doctor(request):
    if request.user.role != 'doctor':
        raise PermissionDenied()

def submission(request, pk):
    doctor(request)
    return get_object_or_404(DietSubmission.objects.select_related('user'), pk=pk, military_unit=request.user.military_unit)

def reply_data(reply):
    return {'id': reply.id, 'text': reply.text, 'created_at': reply.created_at, 'doctor': reply.doctor.study_number}

class DietView(DietAPIView):
    def get(self, request):
        profile = DietProfile.objects.filter(user=request.user).first()
        if profile is None:
            return Response(status=204)
        return Response(profile.data)
    @transaction.atomic
    def post(self, request):
        serializer = DietSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        DietProfile.objects.update_or_create(user=request.user, defaults={'data': serializer.validated_data})
        if request.query_params.get('send') == '1':
            DietSubmission.objects.create(user=request.user, military_unit=request.user.military_unit, data=serializer.validated_data)
        return Response(serializer.validated_data)

class PatientList(DietAPIView):
    def get(self, request):
        doctor(request)
        items = DietSubmission.objects.filter(military_unit=request.user.military_unit).select_related('user').order_by('-created_at')
        return Response([{'id': x.id, 'study_number': x.user.study_number, 'has_photo': bool(x.user.photo), 'unread': x.read_at is None, 'created_at': x.created_at} for x in items])

class PatientDetail(DietAPIView):
    def get(self, request, pk):
        item = submission(request, pk)
        DietSubmission.objects.filter(pk=pk, read_at__isnull=True).update(read_at=timezone.now())
        return Response({'id': item.id, 'study_number': item.user.study_number, 'data': item.data, 'replies': [reply_data(r) for r in item.replies.select_related('doctor').order_by('created_at')]})
    def post(self, request, pk):
        item = submission(request, pk)
        field = serializers.CharField(max_length=5000)
        text = field.run_validation(request.data.get('text'))
        reply = DoctorReply.objects.create(submission=item, doctor=request.user, text=text)
        return Response(reply_data(reply), status=201)

class PatientPhoto(DietAPIView):
    def get(self, request, pk):
        item = submission(request, pk)
        if not item.user.photo:
            raise Http404
        return FileResponse(item.user.photo.open('rb'))

class RepliesView(DietAPIView):
    def get(self, request):
        return Response([reply_data(r) for r in DoctorReply.objects.filter(submission__user=request.user).select_related('doctor').order_by('-created_at')])
    def post(self, request):
        DoctorReply.objects.filter(submission__user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=204)

class DietNotifications(DietAPIView):
    def get(self, request):
        count = DietSubmission.objects.filter(military_unit=request.user.military_unit, read_at__isnull=True).count() if request.user.role == 'doctor' else DoctorReply.objects.filter(submission__user=request.user, read_at__isnull=True).count()
        return Response({'unread': count})
