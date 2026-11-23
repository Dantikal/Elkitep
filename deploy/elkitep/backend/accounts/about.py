from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from .models import AboutApp, AboutTeamPhoto


class AboutAnonThrottle(AnonRateThrottle):
    # Бөлүм сайттын ачык барагында да көрсөтүлөт, ошондуктан лимит жалпы лимиттен жогору.
    rate = "600/hour"


class PublicAboutMixin:
    """«Тиркеме жөнүндө» — ачык маалымат: мобилдик тиркемеде да, сайтта да кирбестен көрүнөт."""
    permission_classes = [AllowAny]
    throttle_classes = [AboutAnonThrottle]


class AboutView(PublicAboutMixin, APIView):
    def get(self, request):
        about = AboutApp.load()
        return Response({
            "title": about.title,
            "team_title": about.team_title,
            "members": [{
                "id": m.id,
                "role": m.role,
                "full_name": m.full_name,
                "position": m.position,
                "has_photo": bool(m.image),
            } for m in about.members.all()[:3]],
        })


class AboutPhotoView(PublicAboutMixin, APIView):
    def get(self, request, pk):
        photo = get_object_or_404(AboutTeamPhoto, pk=pk)
        if not photo.image:
            raise Http404
        return FileResponse(photo.image.open("rb"))
