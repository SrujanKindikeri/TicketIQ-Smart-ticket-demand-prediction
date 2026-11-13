"""
views_booking.py — FEAT-002 booking API views.

All new endpoints live here to avoid cluttering views.py.
Patterns mirror views.py exactly: permission_classes as a list on each class,
transaction.atomic() + select_for_update() for concurrency, AllowAny for
public endpoints, IsAdminUser / IsAuthenticated for protected ones.
"""

import hashlib
import hmac
import io
import os
import uuid
from datetime import timedelta

from django.db import transaction
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Booking,
    BookingSeat,
    Cinema,
    CinemaSeat,
    Payment,
    SeatReservation,
    Show,
)
from .serializers import (
    BookingDetailSerializer,
    CinemaSeatSerializer,
    PaymentSerializer,
    SeatAvailabilitySerializer,
)


# =====================================================
# PAGINATION
# =====================================================

class BookingPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# =====================================================
# SHOW AVAILABILITY
# =====================================================

class ShowAvailabilityView(APIView):
    """
    GET /api/shows/<show_id>/availability/
    Public endpoint. Returns all active seats for the show's cinema,
    tagged with availability status. Expired holds are released first.
    If the caller supplies X-Hold-Token header, their held seats are
    marked 'yours' so the frontend can distinguish them.
    """
    permission_classes = [AllowAny]

    def get(self, request, show_id):
        show = get_object_or_404(
            Show.objects.select_related("cinema", "movie"),
            pk=show_id,
        )
        now = timezone.now()

        # Release expired holds for this show.
        SeatReservation.objects.filter(
            show=show,
            status=SeatReservation.Status.HELD,
            expires_at__lte=now,
        ).delete()

        caller_token = request.headers.get("X-Hold-Token", "")

        seats = CinemaSeat.objects.filter(
            cinema=show.cinema,
            is_active=True,
        ).order_by("row", "seat_number")

        reservations = {
            r.seat_id: r
            for r in SeatReservation.objects.filter(show=show).select_related("seat")
        }

        seat_data = []
        for seat in seats:
            reservation = reservations.get(seat.id)
            if reservation is None:
                seat_status = "available"
            elif reservation.status == SeatReservation.Status.BOOKED:
                seat_status = "booked"
            elif caller_token and str(reservation.hold_token) == caller_token:
                seat_status = "yours"
            else:
                seat_status = "held"

            price = show.ticket_price * seat.price_multiplier
            seat_data.append({
                "id": seat.id,
                "row": seat.row,
                "seat_number": seat.seat_number,
                "label": f"{seat.row}{seat.seat_number}",
                "category": seat.category,
                "price": price,
                "status": seat_status,
            })

        serializer = SeatAvailabilitySerializer(seat_data, many=True)
        return Response({
            "show_id": show.id,
            "movie": show.movie.title,
            "cinema": show.cinema.name,
            "show_date": show.show_date,
            "show_time": show.show_time,
            "ticket_price": str(show.ticket_price),
            "seats": serializer.data,
        })


# =====================================================
# SEAT HOLD
# =====================================================

