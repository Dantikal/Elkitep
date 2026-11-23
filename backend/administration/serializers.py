from rest_framework import serializers
from accounts.models import User

class ApplicationSerializer(serializers.ModelSerializer):
    has_photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'study_number', 'military_unit', 'status', 'date_joined', 'has_photo', 'training_category', 'role']

    def get_has_photo(self, obj):
        return bool(obj.photo)

class DecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['approved', 'rejected'])
