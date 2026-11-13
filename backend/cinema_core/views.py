from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Cinema,
    Movie,
    Show,
    Booking,
    BookingSeat,
    Prediction,
    CinemaSeat,
    SeatReservation,
)

from .serializers import (
    CinemaSerializer,
    MovieSerializer,
    ShowSerializer,
    BookingSerializer,
    PredictionSerializer,
    CinemaSeatSerializer,
)


# =====================================================
# CINEMA API
# =====================================================

class CinemaViewSet(viewsets.ModelViewSet):
    queryset = Cinema.objects.all().order_by("name")
    serializer_class = CinemaSerializer
    permission_classes = [AllowAny]


# =====================================================
# MOVIE API
# =====================================================

class MovieViewSet(viewsets.ModelViewSet):
    queryset = Movie.objects.all().order_by("title")
    serializer_class = MovieSerializer
    permission_classes = [AllowAny]


# =====================================================
# SHOW API
# =====================================================

class ShowViewSet(viewsets.ModelViewSet):
    queryset = Show.objects.select_related(
        "cinema", "movie"
    ).all().order_by("show_date", "show_time")

    serializer_class = ShowSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        shows = self.get_queryset().filter(
            show_date__gte=timezone.localdate()
        )

        serializer = self.get_serializer(shows, many=True)
        return Response(serializer.data)


