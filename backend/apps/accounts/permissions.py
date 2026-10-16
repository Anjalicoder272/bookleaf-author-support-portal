from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    message = "Only BookLeaf admins can do this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAuthor(BasePermission):
    message = "Only authors can do this."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_admin
            and hasattr(request.user, "author")
        )
