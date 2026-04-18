from rest_framework.permissions import BasePermission


class IsStaffOrSuperuser(BasePermission):
    """Staff (is_staff=True) or superuser (is_superuser=True) only."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.is_staff or request.user.is_superuser)
        )


class IsSuperuser(BasePermission):
    """Superuser (is_superuser=True) only."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_superuser
        )
