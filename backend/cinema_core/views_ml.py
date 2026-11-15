"""
views_ml.py — ML prediction endpoints.
Loads trained models from artifacts/models/ and runs inference
against the most recent 30 Shows in the database.
"""
import json
import os
from pathlib import Path

from django.db.models import Sum
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .models import Show, Prediction

# Paths
BASE = Path(__file__).resolve().parent.parent.parent
ARTIFACTS_DIR = BASE / "artifacts" / "models"
PROCESSED_DIR = BASE / "data" / "processed"
FEATURE_COLUMNS_PATH = PROCESSED_DIR / "feature_columns.json"
MODEL_METRICS_PATH = PROCESSED_DIR / "model_metrics.json"


def _load_model():
    """Try xgboost, then random_forest, then linear_regression. Returns (model, name) or (None, None)."""
    import joblib
    for name in ("xgboost.joblib", "random_forest.joblib", "linear_regression.joblib"):
        path = ARTIFACTS_DIR / name
        if path.exists():
            try:
                model = joblib.load(path)
                return model, name.replace(".joblib", "")
            except Exception:
                continue
    return None, None


def _load_feature_columns():
    if FEATURE_COLUMNS_PATH.exists():
        with open(FEATURE_COLUMNS_PATH, "r") as f:
            return json.load(f)
    return []


def _build_feature_row(show, feature_columns):
    """Build a feature dict for a single Show matching feature_columns."""
    import pandas as pd
    from datetime import datetime

    dt = datetime.combine(show.show_date, show.show_time)
    hour = dt.hour
    if hour < 6:
        period = "Night"
    elif hour < 12:
        period = "Morning"
    elif hour < 17:
        period = "Afternoon"
    else:
        period = "Evening"

    total_capacity = show.seats_available
    if total_capacity <= 100:
        cap_cat = "Small"
    elif total_capacity <= 300:
        cap_cat = "Medium"
    elif total_capacity <= 600:
        cap_cat = "Large"
    else:
        cap_cat = "Extra_Large"

    genre = (show.movie.genre or "").lower().replace(" ", "_").replace("-", "_")
    rating = show.movie.average_rating or 0.0
    rating_count = show.movie.rating_count or 0
    popularity_score = rating * rating_count
    import math
    popularity_log = math.log1p(popularity_score)

    row = {
        "average_rating": rating,
        "rating_count": rating_count,
        "movie_popularity_log": popularity_log,
        "movie_popularity_score": popularity_score,
        "ticket_price": float(show.ticket_price),
        "seats_available": total_capacity,
        "show_month": show.show_date.month,
        "show_day": show.show_date.day,
        "day_of_week_num": show.show_date.weekday(),
        "is_weekend": int(show.show_date.weekday() >= 5),
        "is_month_start": int(show.show_date.day <= 5),
        "show_hour": hour,
        "is_holiday": 0,
        "promotion": int(show.promotion),
        "simulated_advance_booking_days": 7,
    }

    # Period one-hot
    for p in ("Afternoon", "Evening", "Morning", "Night"):
        row[f"show_period_{p}"] = int(period == p)

    # Capacity category one-hot
    for c in ("Small", "Medium", "Large", "Extra_Large"):
        row[f"capacity_category_{c}"] = int(cap_cat == c)

    # Genre one-hot — only genres that appear in feature_columns
    for col in feature_columns:
        if col.startswith("genre_"):
            g = col[len("genre_"):]
            row[col] = int(genre == g)

    # Build a DataFrame row aligned to feature_columns
    import pandas as pd
    df = pd.DataFrame([row])
    for col in feature_columns:
        if col not in df.columns:
            df[col] = 0
    df = df[feature_columns]
    return df


