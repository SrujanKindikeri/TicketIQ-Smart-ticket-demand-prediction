"""
test_seats.py — FEAT-004
Tests for seat generation via POST /api/seats/generate/.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from cinema_core.models import Cinema, CinemaSeat


class SeatGenerationTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_seats",
            password="testpass",
            email="admin_seats@example.com",
        )
        self.client.force_login(self.admin)

        self.cinema = Cinema.objects.create(
            name="Test Cinema",
            location="Loc",
            city="City",
            total_seats=100,
            is_active=True,
        )

    def test_seat_generation_creates_correct_count(self):
        response = self.client.post("/api/seats/generate/", {
            "cinema": self.cinema.id,
            "rows": 5,
            "seats_per_row": 10,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created_seats"], 50)

    def test_seat_generation_is_idempotent(self):
        # First call.
        self.client.post("/api/seats/generate/", {
            "cinema": self.cinema.id,
            "rows": 5,
            "seats_per_row": 10,
        }, format="json")

        # Second call with same params must create 0 new seats.
        response = self.client.post("/api/seats/generate/", {
            "cinema": self.cinema.id,
            "rows": 5,
            "seats_per_row": 10,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created_seats"], 0)

    def test_seat_requires_valid_cinema(self):
        response = self.client.post("/api/seats/generate/", {
            "cinema": 99999,
            "rows": 5,
            "seats_per_row": 10,
        }, format="json")
        self.assertEqual(response.status_code, 404)
