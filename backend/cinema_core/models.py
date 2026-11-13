import uuid

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Cinema(models.Model):
    name = models.CharField(max_length=150)
    location = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    total_seats = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Movie(models.Model):
    title = models.CharField(max_length=200)
    genre = models.CharField(max_length=100, blank=True)
    release_year = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1888), MaxValueValidator(2100)]
    )
    average_rating = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )
    rating_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Show(models.Model):
    class DataSource(models.TextChoices):
        SYNTHETIC = "synthetic", "Synthetic"
        REAL = "real", "Real"

    cinema = models.ForeignKey(
        Cinema,
        on_delete=models.CASCADE,
        related_name="shows"
    )
    movie = models.ForeignKey(
        Movie,
        on_delete=models.CASCADE,
        related_name="shows"
    )
    show_date = models.DateField()
    show_time = models.TimeField()
    ticket_price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    seats_available = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )
    tickets_booked = models.PositiveIntegerField(default=0)
    promotion = models.BooleanField(default=False)
    data_source = models.CharField(
        max_length=20,
        choices=DataSource.choices,
        default=DataSource.SYNTHETIC
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["cinema", "movie", "show_date", "show_time"],
                name="unique_cinema_movie_show_time"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    tickets_booked__lte=models.F("seats_available")
                ),
                name="bookings_not_above_capacity"
            )
        ]

    @property
    def occupancy_rate(self):
        if self.seats_available == 0:
            return 0
        return round(self.tickets_booked / self.seats_available * 100, 2)

    def __str__(self):
        return f"{self.movie.title} - {self.show_date} {self.show_time}"


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"

    show = models.ForeignKey(
        Show,
        on_delete=models.PROTECT,
        related_name="bookings"
    )
    customer_name = models.CharField(max_length=150)
    customer_email = models.EmailField()
    tickets_count = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    booked_at = models.DateTimeField(auto_now_add=True)
    customer_phone = models.CharField(max_length=20, blank=True)
    booking_reference = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("paid", "Paid"), ("failed", "Failed")],
        default="pending",
    )

    def __str__(self):
        return f"Booking #{self.pk} - {self.customer_name}"


class Prediction(models.Model):
    show = models.ForeignKey(
        Show,
        on_delete=models.CASCADE,
        related_name="predictions"
    )
    predicted_tickets = models.FloatField(
        validators=[MinValueValidator(0)]
    )
    predicted_occupancy = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    predicted_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    model_name = models.CharField(max_length=100)
    model_version = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Prediction for Show {self.show_id}"


class CinemaSeat(models.Model):
    class Category(models.TextChoices):
        SILVER = "silver", "Silver"
        GOLD = "gold", "Gold"
        PREMIUM = "premium", "Premium"

    cinema = models.ForeignKey(
        Cinema,
        on_delete=models.CASCADE,
        related_name="seats",
    )
    row = models.CharField(max_length=5)
    seat_number = models.PositiveIntegerField()
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.SILVER,
    )
    price_multiplier = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=1.00,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["cinema", "row", "seat_number"],
                name="unique_cinema_seat",
            )
        ]
        ordering = ["row", "seat_number"]

    def __str__(self):
        return f"{self.cinema.name} - {self.row}{self.seat_number}"


class SeatReservation(models.Model):
    class Status(models.TextChoices):
        HELD = "held", "Held"
        BOOKED = "booked", "Booked"

    show = models.ForeignKey(
        Show,
        on_delete=models.CASCADE,
        related_name="seat_reservations",
    )
    seat = models.ForeignKey(
        CinemaSeat,
        on_delete=models.PROTECT,
        related_name="reservations",
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="seat_reservations",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.HELD,
    )
    hold_token = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
    )
    expires_at = models.DateTimeField(
        default=timezone.now,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["show", "seat"],
                name="unique_seat_per_show",
            )
        ]

    def __str__(self):
        return f"{self.show} - {self.seat} ({self.status})"


class Payment(models.Model):
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name="payment",
    )
    razorpay_order_id = models.CharField(max_length=100)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("paid", "Paid"), ("failed", "Failed")],
        default="pending",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payment for Booking #{self.booking_id} ({self.status})"


class BookingSeat(models.Model):
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name="booking_seats",
    )
    seat = models.ForeignKey(
        CinemaSeat,
        on_delete=models.PROTECT,
        related_name="booking_seats",
    )
    price_at_booking = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["booking", "seat"],
                name="unique_booking_seat",
            )
        ]
        ordering = ["seat__row", "seat__seat_number"]

    def __str__(self):
        return f"{self.booking_id} - {self.seat}"
