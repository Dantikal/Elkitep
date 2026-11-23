from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers
from .models import User
from .units import MILITARY_UNITS

class RegistrationSerializer(serializers.ModelSerializer):
    military_unit = serializers.ChoiceField(choices=MILITARY_UNITS)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    photo = serializers.ImageField(required=True)
    training_category = serializers.ChoiceField(choices=User._meta.get_field('training_category').choices, required=True)
    class Meta:
        model = User
        fields = ["email", "study_number", "military_unit", "photo", "password", "training_category", "role"]
    def validate_email(self, value):
        value = value.strip().lower()
        if value.split("@")[-1] != "gmail.com":
            raise serializers.ValidationError("Gmail дарегин киргизиңиз.")
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Бул Gmail мурун катталган.")
        return value
    def validate_photo(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Сүрөт 5 МБ ашпашы керек.")
        if value.image.format not in ("JPEG", "PNG", "WEBP"):
            raise serializers.ValidationError("JPEG, PNG же WebP сүрөтүн тандаңыз.")
        return value
    def validate(self, attrs):
        if attrs.get('role') in ('doctor', 'deputy', 'course_head'):
            attrs['training_category'] = 'officers'
        try:
            validate_password(attrs["password"], User(email=attrs["email"], username=attrs["email"]))
        except ValidationError as error:
            raise serializers.ValidationError({"password": error.messages})
        return attrs
    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(username=validated_data["email"], password=password, is_active=False, **validated_data)

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "study_number", "military_unit", "is_superuser", "training_category", "role"]
