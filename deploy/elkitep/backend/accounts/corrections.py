from rest_framework import generics, serializers
from rest_framework.permissions import BasePermission
from .models import PhysicalCorrection


class CorrectionPermission(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and
                    (request.user.is_superuser or request.user.status == 'approved'))


class CorrectionSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(min_value=1, max_value=120)
    altitude = serializers.IntegerField(min_value=0, max_value=9000)
    clothing_number = serializers.IntegerField(min_value=1, max_value=32767, required=False, allow_null=True)
    exercise_number = serializers.IntegerField(min_value=1, max_value=32767)

    class Meta:
        model = PhysicalCorrection
        fields = ['id', 'age', 'altitude', 'sportswear', 'clothing_number',
                  'equipment', 'exercise_number', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        if attrs.get('sportswear', False):
            attrs['clothing_number'] = None
        elif attrs.get('clothing_number') is None:
            raise serializers.ValidationError({'clothing_number': 'Кийимдин номерин киргизиңиз.'})
        return attrs


class CorrectionList(generics.ListCreateAPIView):
    permission_classes = [CorrectionPermission]
    serializer_class = CorrectionSerializer

    def get_queryset(self):
        return PhysicalCorrection.objects.filter(user=self.request.user).order_by('-created_at', '-id')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
