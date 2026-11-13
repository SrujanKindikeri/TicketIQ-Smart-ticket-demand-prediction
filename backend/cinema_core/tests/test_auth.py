"""
test_auth.py — FEAT-004
Tests for permission enforcement on protected endpoints.
"""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from cinema_core.models import Cinema, CinemaSeat, Movie, Booking, Show


class AuthPermissionTests(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.cinema = Cinema.objects.create(
            name="Auth Cinema",
            location="Somewhere",
            city="Pune",
            total_seats=80,
            is_active=True,
        )
        self.movie = Movie.objects.create(
            title="Auth Movie",
            genre="Comedy",
            is_active=True,
        )
        self.show = Show.objects.create(
            cinema=self.cinema,
            movie=self.movie,
            show_date=date.today() + timedelta(days=3),
            show_time="15:00",
            ticket_price=150,
            seats_available=80,
        )

    def test_admin_bookings_requires_staff(self):
        # Anonymous request must be rejected.
        response = self.client.get("/api/admin/bookings/")
        self.assertEqual(response.status_code, 403)

    def test_my_bookings_returns_only_own(self):
        # Create a regular user and two bookings with different emails.
        regular_user = User.objects.create_user(
            username="regular_user_auth",
            password="pass",
            email="user1@example.com",
        )
        self.client.force_login(regular_user)

        # Booking for email1.
        Booking.objects.create(
            show=self.show,
            customer_name="User One",
            customer_email="email1@example.com",
            customer_phone="1111111111",
            tickets_count=1,
            total_amount=150,
            status=Booking.Status.CONFIRMED,
        )
        # Booking for email2.
        Booking.objects.create(
            show=self.show,
            customer_name="User Two",
            customer_email="email2@example.com",
            customer_phone="2222222222",
            tickets_count=1,
            total_amount=150,
            status=Booking.Status.CONFIRMED,
        )

        response = self.client.get("/api/bookings/my/?email=email1@example.com")
        self.assertEqual(response.status_code, 200)

        results = response.data.get("results", response.data)
        for booking in results:
            self.assertNotEqual(booking["customer_email"], "email2@example.com")

    def test_seat_generate_requires_staff(self):
        # Anonymous POST to generate must be rejected.
        response = self.client.post("/api/seats/generate/", {
            "cinema": self.cinema.id,
            "rows": 3,
            "seats_per_row": 5,
        }, format="json")
        self.assertEqual(response.status_code, 403)