class HoldSeatsView(APIView):
    """
    POST /api/shows/<show_id>/hold/
        Body: {seat_ids: [...]}
        Returns: {session_token, expires_at, seats}

    DELETE /api/shows/<show_id>/hold/
        Body: {session_token: "..."}
        Releases all HELD reservations for that token on this show.
    """
    permission_classes = [AllowAny]

    def post(self, request, show_id):
        show = get_object_or_404(
            Show.objects.select_related("cinema"),
            pk=show_id,
        )
        seat_ids = request.data.get("seat_ids", [])

        if not seat_ids or not isinstance(seat_ids, list):
            return Response(
                {"error": "seat_ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        expires_at = now + timedelta(minutes=5)
        hold_token = uuid.uuid4()

        with transaction.atomic():
            # Lock the seat rows we are about to touch.
            seats = CinemaSeat.objects.select_for_update().filter(
                id__in=seat_ids,
                cinema=show.cinema,
                is_active=True,
            )

            if seats.count() != len(seat_ids):
                return Response(
                    {"error": "One or more seat IDs are invalid or do not belong to this cinema."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Release any expired holds for these seats before checking.
            SeatReservation.objects.filter(
                show=show,
                seat_id__in=seat_ids,
                status=SeatReservation.Status.HELD,
                expires_at__lte=now,
            ).delete()

            # Check for existing active reservations.
            conflicting = SeatReservation.objects.filter(
                show=show,
                seat_id__in=seat_ids,
            )
            if conflicting.exists():
                return Response(
                    {"error": "One or more seats are already held or booked."},
                    status=status.HTTP_409_CONFLICT,
                )

            # Create holds.
            reservations = [
                SeatReservation(
                    show=show,
                    seat_id=sid,
                    status=SeatReservation.Status.HELD,
                    hold_token=hold_token,
                    expires_at=expires_at,
                )
                for sid in seat_ids
            ]
            SeatReservation.objects.bulk_create(reservations)

        # Build response.
        seat_details = []
        for seat in CinemaSeat.objects.filter(id__in=seat_ids):
            price = show.ticket_price * seat.price_multiplier
            seat_details.append({
                "id": seat.id,
                "label": f"{seat.row}{seat.seat_number}",
                "category": seat.category,
                "price": str(price),
            })

        return Response({
            "session_token": str(hold_token),
            "expires_at": expires_at.isoformat(),
            "seats": seat_details,
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, show_id):
        show = get_object_or_404(Show, pk=show_id)
        session_token = request.data.get("session_token")

        if not session_token:
            return Response(
                {"error": "session_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count, _ = SeatReservation.objects.filter(
            show=show,
            hold_token=session_token,
            status=SeatReservation.Status.HELD,
        ).delete()

        return Response({"released": deleted_count})


# =====================================================
# CREATE BOOKING
# =====================================================

class CreateBookingView(APIView):
    """
    POST /api/bookings/create/
    Body: {hold_token, customer_name, customer_email, customer_phone}
    Converts held reservations into a confirmed booking (PENDING payment).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        hold_token = request.data.get("hold_token")
        customer_name = request.data.get("customer_name", "").strip()
        customer_email = request.data.get("customer_email", "").strip()
        customer_phone = request.data.get("customer_phone", "").strip()

        if not all([hold_token, customer_name, customer_email]):
            return Response(
                {"error": "hold_token, customer_name, and customer_email are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()

        with transaction.atomic():
            # Fetch and lock the held reservations.
            reservations = SeatReservation.objects.select_for_update().filter(
                hold_token=hold_token,
                status=SeatReservation.Status.HELD,
            ).select_related("show__cinema", "seat")

            if not reservations.exists():
                return Response(
                    {"error": "No active holds found for this token. They may have expired."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check none have expired.
            expired = reservations.filter(expires_at__lte=now)
            if expired.exists():
                reservations.delete()
                return Response(
                    {"error": "Seat hold has expired. Please select your seats again."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # All reservations share the same show (enforced by HoldSeatsView).
            show = reservations.first().show

            # Calculate total.
            total = sum(
                show.ticket_price * r.seat.price_multiplier
                for r in reservations
            )

            seats = [r.seat for r in reservations]

            # Create booking.
            booking = Booking.objects.create(
                show=show,
                customer_name=customer_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                tickets_count=len(seats),
                total_amount=total,
                status=Booking.Status.PENDING,
                payment_status="pending",
            )

            # Create BookingSeat records.
            BookingSeat.objects.bulk_create([
                BookingSeat(
                    booking=booking,
                    seat=r.seat,
                    price_at_booking=show.ticket_price * r.seat.price_multiplier,
                )
                for r in reservations
            ])

            # Upgrade reservations from HELD → BOOKED and link to booking.
            reservations.update(
                status=SeatReservation.Status.BOOKED,
                booking=booking,
            )

            # Create Razorpay order (or mock).
            razorpay_order_id = None
            razorpay_key_id = os.environ.get("RAZORPAY_KEY_ID", "")
            try:
                import razorpay
                rz_client = razorpay.Client(
                    auth=(
                        os.environ["RAZORPAY_KEY_ID"],
                        os.environ["RAZORPAY_KEY_SECRET"],
                    )
                )
                order = rz_client.order.create({
                    "amount": int(total * 100),  # paise
                    "currency": "INR",
                    "receipt": str(booking.booking_reference),
                })
                razorpay_order_id = order["id"]
            except (ImportError, KeyError, Exception):
                razorpay_order_id = f"mock_order_{uuid.uuid4().hex[:16]}"

            Payment.objects.create(
                booking=booking,
                razorpay_order_id=razorpay_order_id,
                status="pending",
                amount=total,
            )

        return Response({
            "booking_id": booking.id,
            "booking_reference": str(booking.booking_reference),
            "razorpay_order_id": razorpay_order_id,
            "razorpay_key_id": razorpay_key_id,
        }, status=status.HTTP_201_CREATED)


# =====================================================
# PAYMENT VERIFY
# =====================================================

class PaymentVerifyView(APIView):
    """
    POST /api/payments/verify/
    Body: {razorpay_order_id, razorpay_payment_id, razorpay_signature}
    Verifies the Razorpay payment signature and confirms the booking.
    Idempotent: calling again on an already-confirmed booking returns success.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        razorpay_order_id = request.data.get("razorpay_order_id", "")
        razorpay_payment_id = request.data.get("razorpay_payment_id", "")
        razorpay_signature = request.data.get("razorpay_signature", "")

        if not razorpay_order_id:
            return Response(
                {"error": "razorpay_order_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = get_object_or_404(Payment, razorpay_order_id=razorpay_order_id)
        booking = payment.booking

        # Idempotency: already confirmed.
        if booking.status == Booking.Status.CONFIRMED:
            return Response({
                "success": True,
                "booking_reference": str(booking.booking_reference),
            })

        # Signature verification.
        is_mock = razorpay_order_id.startswith("mock_order_")
        if not is_mock:
            secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
            if not secret:
                return Response(
                    {"error": "Payment verification not configured."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode()
            expected = hmac.new(
                secret.encode(), msg, hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(expected, razorpay_signature):
                return Response(
                    {"error": "Payment signature verification failed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(
                razorpay_order_id=razorpay_order_id
            )
            payment.status = "paid"
            payment.razorpay_payment_id = razorpay_payment_id
            payment.razorpay_signature = razorpay_signature
            payment.save(update_fields=[
                "status", "razorpay_payment_id", "razorpay_signature", "updated_at"
            ])

            bk = Booking.objects.select_for_update().get(pk=booking.pk)
            bk.status = Booking.Status.CONFIRMED
            bk.payment_status = "paid"
            bk.save(update_fields=["status", "payment_status"])

            # Increment tickets_booked on the show.
            show = Show.objects.select_for_update().get(pk=bk.show_id)
            show.tickets_booked += bk.tickets_count
            show.save(update_fields=["tickets_booked"])

        return Response({
            "success": True,
            "booking_reference": str(booking.booking_reference),
        })


# =====================================================
# TICKET PDF
# =====================================================

class TicketView(APIView):
    """
    GET /api/bookings/<booking_reference>/ticket/
    Returns a PDF digital ticket with QR code.
    """
    permission_classes = [AllowAny]

    def get(self, request, booking_reference):
        booking = get_object_or_404(
            Booking.objects.select_related("show__movie", "show__cinema"),
            booking_reference=booking_reference,
        )

        booking_seats = BookingSeat.objects.filter(
            booking=booking
        ).select_related("seat").order_by("seat__row", "seat__seat_number")

        # Build PDF.
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader
        import qrcode

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # --- Header ---
        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(colors.HexColor("#007AFF"))
        c.drawString(2 * cm, height - 2.5 * cm, "TicketIQ")

        c.setFont("Helvetica", 12)
        c.setFillColor(colors.black)
        c.drawString(2 * cm, height - 3.2 * cm, "Smart Cinema Booking Confirmation")

        # Divider.
        c.setStrokeColor(colors.HexColor("#007AFF"))
        c.setLineWidth(1.5)
        c.line(2 * cm, height - 3.6 * cm, width - 2 * cm, height - 3.6 * cm)

        # --- Booking reference ---
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, height - 4.4 * cm, "Booking Reference:")
        c.setFont("Helvetica", 11)
        c.drawString(7 * cm, height - 4.4 * cm, str(booking.booking_reference))

        # --- Movie / Show details ---
        y = height - 5.2 * cm
        details = [
            ("Movie", booking.show.movie.title),
            ("Cinema", booking.show.cinema.name),
            ("Location", booking.show.cinema.location),
            ("Date", str(booking.show.show_date)),
            ("Time", str(booking.show.show_time)),
            ("Tickets", str(booking.tickets_count)),
            ("Total Amount", f"INR {booking.total_amount}"),
            ("Payment Status", booking.payment_status.capitalize()),
        ]
        for label, value in details:
            c.setFont("Helvetica-Bold", 10)
            c.drawString(2 * cm, y, f"{label}:")
            c.setFont("Helvetica", 10)
            c.drawString(7 * cm, y, value)
            y -= 0.65 * cm

        # --- Seat list ---
        y -= 0.3 * cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * cm, y, "Seats:")
        y -= 0.65 * cm
        for bs in booking_seats:
            label = f"{bs.seat.row}{bs.seat.seat_number}"
            c.setFont("Helvetica", 10)
            c.drawString(2.5 * cm, y, f"{label}  —  {bs.seat.category.capitalize()}  —  INR {bs.price_at_booking}")
            y -= 0.55 * cm

        # --- QR Code (encodes only booking_reference) ---
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=4,
            border=2,
        )
        qr.add_data(str(booking.booking_reference))
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")

        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format="PNG")
        qr_buffer.seek(0)

        qr_x = width - 6 * cm
        qr_y = height - 10 * cm
        c.drawImage(ImageReader(qr_buffer), qr_x, qr_y, width=4.5 * cm, height=4.5 * cm)
        c.setFont("Helvetica", 8)
        c.drawString(qr_x, qr_y - 0.4 * cm, "Scan to verify ticket")

        # Footer.
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.grey)
        c.drawString(2 * cm, 1.5 * cm, "This ticket is generated by TicketIQ. Valid only for the stated show.")

        c.showPage()
        c.save()
        buffer.seek(0)

        response = HttpResponse(buffer.read(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="ticket_{booking.booking_reference}.pdf"'
        )
        return response


# =====================================================
# BOOKING VERIFY (public, no PII)
# =====================================================

class BookingVerifyView(APIView):
    """
    GET /api/bookings/<booking_reference>/verify/
    Returns public booking info for QR-code verification kiosks.
    Does NOT expose customer name, email, or phone.
    """
    permission_classes = [AllowAny]

    def get(self, request, booking_reference):
        booking = get_object_or_404(
            Booking.objects.select_related("show__movie", "show__cinema"),
            booking_reference=booking_reference,
        )

        booking_seats = BookingSeat.objects.filter(
            booking=booking
        ).select_related("seat")

        seats = [
            {
                "label": f"{bs.seat.row}{bs.seat.seat_number}",
                "category": bs.seat.category,
            }
            for bs in booking_seats
        ]

        return Response({
            "booking_reference": str(booking.booking_reference),
            "movie_title": booking.show.movie.title,
            "cinema_name": booking.show.cinema.name,
            "show_date": booking.show.show_date,
            "show_time": booking.show.show_time,
            "seats": seats,
            "tickets_count": booking.tickets_count,
            "total_amount": str(booking.total_amount),
            "status": booking.status,
            "payment_status": booking.payment_status,
        })


# =====================================================
# MY BOOKINGS (authenticated customer)
# =====================================================

class MyBookingsView(APIView):
    """
    GET /api/bookings/my/?email=<email>
    Returns the calling customer's booking history ordered newest-first.

    TODO: replace email query param with session auth once customer login UI is built.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        email = request.query_params.get("email", "").strip()

        if not email:
            return Response(
                {"error": "email query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Security: prevent horizontal privilege escalation.
        # An authenticated user may only fetch their own booking history.
        if request.user.email.lower() != email.lower():
            return Response(
                {"error": "You can only view your own booking history."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = (
            Booking.objects
            .filter(customer_email=email)
            .select_related("show", "show__movie", "show__cinema")
            .prefetch_related("booking_seats__seat")
            .order_by("-booked_at")
        )

        paginator = BookingPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = BookingDetailSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# =====================================================
# ADMIN BOOKINGS
# =====================================================

class AdminBookingsView(APIView):
    """
    GET /api/admin/bookings/
    Admin-only. Accepts query params: status, movie_id, cinema_id, date, search.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        queryset = (
            Booking.objects
            .select_related("show", "show__movie", "show__cinema")
            .prefetch_related("booking_seats__seat")
            .order_by("-booked_at")
        )

        # Filters.
        bk_status = request.query_params.get("status")
        movie_id = request.query_params.get("movie_id")
        cinema_id = request.query_params.get("cinema_id")
        date = request.query_params.get("date")
        search = request.query_params.get("search", "").strip()

        if bk_status:
            queryset = queryset.filter(status=bk_status)
        if movie_id:
            queryset = queryset.filter(show__movie_id=movie_id)
        if cinema_id:
            queryset = queryset.filter(show__cinema_id=cinema_id)
        if date:
            queryset = queryset.filter(show__show_date=date)
        if search:
            queryset = queryset.filter(
                Q(customer_name__icontains=search) |
                Q(customer_email__icontains=search)
            )

        paginator = BookingPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = BookingDetailSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# =====================================================
# ADMIN BOOKING STATS
# =====================================================

class AdminBookingStatsView(APIView):
    """
    GET /api/admin/bookings/stats/
    Returns aggregated booking & revenue statistics for the admin dashboard.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.db.models import DecimalField
        from decimal import Decimal

        confirmed = Booking.objects.filter(status=Booking.Status.CONFIRMED)
        cancelled = Booking.objects.filter(status=Booking.Status.CANCELLED)
        pending = Booking.objects.filter(status=Booking.Status.PENDING)

        total_revenue = confirmed.aggregate(
            total=Coalesce(Sum("total_amount"), Decimal("0.00"))
        )["total"]

        total_tickets = confirmed.aggregate(
            total=Coalesce(Sum("tickets_count"), 0)
        )["total"]

        # Top 5 movies by revenue.
        from django.db.models import FloatField
        revenue_by_movie = (
            confirmed
            .values("show__movie__title")
            .annotate(revenue=Sum("total_amount"))
            .order_by("-revenue")[:5]
        )

        # Top 5 cinemas by revenue.
        revenue_by_cinema = (
            confirmed
            .values("show__cinema__name")
            .annotate(revenue=Sum("total_amount"))
            .order_by("-revenue")[:5]
        )

        return Response({
            "total_bookings": Booking.objects.count(),
            "confirmed_bookings": confirmed.count(),
            "cancelled_bookings": cancelled.count(),
            "pending_bookings": pending.count(),
            "total_tickets_sold": total_tickets,
            "total_revenue": str(total_revenue),
            "revenue_by_movie": [
                {"movie": r["show__movie__title"], "revenue": str(r["revenue"])}
                for r in revenue_by_movie
            ],
            "revenue_by_cinema": [
                {"cinema": r["show__cinema__name"], "revenue": str(r["revenue"])}
                for r in revenue_by_cinema
            ],
        })


# =====================================================
# CINEMA SEAT LIST (admin)
# =====================================================

class CinemaSeatListView(APIView):
    """
    GET /api/cinemas/<cinema_id>/seats/
    Admin-only. Returns all seats (including inactive) for a cinema.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, cinema_id):
        cinema = get_object_or_404(Cinema, pk=cinema_id)
        seats = CinemaSeat.objects.filter(cinema=cinema).order_by("row", "seat_number")
        serializer = CinemaSeatSerializer(seats, many=True)
        return Response(serializer.data)


# =====================================================
# CINEMA CAPACITY (public)
# =====================================================

class CinemaCapacityView(APIView):
    """
    GET /api/cinemas/<cinema_id>/capacity/
    Public endpoint. Returns the count of active seats for the cinema.
    """
    permission_classes = [AllowAny]

    def get(self, request, cinema_id):
        get_object_or_404(Cinema, pk=cinema_id)
        total_active = CinemaSeat.objects.filter(
            cinema_id=cinema_id,
            is_active=True,
        ).count()
        return Response({
            "cinema_id": cinema_id,
            "total_active_seats": total_active,
        })
