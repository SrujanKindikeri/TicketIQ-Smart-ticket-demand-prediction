"""
test_booking.py — FEAT-004
Tests for the full booking flow: create, verify payment, cancel, PDF ticket.
"""

import hashlib
import hmac
import os
from datetime import date, timedelta
from unittest.mock import patch

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


class PaymentHMACTests(TestCase):
    """
    Tests for the real HMAC verification path in PaymentVerifyView.
    Uses override_settings to inject a known RAZORPAY_KEY_SECRET so the
    hmac.compare_digest branch is exercised (not just the mock_order_ shortcut).
    """

    def setUp(self):
        self.client = APIClient()
        self.cinema = Cinema.objects.create(
            name="HMAC Cinema",
            location="Test City",
            city="Bangalore",
            total_seats=50,
            is_active=True,
        )
        self.movie = Movie.objects.create(
            title="HMAC Movie",
            genre="Drama",
            is_active=True,
        )
        self.show = Show.objects.create(
            cinema=self.cinema,
            movie=self.movie,
            show_date=date.today() + timedelta(days=3),
            show_time="18:00",
            ticket_price=200,
            seats_available=50,
        )
        self.seat = CinemaSeat.objects.create(
            cinema=self.cinema,
            row="A",
            seat_number=1,
            category=CinemaSeat.Category.SILVER,
            price_multiplier=1.0,
        )

    def _hold_and_create_booking(self, fake_order_id):
        """Hold a seat, create a booking, then patch the payment's order_id
        to look like a real Razorpay order (not a mock_order_ prefix)."""
        from cinema_core.models import Payment

        hold_resp = self.client.post(
            f"/api/shows/{self.show.id}/hold/",
            {"seat_ids": [self.seat.id]},
            format="json",
        )
        self.assertEqual(hold_resp.status_code, 201)
        hold_token = hold_resp.data["session_token"]

        create_resp = self.client.post("/api/bookings/create/", {
            "hold_token": hold_token,
            "customer_name": "Frank Test",
            "customer_email": "frank@example.com",
            "customer_phone": "1111111111",
        }, format="json")
        self.assertEqual(create_resp.status_code, 201)

        # Override the generated mock order_id with our controlled value
        # so PaymentVerifyView takes the real HMAC path.
        payment = Payment.objects.get(booking__booking_reference=create_resp.data["booking_reference"])
        payment.razorpay_order_id = fake_order_id
        payment.save(update_fields=["razorpay_order_id"])

        return create_resp.data["booking_reference"]

    @patch.dict(os.environ, {"RAZORPAY_KEY_SECRET": "testsecret"})
    def test_correct_hmac_confirms_booking(self):
        order_id = "order_TestRealHMAC001"
        payment_id = "pay_TestRealHMAC001"
        secret = "testsecret"

        booking_ref = self._hold_and_create_booking(order_id)

        # Compute the correct signature.
        msg = f"{order_id}|{payment_id}".encode()
        signature = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()

        resp = self.client.post("/api/payments/verify/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        }, format="json")

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["success"])
        self.assertEqual(
            Booking.objects.get(booking_reference=booking_ref).status,
            Booking.Status.CONFIRMED,
        )

    @patch.dict(os.environ, {"RAZORPAY_KEY_SECRET": "testsecret"})
    def test_wrong_hmac_returns_400(self):
        order_id = "order_TestWrongHMAC001"
        payment_id = "pay_TestWrongHMAC001"

        self._hold_and_create_booking(order_id)

        resp = self.client.post("/api/payments/verify/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": "definitely_wrong_signature",
        }, format="json")

        self.assertEqual(resp.status_code, 400)
        self.assertIn("error", resp.data)

    @patch.dict(os.environ, {}, clear=False)
    def test_missing_secret_returns_500(self):
        """When RAZORPAY_KEY_SECRET is absent, verify must refuse with 500
        instead of computing an HMAC over an empty key (bypass protection)."""
        order_id = "order_TestNoSecret001"
        payment_id = "pay_TestNoSecret001"

        self._hold_and_create_booking(order_id)

        # Ensure the key is absent from the environment for this test.
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("RAZORPAY_KEY_SECRET", None)
            resp = self.client.post("/api/payments/verify/", {
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": "any_value",
            }, format="json")

        self.assertEqual(resp.status_code, 500)
        self.assertIn("error", resp.data)
