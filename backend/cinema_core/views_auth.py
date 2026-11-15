"""
views_auth.py — session-based authentication for the admin frontend.
"""
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status


class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: {username, password}
    Returns: {username, is_staff, is_superuser, csrf_token}
    """
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not username or not password:
            return Response(
                {"error": "username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request, user)

        return Response({
            "username": user.username,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "csrf_token": get_token(request),
        })


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response({"message": "Logged out."})


class AuthStatusView(APIView):
    """
    GET /api/auth/status/
    Returns current session auth state.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            return Response({
                "authenticated": True,
                "is_admin": request.user.is_staff or request.user.is_superuser,
                "username": request.user.username,
            })
        return Response({
            "authenticated": False,
            "is_admin": False,
            "username": None,
        })
