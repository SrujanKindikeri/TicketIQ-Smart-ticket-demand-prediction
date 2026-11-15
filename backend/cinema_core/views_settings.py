"""
views_settings.py — application settings CRUD.
GET  /api/settings/ — returns all settings as a flat {key: value} dict.
PATCH /api/settings/ — upserts each key-value pair.
"""
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .models import AppSetting


class AppSettingsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        settings = {s.key: s.value for s in AppSetting.objects.all()}
        return Response(settings)

    def patch(self, request):
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"error": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for key, value in data.items():
            AppSetting.objects.update_or_create(
                key=key,
                defaults={"value": str(value)},
            )
        return Response({"saved": list(data.keys())})
