"""
test_availability.py — FEAT-004
Tests for show availability and seat holds.
"""

import uuid
from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from cinema_core.models import Cinema, CinemaSeat, Movie, SeatReservation, Show


class ShowAvailabilityTests(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.cinema = Cinema.objects.create(
            name="Avail Cinema",
            location="Loc",
            city="City",
            total_seats=50,
            is_active=True,
        )
        self.movie = Movie.objects.create(
            title="Test Movie",
            genre="Drama",
            is_active=True,
        )
        self.show = Show.objects.create(
            cinema=self.cinema,
            movie=self.movie,
            show_date=date.today() + timedelta(days=1),
            show_time="18:00",
            ticket_price=200,
            seats_available=50,
        )

        # Create 3 seats.
        self.seat1 = CinemaSeat.objects.create(
            cinema=self.cinema,
            row="A",
            seat_number=1,
            category=CinemaSeat.Category.SILVER,
            price_multiplier=1.0,
        )
        self.seat2 = CinemaSeat.objects.create(
            cinema=self.cinema,
            row="A",
            seat_number=2,
            category=CinemaSeat.Category.SILVER,
            price_multiplier=1.0,
        )
        self.seat3 = CinemaSeat.objects.create(
            cinema=self.cinema,
            row="A",
            seat_number=3,
            category=CinemaSeat.Category.SILVER,
            price_multiplier=1.0,
        )

    def test_availability_returns_all_seats(self):
        response = self.client.get(f"/api/shows/{self.show.id}/availability/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["seats"]), 3)

    def test_hold_creates_reservation(self):
        response = self.client.post(
            f"/api/shows/{self.show.id}/hold/",
            {"seat_ids": [self.seat1.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            SeatReservation.objects.filter(
                show=self.show,
                status=SeatReservation.Status.HELD,
            ).count(),
            1,
        )

    def test_hold_prevents_double_booking(self):
        # First hold.
        self.client.post(
            f"/api/shows/{self.show.id}/hold/",
            {"seat_ids": [self.seat1.id]},
            format="json",
        )
        # Second hold for the same seat.
        response = self.client.post(
            f"/api/shows/{self.show.id}/hold/",
            {"seat_ids": [self.seat1.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 409)

    def test_expired_hold_is_released(self):
        # Manually create an expired hold.
        SeatReservation.objects.create(
            show=self.show,
            seat=self.seat1,
            status=SeatReservation.Status.HELD,
            expires_at=timezone.now() - timedelta(minutes=10),
            hold_token=uuid.uuid4(),
        )

        # GET availability triggers cleanup of expired holds.
        response = self.client.get(f"/api/shows/{self.show.id}/availability/")
        self.assertEqual(response.status_code, 200)

        # The expired seat should appear as 'available'.
        statuses = {s["id"]: s["status"] for s in response.data["seats"]}
        self.assertEqual(statuses[self.seat1.id], "available")

    def test_hold_validates_seat_belongs_to_show_cinema(self):
        # Create a seat in a different cinema.
        other_cinema = Cinema.objects.create(
            name="Other Cinema",
            location="Elsewhere",
            city="Other City",
            total_seats=20,
            is_active=True,
        )
        foreign_seat = CinemaSeat.objects.create(
            cinema=other_cinema,
            row="Z",
            seat_number=1,
            category=CinemaSeat.Category.SILVER,
            price_multiplier=1.0,
        )

        response = self.client.post(
            f"/api/shows/{self.show.id}/hold/",
            {"seat_ids": [foreign_seat.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
