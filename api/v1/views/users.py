from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.conf import settings
import os

class CurrentUserView(APIView):
    """
    Returns data about the currently authenticated user.
    """
    def get_permissions(self):
        if settings.DEBUG or os.getenv("DJANGO_PUBLIC_API", "False").lower() in {"1", "true", "yes"}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get(self, request):
        user = request.user
        if not user or user.is_anonymous:
            # For development with DJANGO_PUBLIC_API, return a dummy admin user
            if settings.DEBUG or os.getenv("DJANGO_PUBLIC_API", "False").lower() in {"1", "true", "yes"}:
                return Response({
                    "id": 0,
                    "username": "dev_admin",
                    "is_staff": True,
                    "is_superuser": True
                })
            return Response({"error": "Not authenticated"}, status=401)
        
        return Response({
            "id": user.id,
            "username": user.username,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser
        })
