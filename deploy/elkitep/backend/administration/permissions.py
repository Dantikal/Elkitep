from rest_framework.permissions import BasePermission

class IsAdministrator(BasePermission):
    message = 'Бул бөлүм администратор үчүн гана жеткиликтүү.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
