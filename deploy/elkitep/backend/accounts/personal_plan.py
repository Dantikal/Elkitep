from django.db import transaction
from django.db.models import Max
from rest_framework import generics, serializers
from .corrections import CorrectionPermission
from .models import PersonalTrainingDay, User


class ActivitySerializer(serializers.Serializer):
    action = serializers.CharField(max_length=500)
    until = serializers.CharField(max_length=200)

    def validate(self, attrs):
        if not attrs.get('action') or not attrs.get('until'):
            raise serializers.ValidationError('Эки талааны тең толтуруңуз.')
        return attrs


class DaySerializer(serializers.ModelSerializer):
    activities = ActivitySerializer(many=True, max_length=200, required=False)

    class Meta:
        model = PersonalTrainingDay
        fields = ['id', 'number', 'activities']
        read_only_fields = ['id', 'number']


class DayList(generics.ListCreateAPIView):
    permission_classes = [CorrectionPermission]
    serializer_class = DaySerializer

    def get_queryset(self):
        return PersonalTrainingDay.objects.filter(user=self.request.user).order_by('number')

    def perform_create(self, serializer):
        with transaction.atomic():
            User.objects.select_for_update().get(pk=self.request.user.pk)
            last = self.get_queryset().aggregate(last=Max('number'))['last'] or 0
            serializer.save(user=self.request.user, number=last + 1)


class DayDetail(generics.RetrieveUpdateAPIView):
    permission_classes = [CorrectionPermission]
    serializer_class = DaySerializer
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        return PersonalTrainingDay.objects.filter(user=self.request.user)