# =====================================================
# BOOKING API
# =====================================================

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.select_related(
        "show",
        "show__cinema",
        "show__movie",
    ).all().order_by("-booked_at")

    serializer_class = BookingSerializer
    permission_classes = [IsAdminUser]

    http_method_names = ["get", "post", "head", "options"]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        show_id = serializer.validated_data["show"].pk
        ticket_count = serializer.validated_data["tickets_count"]

        with transaction.atomic():
            show = Show.objects.select_for_update().get(pk=show_id)

            remaining = show.seats_available - show.tickets_booked

            if ticket_count > remaining:
                return Response(
                    {
                        "error": "Not enough seats available.",
                        "remaining_seats": remaining,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            total_amount = show.ticket_price * Decimal(ticket_count)

            booking = Booking.objects.create(
                show=show,
                customer_name=serializer.validated_data["customer_name"],
                customer_email=serializer.validated_data["customer_email"],
                tickets_count=ticket_count,
                total_amount=total_amount,
            )

            show.tickets_booked += ticket_count
            show.save(update_fields=["tickets_booked"])

        output = self.get_serializer(booking)

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            booking = get_object_or_404(
                Booking.objects.select_for_update(),
                pk=pk,
            )

            if booking.status == Booking.Status.CANCELLED:
                return Response({
                    "message": "Booking is already cancelled.",
                    "booking": self.get_serializer(booking).data,
                })

            show = Show.objects.select_for_update().get(
                pk=booking.show_id
            )

            booking.status = Booking.Status.CANCELLED
            booking.save(update_fields=["status"])

            show.tickets_booked = max(
                0,
                show.tickets_booked - booking.tickets_count,
            )
            show.save(update_fields=["tickets_booked"])

            # Release seat reservations associated with this booking.
            SeatReservation.objects.filter(
                booking=booking,
                status=SeatReservation.Status.BOOKED,
            ).delete()

            # Also remove BookingSeat records so seats are freed.
            BookingSeat.objects.filter(booking=booking).delete()

            # If payment was pending, mark it failed.
            if booking.payment_status == "pending":
                booking.payment_status = "failed"
                booking.save(update_fields=["payment_status"])

        return Response({
            "message": "Booking cancelled and seats restored.",
            "booking": self.get_serializer(booking).data,
        })

    @action(detail=False, methods=["get"])
    def stats(self, request):
        confirmed = Booking.objects.filter(
            status=Booking.Status.CONFIRMED
        )

        cancelled = Booking.objects.filter(
            status=Booking.Status.CANCELLED
        )

        revenue = confirmed.aggregate(
            total=Coalesce(
                Sum("total_amount"),
                Decimal("0.00"),
            )
        )["total"]

        tickets = confirmed.aggregate(
            total=Coalesce(Sum("tickets_count"), 0)
        )["total"]

        return Response({
            "total_bookings": Booking.objects.count(),
            "confirmed_bookings": confirmed.count(),
            "cancelled_bookings": cancelled.count(),
            "total_tickets_sold": tickets,
            "total_revenue": str(revenue),
        })


# =====================================================
# CINEMA SEAT MANAGEMENT API
# =====================================================

class CinemaSeatViewSet(viewsets.ModelViewSet):
    queryset = CinemaSeat.objects.select_related(
        "cinema"
    ).all().order_by("row", "seat_number")

    serializer_class = CinemaSeatSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=["post"])
    def generate(self, request):
        cinema_id = request.data.get("cinema")
        rows = request.data.get("rows", 10)
        seats_per_row = request.data.get("seats_per_row", 12)

        try:
            rows = int(rows)
            seats_per_row = int(seats_per_row)

            if not cinema_id:
                raise ValueError()

            if not 1 <= rows <= 26:
                raise ValueError()

            if not 1 <= seats_per_row <= 30:
                raise ValueError()

        except (TypeError, ValueError):
            return Response(
                {
                    "error": (
                        "Provide a valid cinema, rows (1-26) "
                        "and seats_per_row (1-30)."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        cinema = get_object_or_404(Cinema, pk=cinema_id)

        created = 0

        with transaction.atomic():
            for row_index in range(rows):
                row_name = chr(65 + row_index)

                if row_index < rows * 0.4:
                    category = CinemaSeat.Category.SILVER
                    multiplier = Decimal("1.00")

                elif row_index < rows * 0.8:
                    category = CinemaSeat.Category.GOLD
                    multiplier = Decimal("1.30")

                else:
                    category = CinemaSeat.Category.PREMIUM
                    multiplier = Decimal("1.60")

                for seat_number in range(1, seats_per_row + 1):
                    _, was_created = CinemaSeat.objects.get_or_create(
                        cinema=cinema,
                        row=row_name,
                        seat_number=seat_number,
                        defaults={
                            "category": category,
                            "price_multiplier": multiplier,
                        },
                    )

                    if was_created:
                        created += 1

        return Response({
            "message": "Seat layout generated successfully.",
            "cinema": cinema.name,
            "created_seats": created,
            "total_seats": CinemaSeat.objects.filter(
                cinema=cinema
            ).count(),
        })

    @action(detail=False, methods=["get"])
    def layout(self, request):
        cinema_id = request.query_params.get("cinema")

        if not cinema_id:
            return Response(
                {"error": "Cinema ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        seats = self.get_queryset().filter(
            cinema_id=cinema_id,
            is_active=True,
        )

        serializer = self.get_serializer(seats, many=True)
        return Response(serializer.data)


# =====================================================
# SHOW SEAT AVAILABILITY API
# =====================================================

class ShowSeatView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, show_id):
        show = get_object_or_404(
            Show.objects.select_related("cinema", "movie"),
            pk=show_id,
        )

        now = timezone.now()

        # Remove expired temporary holds.
        SeatReservation.objects.filter(
            show=show,
            status=SeatReservation.Status.HELD,
            expires_at__lte=now,
        ).delete()

        seats = CinemaSeat.objects.filter(
            cinema=show.cinema,
            is_active=True,
        ).order_by("row", "seat_number")

        reservations = {
            reservation.seat_id: reservation
            for reservation in SeatReservation.objects.filter(
                show=show
            ).select_related("seat")
        }

        seat_data = []

        for seat in seats:
            reservation = reservations.get(seat.id)

            seat_status = (
                reservation.status if reservation else "available"
            )

            price = show.ticket_price * seat.price_multiplier

            seat_data.append({
                "id": seat.id,
                "row": seat.row,
                "seat_number": seat.seat_number,
                "label": f"{seat.row}{seat.seat_number}",
                "category": seat.category,
                "price": str(price),
                "status": seat_status,
            })

        return Response({
            "show_id": show.id,
            "movie": show.movie.title,
            "cinema": show.cinema.name,
            "show_date": show.show_date,
            "show_time": show.show_time,
            "seats": seat_data,
        })


# =====================================================
# PREDICTION API
# =====================================================

class PredictionViewSet(viewsets.ModelViewSet):
    queryset = Prediction.objects.select_related(
        "show",
        "show__movie",
        "show__cinema",
    ).all().order_by("-created_at")

    serializer_class = PredictionSerializer
    permission_classes = [IsAdminUser]


# =====================================================
# DASHBOARD API
# =====================================================

class DashboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        confirmed_bookings = Booking.objects.filter(
            status=Booking.Status.CONFIRMED
        )

        revenue = confirmed_bookings.aggregate(
            total=Coalesce(
                Sum("total_amount"),
                Decimal("0.00"),
            )
        )["total"]

        show_totals = Show.objects.aggregate(
            booked=Coalesce(Sum("tickets_booked"), 0),
            capacity=Coalesce(Sum("seats_available"), 0),
        )

        booked = show_totals["booked"]
        capacity = show_totals["capacity"]

        occupancy = (
            round(booked / capacity * 100, 2)
            if capacity else 0
        )

        return Response({
            "total_cinemas": Cinema.objects.count(),
            "total_movies": Movie.objects.count(),
            "total_shows": Show.objects.count(),
            "total_bookings": confirmed_bookings.count(),
            "total_revenue": str(revenue),
            "overall_occupancy": occupancy,
        })