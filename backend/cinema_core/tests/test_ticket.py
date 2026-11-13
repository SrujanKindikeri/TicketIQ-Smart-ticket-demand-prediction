"""
test_ticket.py — FEAT-004
Tests for the ticket verification endpoint (no PII exposure).
"""

import uuid
from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from cinema_core.models import (
    Booking,
    BookingSeat,
    Cinema,
    CinemaSeat,
    Movie,
    Show,
)


def _make_confirmed_booking():
    """
    Create a confirmed Booking with BookingSeat records.
    Returns (booking, show, cinema).
    """
    cinema = Cinema.objects.create(
        name="Ticket Cinema",
        location="Anywhere",
        city="Delhi",
        total_seats=100,
        is_active=True,
    )
    movie = Movie.objects.create(
        title="Ticket Movie",
        genre="Thriller",
        is_active=True,
    )
    show = Show.objects.create(
        cinema=cinema,
        movie=movie,
        show_date=date.today() + timedelta(days=5),
        show_time="21:00",
        ticket_price=250,
        seats_available=100,
    )
    seat = CinemaSeat.objects.create(
        cinema=cinema,
        row="C",
        seat_number=1,
        category=CinemaSeat.Category.PREMIUM,
        price_multiplier=1.60,
    )
    booking = Booking.objects.create(
        show=show,
        customer_name="Frank Miller",
        customer_email="frank@example.com",
        customer_phone="8888888888",
        tickets_count=1,
        total_amount=400,
        status=Booking.Status.CONFIRMED,
        payment_status="paid",
    )
    BookingSeat.objects.create(
        booking=booking,
        seat=seat,
        price_at_booking=400,
    )
    return booking, show, cinema


class TicketVerifyTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.booking, self.show, self.cinema = _make_confirmed_booking()

    def test_verify_booking_reference_returns_no_pii(self):
        response = self.client.get(
            f"/api/bookings/{self.booking.booking_reference}/verify/"
        )
        self.assertEqual(response.status_code, 200)
        # PII fields must not be present in the response.
        self.assertNotIn("customer_email", response.data)
        self.assertNotIn("customer_phone", response.data)
        self.assertNotIn("customer_name", response.data)

    def test_verify_nonexistent_ref_returns_404(self):
        fake_ref = "00000000-0000-0000-0000-000000000000"
        response = self.client.get(f"/api/bookings/{fake_ref}/verify/")
        self.assertEqual(response.status_code, 404)
