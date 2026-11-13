
from django.contrib import admin
from .models import Cinema, Movie, Show, Booking, Prediction, Payment, BookingSeat


@admin.register(Cinema)
class CinemaAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "city", "total_seats", "is_active")
    search_fields = ("name", "city", "location")
    list_filter = ("city", "is_active")


@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    list_display = (
        "id", "title", "genre", "release_year",
        "average_rating", "is_active"
    )
    search_fields = ("title", "genre")
    list_filter = ("genre", "release_year", "is_active")


@admin.register(Show)
class ShowAdmin(admin.ModelAdmin):
    list_display = (
        "id", "cinema", "movie", "show_date",
        "show_time", "ticket_price", "tickets_booked",
        "seats_available", "data_source"
    )
    search_fields = ("cinema__name", "movie__title")
    list_filter = ("show_date", "data_source", "promotion")
    date_hierarchy = "show_date"


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id", "customer_name", "customer_email",
        "show", "tickets_count", "total_amount",
        "status", "booked_at"
    )
    search_fields = ("customer_name", "customer_email")
    list_filter = ("status", "booked_at")


@admin.register(Prediction)
class PredictionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "show", "predicted_tickets",
        "predicted_occupancy", "predicted_revenue",
        "model_name", "created_at"
    )
    search_fields = ("model_name",)
    list_filter = ("model_name", "created_at")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id", "booking", "razorpay_order_id",
        "status", "amount", "created_at"
    )
    search_fields = ("razorpay_order_id", "razorpay_payment_id", "booking__customer_email")
    list_filter = ("status", "created_at")


@admin.register(BookingSeat)
class BookingSeatAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "seat", "price_at_booking")
    search_fields = ("booking__customer_name", "booking__customer_email")
    list_filter = ("seat__category",)
