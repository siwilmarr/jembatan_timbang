from rest_framework import permissions

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow Admins to edit or delete transactions.
    Operators can only read or create (sync).
    """
    def has_permission(self, request, view):
        # 1. Pastikan user sudah terotentikasi
        if not request.user or not request.user.is_authenticated:
            return False
            
        # 2. Metode aman (GET, HEAD, OPTIONS) dibolehkan untuk semua user terotentikasi
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # 3. Metode POST (sync / input) dibolehkan untuk semua user terotentikasi (termasuk Operator)
        if request.method == 'POST':
            return True

        # 4. Metode perubahan (PUT, PATCH, DELETE) dibatasi hanya untuk Admin / Superuser
        is_admin = request.user.is_superuser or request.user.groups.filter(name="Admin").exists()
        return is_admin


class IsAdminOrReadOnlyMaster(permissions.BasePermission):
    """
    Custom permission to only allow Admins to perform write operations on master data.
    All authenticated users can perform read operations (SAFE_METHODS).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        is_admin = request.user.is_superuser or request.user.groups.filter(name="Admin").exists()
        return is_admin


class IsAdminUserOnly(permissions.BasePermission):
    """
    Custom permission to only allow Admins/Superusers access to user management APIs.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        is_admin = request.user.is_superuser or request.user.groups.filter(name="Admin").exists()
        return is_admin
