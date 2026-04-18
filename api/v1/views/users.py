from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from rest_framework.authentication import SessionAuthentication
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User


class RegisterView(APIView):
    """
    Self-registration endpoint.

    Disabled by default — user accounts are provisioned via Django admin.
    To enable, set ALLOW_SELF_REGISTRATION = True in settings.py.

    Future implementation notes:
      - Validate username uniqueness
      - Enforce password strength rules
      - Optionally send a verification email
      - Return the same user payload as LoginView on success
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not getattr(settings, 'ALLOW_SELF_REGISTRATION', False):
            return Response(
                {
                    "message": "Self-registration is not enabled. Contact your administrator.",
                    "code": "REGISTRATION_DISABLED",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # ── Future implementation ──────────────────────────────────────────────
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        email = request.data.get('email', '').strip()

        if not username or not password:
            return Response(
                {"error": "Username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already taken"},
                status=status.HTTP_409_CONFLICT,
            )

        user = User.objects.create_user(username=username, password=password, email=email)
        login(request, user)
        return Response({
            "id": user.id,
            "username": user.username,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "message": "Account created successfully",
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    Login endpoint for session-based authentication.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {"error": "Username and password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return Response({
                "id": user.id,
                "username": user.username,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "message": "Login successful"
            })
        else:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )


class LogoutView(APIView):
    """
    Logout endpoint.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logout(request)
        return Response({"message": "Logout successful"})


class CurrentUserView(APIView):
    """
    Returns data about the currently authenticated user.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user
        if not user or user.is_anonymous:
            return Response({"error": "Not authenticated"}, status=401)

        return Response({
            "id": user.id,
            "username": user.username,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser
        })
