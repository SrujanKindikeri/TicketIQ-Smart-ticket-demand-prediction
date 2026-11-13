"""
test_booking.py — FEAT-004
Tests for the full booking flow: create, verify payment, cancel, PDF ticket.
"""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from cinema_core.models import (
    Booking,
    BookingSeat,
    Cinema,
    CinemaSeat,
    Movie,
    SeatReservation,
    Show,
)


def _build_show(cinema, movie):
    """Helper: create a Show with the given cinema and movie."""
    return Show.objects.create(
        cinema=cinema,
        movie=movie,
        show_date=date.today() + timedelta(days=2),
        show_time="20:00",
        ticket_price=300,
        seats_available=50,
    )


def _build_seats(cinema):
    """Helper: create 2 seats for the cinema."""
    seat1 = CinemaSeat.objects.create(
        cinema=cinema,
        row="B",
        seat_number=1,
        category=CinemaSeat.Category.GOLD,
        price_multiplier=1.30,
    )
    seat2 = CinemaSeat.objects.create(
        cinema=cinema,
        row="B",
        seat_number=2,
        category=CinemaSeat.Category.GOLD,
        price_multiplier=1.30,
    )
    return seat1, seat2


class BookingFlowTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_booking",
            password="testpass",
            email="admin_booking@example.com",
        )

        self.cinema = Cinema.objects.create(
            name="Booking Cinema",
            location="Downtown",
            city="Mumbai",
            total_seats=100,
            is_active=True,
        )
        self.movie = Movie.objects.create(
            title="Booking Movie",
            genre="Action",
            is_active=True,
        )
        self.show = _build_show(self.cinema, self.movie)
        self.seat1, self.seat2 = _build_seats(self.cinema)

        # Hold 2 seats to get a hold_token.
        hold_response = self.client.post(
            f"/api/shows/{self.show.id}/hold/",
            {"seat_ids": [self.seat1.id, self.seat2.id]},
            format="json",
        )
        self.assertEqual(hold_response.status_code, 201)
        self.hold_token = hold_response.data["session_token"]

    def test_create_booking_from_hold(self):
        response = self.client.post("/api/bookings/create/", {
            "hold_token": self.hold_token,
            "customer_name": "Alice Smith",
            "customer_email": "alice@example.com",
            "customer_phone": "9876543210",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(BookingSeat.objects.count(), 2)

    def test_payment_verify_confirms_booking(self):
        # Create the booking first.
        create_resp = self.client.post("/api/bookings/create/", {
            "hold_token": self.hold_token,
            "customer_name": "Bob Jones",
            "customer_email": "bob@example.com",
            "customer_phone": "1234567890",
        }, format="json")
        self.assertEqual(create_resp.status_code, 201)
        order_id = create_resp.data["razorpay_order_id"]

        # Verify (mock order skips signature check).
        verify_resp = self.client.post("/api/payments/verify/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": "test_pay_id",
            "razorpay_signature": "test_sig",
        }, format="json")
        self.assertEqual(verify_resp.data["success"], True)
        self.assertEqual(
            Booking.objects.get().status,
            Booking.Status.CONFIRMED,
        )

    def test_cancel_releases_seats(self):
        # Create and confirm a booking.
        create_resp = self.client.post("/api/bookings/create/", {
            "hold_token": self.hold_token,
            "customer_name": "Carol White",
            "customer_email": "carol@example.com",
            "customer_phone": "5551234567",
        }, format="json")
        self.assertEqual(create_resp.status_code, 201)
        booking_id = create_resp.data["booking_id"]
        order_id = create_resp.data["razorpay_order_id"]

        # Confirm payment.
        self.client.force_login(self.admin)
        self.client.post("/api/payments/verify/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": "pay_test",
            "razorpay_signature": "sig_test",
        }, format="json")

        # Cancel the booking (admin-only endpoint).
        cancel_resp = self.client.post(f"/api/bookings/{booking_id}/cancel/")
        self.assertEqual(cancel_resp.status_code, 200)

        # Seat reservations with status 'booked' must be gone.
        self.assertEqual(
            SeatReservation.objects.filter(
                show=self.show,
                status=SeatReservation.Status.BOOKED,
            ).count(),
            0,
        )
        # BookingSeat records must be gone.
        self.assertEqual(
            BookingSeat.objects.filter(
                booking__id=booking_id,
            ).count(),
            0,
        )

    def test_cancel_already_cancelled(self):
        # Create booking.
        create_resp = self.client.post("/api/bookings/create/", {
            "hold_token": self.hold_token,
            "customer_name": "Dave Brown",
            "customer_email": "dave@example.com",
            "customer_phone": "0000000000",
        }, format="json")
        self.assertEqual(create_resp.status_code, 201)
        booking_id = create_resp.data["booking_id"]

        self.client.force_login(self.admin)

        # First cancel.
        resp1 = self.client.post(f"/api/bookings/{booking_id}/cancel/")
        self.assertEqual(resp1.status_code, 200)

        # Second cancel — still 200 with a message.
        resp2 = self.client.post(f"/api/bookings/{booking_id}/cancel/")
        self.assertEqual(resp2.status_code, 200)
        self.assertIn("message", resp2.data)

    def test_pdf_ticket_returns_pdf(self):
        # Create and confirm a booking.
        create_resp = self.client.post("/api/bookings/create/", {
            "hold_token": self.hold_token,
            "customer_name": "Eve Green",
            "customer_email": "eve@example.com",
            "customer_phone": "9999999999",
        }, format="json")
        self.assertEqual(create_resp.status_code, 201)
        booking_reference = create_resp.data["booking_reference"]
        order_id = create_resp.data["razorpay_order_id"]

        # Confirm payment.
        self.client.post("/api/payments/verify/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": "pay_pdf_test",
            "razorpay_signature": "sig_pdf_test",
        }, format="json")

        # Request PDF ticket.
        ticket_resp = self.client.get(
            f"/api/bookings/{booking_reference}/ticket/"
        )
        self.assertEqual(ticket_resp.status_code, 200)
        self.assertEqual(ticket_resp["Content-Type"], "application/pdf")