def _run_predictions(shows, model, feature_columns):
    """Returns list of dicts with prediction info per show."""
    import pandas as pd

    results = []
    for show in shows:
        try:
            features = _build_feature_row(show, feature_columns)
            pred_tickets = float(model.predict(features)[0])
            pred_tickets = max(0.0, min(pred_tickets, show.seats_available))
            pred_occupancy = round(pred_tickets / show.seats_available * 100, 2) if show.seats_available else 0.0
            pred_revenue = round(pred_tickets * float(show.ticket_price), 2)
        except Exception as exc:
            pred_tickets = 0.0
            pred_occupancy = 0.0
            pred_revenue = 0.0

        results.append({
            "show_id": show.id,
            "movie": show.movie.title,
            "cinema": show.cinema.name,
            "show_date": str(show.show_date),
            "show_time": str(show.show_time)[:5],
            "predicted_tickets": round(pred_tickets, 1),
            "predicted_occupancy": pred_occupancy,
            "predicted_revenue": pred_revenue,
            "actual_tickets": show.tickets_booked,
            "seats_available": show.seats_available,
        })
    return results


class MLPredictionsView(APIView):
    """
    GET /api/ml/predictions/
    Admin-only. Loads models, builds features from recent 30 shows, returns predictions.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        model, model_name = _load_model()
        if model is None:
            return Response({
                "status": "unavailable",
                "reason": "No trained model files found in artifacts/models/. Run training to generate models.",
            })

        feature_columns = _load_feature_columns()
        if not feature_columns:
            return Response({
                "status": "unavailable",
                "reason": "feature_columns.json not found in data/processed/.",
            })

        shows = (
            Show.objects.select_related("movie", "cinema")
            .order_by("-show_date", "-show_time")[:30]
        )

        try:
            predictions = _run_predictions(list(shows), model, feature_columns)
        except Exception as exc:
            return Response({
                "status": "unavailable",
                "reason": f"Prediction failed: {str(exc)}",
            })

        # Aggregate statistics
        total_pred_tickets = sum(p["predicted_tickets"] for p in predictions)
        total_pred_revenue = sum(p["predicted_revenue"] for p in predictions)
        total_capacity = sum(p["seats_available"] for p in predictions)
        avg_occupancy = round(
            sum(p["predicted_occupancy"] for p in predictions) / len(predictions), 2
        ) if predictions else 0.0

        # Model metrics if available
        metrics = None
        if MODEL_METRICS_PATH.exists():
            try:
                with open(MODEL_METRICS_PATH, "r") as f:
                    metrics = json.load(f)
            except Exception:
                metrics = None

        response = {
            "status": "ok",
            "model_name": model_name,
            "feature_count": len(feature_columns),
            "predictions": predictions,
            "summary": {
                "predicted_tickets": round(total_pred_tickets, 1),
                "predicted_revenue": round(total_pred_revenue, 2),
                "predicted_occupancy": avg_occupancy,
                "total_capacity": total_capacity,
                "show_count": len(predictions),
            },
        }
        if metrics is not None:
            response["model_metrics"] = metrics

        return Response(response)


class GeneratePredictionsView(APIView):
    """
    POST /api/ml/predictions/generate/
    Admin-only. Runs predictions and persists them to the Prediction model.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        model, model_name = _load_model()
        if model is None:
            return Response({
                "status": "unavailable",
                "reason": "No trained model files found in artifacts/models/.",
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        feature_columns = _load_feature_columns()
        if not feature_columns:
            return Response({
                "status": "unavailable",
                "reason": "feature_columns.json not found.",
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        shows = list(
            Show.objects.select_related("movie", "cinema")
            .order_by("-show_date", "-show_time")[:30]
        )

        try:
            predictions = _run_predictions(shows, model, feature_columns)
        except Exception as exc:
            return Response({
                "status": "unavailable",
                "reason": f"Prediction failed: {str(exc)}",
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        saved = 0
        for p, show in zip(predictions, shows):
            # Clamp occupancy to [0, 100]
            occupancy = max(0.0, min(100.0, p["predicted_occupancy"]))
            Prediction.objects.update_or_create(
                show=show,
                defaults={
                    "predicted_tickets": p["predicted_tickets"],
                    "predicted_occupancy": occupancy,
                    "predicted_revenue": p["predicted_revenue"],
                    "model_name": model_name,
                    "model_version": "1.0",
                },
            )
            saved += 1

        return Response({
            "status": "ok",
            "saved": saved,
            "model_name": model_name,
        })
