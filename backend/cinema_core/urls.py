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
    # Dashboard
    path(
        "dashboard/",
        DashboardView.as_view(),
        name="dashboard",
    ),

    # Show-specific seat availability
    path(
        "shows/<int:show_id>/seats/",
        ShowSeatView.as_view(),
        name="show-seats",
    ),

    # All router endpoints
    path(
        "",
        include(router.urls),
    ),
]