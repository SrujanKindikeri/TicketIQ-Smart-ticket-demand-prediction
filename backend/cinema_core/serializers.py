
from rest_framework import serializers
from .models import Cinema, Movie, Show, Booking, Prediction


class CinemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cinema
        fields = "__all__"


class MovieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movie
        fields = "__all__"


class ShowSerializer(serializers.ModelSerializer):
    cinema_name = serializers.CharField(
        source="cinema.name", read_only=True
    )
    movie_title = serializers.CharField(
        source="movie.title", read_only=True
    )
    occupancy_rate = serializers.ReadOnlyField()

    class Meta:
        model = Show
        fields = "__all__"


class BookingSerializer(serializers.ModelSerializer):
    total_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True
    )

    class Meta:
        model = Booking
        fields = "__all__"
        read_only_fields = (
            "total_amount",
            "status",
            "booked_at",
        )


class PredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prediction
        fields = "__all__"
from .models import CinemaSeat, SeatReservation


class CinemaSeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = CinemaSeat
        fields = "__all__"


class SeatReservationSerializer(serializers.ModelSerializer):
    seat_label = serializers.SerializerMethodField()
    category = serializers.CharField(
        source="seat.category",
        read_only=True,
    )

    class Meta:
        model = SeatReservation
        fields = [
            "id",
            "show",
            "seat",
            "seat_label",
            "category",
            "status",
            "expires_at",
        ]
        read_only_fields = fields

    def get_seat_label(self, obj):
        return f"{obj.seat.row}{obj.seat.seat_number}"


# =====================================================
# FEAT-002 SERIALIZERS
# =====================================================

from .models import Payment, BookingSeat


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"


class BookingSeatSerializer(serializers.ModelSerializer):
    seat_label = serializers.SerializerMethodField()
    category = serializers.CharField(
        source="seat.category",
        read_only=True,
    )

    class Meta:
        model = BookingSeat
        fields = [
            "id",
            "booking",
            "seat",
            "seat_label",
            "category",
            "price_at_booking",
        ]

    def get_seat_label(self, obj):
        return f"{obj.seat.row}{obj.seat.seat_number}"


class BookingDetailSerializer(BookingSerializer):
    booking_seats = BookingSeatSerializer(many=True, read_only=True)
    payment = PaymentSerializer(read_only=True)
    movie_title = serializers.CharField(source="show.movie.title", read_only=True)
    cinema_name = serializers.CharField(source="show.cinema.name", read_only=True)
    show_date = serializers.DateField(source="show.show_date", read_only=True)
    show_time = serializers.TimeField(source="show.show_time", read_only=True)

    class Meta(BookingSerializer.Meta):
        fields = "__all__"


class SeatAvailabilitySerializer(serializers.Serializer):
    """Non-model serializer for individual seat availability data."""
    id = serializers.IntegerField()
    row = serializers.CharField()
    seat_number = serializers.IntegerField()
    label = serializers.CharField()
    category = serializers.CharField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    status = serializers.CharField()
