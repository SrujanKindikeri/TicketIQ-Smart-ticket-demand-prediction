from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CinemaViewSet,
    MovieViewSet,
    ShowViewSet,
    BookingViewSet,
    PredictionViewSet,
    CinemaSeatViewSet,
    ShowSeatView,
    DashboardView,
)

from .views_booking import (
    ShowAvailabilityView,
    HoldSeatsView,
    CreateBookingView,
    PaymentVerifyView,
    TicketView,
    BookingVerifyView,
    MyBookingsView,
    AdminBookingsView,
    AdminBookingStatsView,
    CinemaSeatListView,
    CinemaCapacityView,
    CustomerCancelBookingView,
)

from .views_auth import LoginView, LogoutView, AuthStatusView
from .views_ml import MLPredictionsView, GeneratePredictionsView
from .views_settings import AppSettingsView
from .views_support import ContactView
from .views_dataset import (
    DatasetListView,
    DatasetPreviewView,
    DatasetDownloadView,
    DemoDashboardView,
    DemoMoviesView,
    DemoCinemasView,
    DemoShowsView,
    DemoBookingsView,
    DemoPredictionsView,
)


# =====================================================
# API ROUTER
# =====================================================

router = DefaultRouter()

router.register("cinemas", CinemaViewSet, basename="cinema")
router.register("movies", MovieViewSet, basename="movie")
router.register("shows", ShowViewSet, basename="show")
router.register("bookings", BookingViewSet, basename="booking")
router.register("predictions", PredictionViewSet, basename="prediction")
router.register("seats", CinemaSeatViewSet, basename="seat")


# =====================================================
# URL PATTERNS
# =====================================================

urlpatterns = [
    # Dataset Demo endpoints (must come before router.urls to avoid conflict)
    path("dataset/", DatasetListView.as_view(), name="dataset-list"),
    path("dataset/dashboard/", DemoDashboardView.as_view(), name="dataset-dashboard"),
    path("dataset/movies/", DemoMoviesView.as_view(), name="dataset-movies"),
    path("dataset/cinemas/", DemoCinemasView.as_view(), name="dataset-cinemas"),
    path("dataset/shows/", DemoShowsView.as_view(), name="dataset-shows"),
    path("dataset/bookings/", DemoBookingsView.as_view(), name="dataset-bookings"),
    path("dataset/predictions/", DemoPredictionsView.as_view(), name="dataset-predictions"),
    path("dataset/<str:dataset_id>/preview/", DatasetPreviewView.as_view(), name="dataset-preview"),
    path("dataset/<str:dataset_id>/download/", DatasetDownloadView.as_view(), name="dataset-download"),

    # Dashboard
    path(
        "dashboard/",
        DashboardView.as_view(),
        name="dashboard",
    ),

    # Auth
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/status/", AuthStatusView.as_view(), name="auth-status"),

    # ML predictions
    path("ml/predictions/", MLPredictionsView.as_view(), name="ml-predictions"),
    path("ml/predictions/generate/", GeneratePredictionsView.as_view(), name="ml-predictions-generate"),

    # App settings
    path("settings/", AppSettingsView.as_view(), name="app-settings"),

    # Contact / support
    path("contact/", ContactView.as_view(), name="contact"),

    # Show-specific seat availability (original admin view)
    path(
        "shows/<int:show_id>/seats/",
        ShowSeatView.as_view(),
        name="show-seats",
    ),

    # FEAT-002: Show availability (public, with hold-token support)
    path(
        "shows/<int:show_id>/availability/",
        ShowAvailabilityView.as_view(),
        name="show-availability",
    ),

    # FEAT-002: Seat hold (POST to hold, DELETE to release)
    path(
        "shows/<int:show_id>/hold/",
        HoldSeatsView.as_view(),
        name="show-hold",
    ),

    # FEAT-002: Create booking from held seats
    path(
        "bookings/create/",
        CreateBookingView.as_view(),
        name="booking-create",
    ),

    # FEAT-002: Payment verification
    path(
        "payments/verify/",
        PaymentVerifyView.as_view(),
        name="payment-verify",
    ),

    # FEAT-002: Digital ticket PDF download
    path(
        "bookings/<str:booking_reference>/ticket/",
        TicketView.as_view(),
        name="booking-ticket",
    ),

    # FEAT-002: Public booking verification (QR code / kiosk)
    path(
        "bookings/<str:booking_reference>/verify/",
        BookingVerifyView.as_view(),
        name="booking-verify",
    ),

    # Customer self-service cancel (AllowAny, ownership verified via email)
    path(
        "bookings/<str:booking_reference>/customer-cancel/",
        CustomerCancelBookingView.as_view(),
        name="booking-customer-cancel",
    ),

    # FEAT-002: Customer booking history (AllowAny — email is the lookup key)
    path(
        "bookings/my/",
        MyBookingsView.as_view(),
        name="bookings-my",
    ),

    # FEAT-002: Admin booking list with filters
    path(
        "admin/bookings/",
        AdminBookingsView.as_view(),
        name="admin-bookings",
    ),

    # FEAT-002: Admin booking stats
    path(
        "admin/bookings/stats/",
        AdminBookingStatsView.as_view(),
        name="admin-bookings-stats",
    ),

    # FEAT-002: Admin cinema seat list (all seats incl. inactive)
    path(
        "cinemas/<int:cinema_id>/seats/",
        CinemaSeatListView.as_view(),
        name="cinema-seats",
    ),

    # FEAT-002: Public cinema capacity
    path(
        "cinemas/<int:cinema_id>/capacity/",
        CinemaCapacityView.as_view(),
        name="cinema-capacity",
    ),

    # All router endpoints
    path(
        "",
        include(router.urls),
    ),
]
