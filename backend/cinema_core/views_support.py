"""
views_support.py — public contact/support form endpoint.
POST /api/contact/ — creates a SupportTicket in the database.
"""
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .models import SupportTicket


class ContactView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").strip()
        message = request.data.get("message", "").strip()

        if not all([name, email, message]):
            return Response(
                {"error": "name, email, and message are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ticket = SupportTicket.objects.create(
            name=name,
            email=email,
            message=message,
        )

        return Response({
            "id": ticket.id,
            "message": "Your message has been received. We will get back to you shortly.",
        }, status=status.HTTP_201_CREATED)
