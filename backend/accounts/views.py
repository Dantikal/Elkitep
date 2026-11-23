from django.contrib.auth import authenticate
from django.http import FileResponse, Http404
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from .models import User
from .serializers import RegistrationSerializer, ProfileSerializer

class RegisterView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [AllowAny]
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Өтүнмө жөнөтүлдү. Администратордун макулдугун күтүңүз."}, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        email, password = request.data.get("email"), request.data.get("password")
        if not isinstance(email, str) or not isinstance(password, str):
            return Response({"detail": "Gmail жана сырсөздү киргизиңиз."}, status=400)
        user = authenticate(request, username=email.strip().lower(), password=password)
        if not user or (not user.is_staff and user.status != "approved"):
            return Response({"detail": "Gmail же сырсөз туура эмес, же өтүнмө азырынча жактырыла элек."}, status=401)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": ProfileSerializer(user).data})

class MeView(APIView):
    def get(self, request):
        return Response(ProfileSerializer(request.user).data)

class PhotoView(APIView):
    def get(self, request):
        if not request.user.photo:
            raise Http404
        return FileResponse(request.user.photo.open("rb"))

class UnitUsersView(APIView):
    def get(self, request):
        if request.user.role != 'deputy':
            raise PermissionDenied()
        users = User.objects.filter(military_unit=request.user.military_unit, status__in=['approved', 'pending']).order_by('study_number')
        return Response([{
            'id': user.id,
            'email': user.email,
            'study_number': user.study_number,
            'role': user.role,
            'training_category': user.training_category,
            'status': user.status,
        } for user in users])

class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=204)
