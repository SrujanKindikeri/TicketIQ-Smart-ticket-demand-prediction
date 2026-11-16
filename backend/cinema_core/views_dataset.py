"""
views_dataset.py — Dataset Demo mode API endpoints.

All views use AllowAny permission, follow the DashboardView pattern from views.py,
and derive file roots from the project structure so they work on any machine.
"""
import csv
import io
import json
import math
import os
from pathlib import Path

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import StreamingHttpResponse

# Root paths ----------------------------------------------------------------
BASE = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE / "data"
RAW_REAL_DIR = DATA_DIR / "raw" / "real"
RAW_SYNTH_DIR = DATA_DIR / "raw" / "synthetic"
INTERIM_DIR = DATA_DIR / "interim"
PROCESSED_DIR = DATA_DIR / "processed"
ARTIFACTS_DIR = BASE / "artifacts" / "models"
MODEL_METRICS_PATH = PROCESSED_DIR / "model_metrics.json"
FEATURE_COLUMNS_PATH = PROCESSED_DIR / "feature_columns.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _try_import_pandas():
    try:
        import pandas as pd
        return pd
    except ImportError:
        return None


def _discover_datasets():
    """
    Scan the four data directories and return a list of dataset descriptors.
    Each entry: {id, name, file_path (abs), label, file_type}
    """
    dirs = [
        (RAW_REAL_DIR, "real"),
        (RAW_SYNTH_DIR, "synthetic"),
        (INTERIM_DIR, "interim"),
        (PROCESSED_DIR, "processed"),
    ]
    datasets = []
    for directory, label in dirs:
        if not directory.exists():
            continue
        for path in sorted(directory.rglob("*")):
            if path.suffix.lower() in (".csv", ".parquet") and path.is_file():
                rel = path.relative_to(BASE)
                ds_id = str(rel).replace(os.sep, "__").replace("/", "__").replace(".", "_")
                datasets.append({
                    "id": ds_id,
                    "name": path.name,
                    "file_path": str(rel),
                    "abs_path": path,
                    "label": label,
                    "file_type": path.suffix.lower().lstrip("."),
                })
    return datasets


def _dataset_by_id(dataset_id):
    for ds in _discover_datasets():
        if ds["id"] == dataset_id:
            return ds
    return None


def _read_df(path, file_type):
    """Read a CSV or parquet file into a pandas DataFrame. Returns (df, error_str)."""
    pd = _try_import_pandas()
    if pd is None:
        return None, "pandas is not installed"
    try:
        if file_type == "csv":
            df = pd.read_csv(path, low_memory=False)
        elif file_type == "parquet":
            try:
                df = pd.read_parquet(path)
            except ImportError:
                return None, "pyarrow or fastparquet is required to read .parquet files"
        else:
            return None, f"Unsupported file type: {file_type}"
        return df, None
    except Exception as exc:
        return None, str(exc)


def _date_range(df):
    """Return (min_date, max_date) strings from any column whose name contains 'date'."""
    for col in df.columns:
        if "date" in col.lower():
            try:
                dates = df[col].dropna()
                if len(dates) == 0:
                    continue
                return str(dates.min()), str(dates.max())
            except Exception:
                pass
    return None, None


def _column_descriptors(df):
    cols = []
    for col in df.columns:
        cols.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "description": "",
        })
    return cols


def _paginate(total, page, page_size):
    total_pages = math.ceil(total / page_size) if page_size else 1
    offset = (page - 1) * page_size
    return offset, total_pages


# ---------------------------------------------------------------------------
# Main synthetic CSV paths (used by several demo views)
# ---------------------------------------------------------------------------

def _shows_path():
    p = RAW_SYNTH_DIR / "shows.csv"
    return p if p.exists() else None


def _cinemas_path():
    p = RAW_SYNTH_DIR / "cinemas.csv"
    return p if p.exists() else None


def _movies_path():
    # MovieLens movies.csv lives in a sub-folder
    p = RAW_REAL_DIR / "ml-latest-small" / "movies.csv"
    if p.exists():
        return p
    # Fallback: anywhere in raw/real
    for f in RAW_REAL_DIR.rglob("movies.csv"):
        return f
    return None


def _ratings_path():
    p = RAW_REAL_DIR / "ml-latest-small" / "ratings.csv"
    if p.exists():
        return p
    for f in RAW_REAL_DIR.rglob("ratings.csv"):
        return f
    return None


# ---------------------------------------------------------------------------
# DatasetListView  GET /api/dataset/
# ---------------------------------------------------------------------------

class DatasetListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        pd = _try_import_pandas()
        datasets = _discover_datasets()
        result = []
        for ds in datasets:
            entry = {
                "id": ds["id"],
                "name": ds["name"],
                "file_path": ds["file_path"],
                "data_source": ds["label"],
                "file_type": ds["file_type"],
            }
            if pd is None:
                entry["error"] = "pandas not installed — cannot read file metadata"
                result.append(entry)
                continue

            df, err = _read_df(ds["abs_path"], ds["file_type"])
            if err:
                entry["error"] = err
                result.append(entry)
                continue

            min_date, max_date = _date_range(df)
            entry.update({
                "record_count": len(df),
                "column_count": len(df.columns),
                "missing_value_count": int(df.isnull().sum().sum()),
                "date_range": {"min": min_date, "max": max_date} if min_date else None,
                "columns": _column_descriptors(df),
            })
            result.append(entry)

        return Response(result)


# ---------------------------------------------------------------------------
# DatasetPreviewView  GET /api/dataset/<dataset_id>/preview/
# ---------------------------------------------------------------------------

class DatasetPreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, dataset_id):
        ds = _dataset_by_id(dataset_id)
        if ds is None:
            return Response({"error": "Dataset not found", "warning": "No matching dataset file."}, status=404)

        pd = _try_import_pandas()
        if pd is None:
            return Response({"error": "pandas is not installed on the server."}, status=503)

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(200, max(1, int(request.query_params.get("page_size", 50))))
        except (TypeError, ValueError):
            page_size = 50

        search = request.query_params.get("search", "").strip()

        df, err = _read_df(ds["abs_path"], ds["file_type"])
        if err:
            return Response({"error": err, "warning": "File could not be read.", "count": 0, "page": page, "page_size": page_size, "total_pages": 0, "columns": [], "rows": []})

        if search:
            # Filter rows where any string column contains the search term
            mask = df.apply(
                lambda col: col.astype(str).str.contains(search, case=False, na=False)
            ).any(axis=1)
            df = df[mask]

        total = len(df)
        offset, total_pages = _paginate(total, page, page_size)
        page_df = df.iloc[offset: offset + page_size]

        rows = page_df.where(page_df.notna(), None).values.tolist()
        columns = list(df.columns)

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "columns": columns,
            "rows": rows,
        })


# ---------------------------------------------------------------------------
# DatasetDownloadView  GET /api/dataset/<dataset_id>/download/
# ---------------------------------------------------------------------------

class DatasetDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, dataset_id):
        ds = _dataset_by_id(dataset_id)
        if ds is None:
            return Response({"error": "Dataset not found."}, status=404)

        file_type = ds["file_type"]
        path = ds["abs_path"]
        filename = ds["name"].replace(".parquet", ".csv")

        def _csv_rows_from_csv(filepath):
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                yield f.read()

        def _csv_rows_from_parquet(filepath):
            pd = _try_import_pandas()
            if pd is None:
                yield "error: pandas not installed\n"
                return
            df, err = _read_df(filepath, "parquet")
            if err:
                yield f"error: {err}\n"
                return
            buf = io.StringIO()
            df.to_csv(buf, index=False)
            yield buf.getvalue()

        if file_type == "csv":
            gen = _csv_rows_from_csv(path)
        else:
            gen = _csv_rows_from_parquet(path)

        response = StreamingHttpResponse(gen, content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


# ---------------------------------------------------------------------------
# DemoDashboardView  GET /api/dataset/dashboard/
# ---------------------------------------------------------------------------

class DemoDashboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        base = {
            "total_cinemas": 0,
            "total_movies": 0,
            "total_shows": 0,
            "total_bookings": 0,
            "total_revenue": "0.00",
            "overall_occupancy": 0,
            "data_source": "demo",
        }

        shows_path = _shows_path()
        cinemas_path = _cinemas_path()

        pd = _try_import_pandas()
        if pd is None:
            base["warning"] = "pandas not installed — returning zero stats"
            return Response(base)

        if shows_path is None:
            base["warning"] = "Synthetic shows dataset not found"
            return Response(base)

        df, err = _read_df(shows_path, "csv")
        if err:
            base["warning"] = f"Could not read shows dataset: {err}"
            return Response(base)

        total_shows = len(df)
        total_movies = df["movie_id"].nunique() if "movie_id" in df.columns else 0

        total_cinemas = 0
        if cinemas_path:
            cdf, cerr = _read_df(cinemas_path, "csv")
            if not cerr:
                total_cinemas = len(cdf)

        total_bookings = int(df["tickets_booked"].sum()) if "tickets_booked" in df.columns else 0
        total_revenue = round(float(df["revenue"].sum()), 2) if "revenue" in df.columns else 0.0

        total_capacity = int(df["seats_available"].sum()) if "seats_available" in df.columns else 0
        overall_occupancy = round(total_bookings / total_capacity * 100, 2) if total_capacity else 0.0

        return Response({
            "total_cinemas": total_cinemas,
            "total_movies": total_movies,
            "total_shows": total_shows,
            "total_bookings": total_bookings,
            "total_revenue": str(total_revenue),
            "overall_occupancy": overall_occupancy,
            "data_source": "demo",
        })


# ---------------------------------------------------------------------------
# DemoMoviesView  GET /api/dataset/movies/
# ---------------------------------------------------------------------------

class DemoMoviesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        empty = {"count": 0, "page": 1, "page_size": 50, "total_pages": 0, "results": [], "data_source": "demo"}

        pd = _try_import_pandas()
        if pd is None:
            return Response({**empty, "warning": "pandas not installed"})

        movies_path = _movies_path()
        if movies_path is None:
            return Response({**empty, "warning": "MovieLens movies.csv not found in data/raw/real/"})

        df, err = _read_df(movies_path, "csv")
        if err:
            return Response({**empty, "warning": err})

        # Merge average rating if ratings file available
        ratings_path = _ratings_path()
        if ratings_path:
            rdf, rerr = _read_df(ratings_path, "csv")
            if not rerr and "movieId" in rdf.columns and "rating" in rdf.columns:
                agg = rdf.groupby("movieId")["rating"].agg(["mean", "count"]).reset_index()
                agg.columns = ["movieId", "avg_rating", "rating_count"]
                df = df.merge(agg, on="movieId", how="left")
            else:
                df["avg_rating"] = None
                df["rating_count"] = 0
        else:
            df["avg_rating"] = None
            df["rating_count"] = 0

        # Extract year from title  e.g. "Toy Story (1995)"
        df["year"] = df["title"].str.extract(r"\((\d{4})\)$")[0]

        # Filters
        search = request.query_params.get("search", "").strip()
        genre_filter = request.query_params.get("genre", "").strip()
        if search:
            df = df[df["title"].str.contains(search, case=False, na=False)]
        if genre_filter:
            df = df[df["genres"].str.contains(genre_filter, case=False, na=False)]

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(200, max(1, int(request.query_params.get("page_size", 50))))
        except (TypeError, ValueError):
            page_size = 50

        total = len(df)
        offset, total_pages = _paginate(total, page, page_size)
        page_df = df.iloc[offset: offset + page_size]

        results = []
        for _, row in page_df.iterrows():
            results.append({
                "id": int(row["movieId"]) if pd.notna(row.get("movieId")) else None,
                "title": row["title"],
                "genre": row.get("genres", ""),
                "year": row.get("year"),
                "avg_rating": round(float(row["avg_rating"]), 2) if pd.notna(row.get("avg_rating")) else None,
                "rating_count": int(row["rating_count"]) if pd.notna(row.get("rating_count")) else 0,
            })

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "results": results,
            "data_source": "demo",
        })


# ---------------------------------------------------------------------------
# DemoCinemasView  GET /api/dataset/cinemas/
# ---------------------------------------------------------------------------

class DemoCinemasView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        empty = {"count": 0, "results": [], "data_source": "demo"}

        pd = _try_import_pandas()
        if pd is None:
            return Response({**empty, "warning": "pandas not installed"})

        cinemas_path = _cinemas_path()
        if cinemas_path is None:
            return Response({**empty, "warning": "cinemas.csv not found in data/raw/synthetic/"})

        df, err = _read_df(cinemas_path, "csv")
        if err:
            return Response({**empty, "warning": err})

        results = []
        for _, row in df.iterrows():
            results.append({
                "id": row.get("cinema_id", ""),
                "name": row.get("cinema_name", ""),
                "location": row.get("city", ""),
                "city": row.get("city", ""),
                "total_seats": int(row["capacity"]) if pd.notna(row.get("capacity")) else 0,
            })

        return Response({
            "count": len(results),
            "results": results,
            "data_source": "demo",
        })


# ---------------------------------------------------------------------------
# DemoShowsView  GET /api/dataset/shows/
# ---------------------------------------------------------------------------

class DemoShowsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        empty = {"count": 0, "page": 1, "page_size": 50, "total_pages": 0, "results": [], "data_source": "demo"}

        pd = _try_import_pandas()
        if pd is None:
            return Response({**empty, "warning": "pandas not installed"})

        shows_path = _shows_path()
        if shows_path is None:
            return Response({**empty, "warning": "shows.csv not found in data/raw/synthetic/"})

        df, err = _read_df(shows_path, "csv")
        if err:
            return Response({**empty, "warning": err})

        # Filters
        search = request.query_params.get("search", "").strip()
        if search:
            mask = (
                df["movie_title"].str.contains(search, case=False, na=False) |
                df.get("cinema_name", df.get("cinema_id", pd.Series([""] * len(df)))).str.contains(search, case=False, na=False)
            )
            df = df[mask]

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(200, max(1, int(request.query_params.get("page_size", 50))))
        except (TypeError, ValueError):
            page_size = 50

        total = len(df)
        offset, total_pages = _paginate(total, page, page_size)
        page_df = df.iloc[offset: offset + page_size]

        results = []
        for idx, row in page_df.iterrows():
            occupancy = row.get("occupancy_rate", 0)
            try:
                occupancy = round(float(occupancy), 2)
            except (TypeError, ValueError):
                occupancy = 0.0

            results.append({
                "id": row.get("show_id", idx),
                "movie_title": row.get("movie_title", ""),
                "cinema_name": row.get("cinema_name", row.get("cinema_id", "")),
                "show_date": str(row.get("show_date", "")),
                "show_time": str(row.get("show_time", "")),
                "ticket_price": float(row.get("ticket_price", 0)),
                "seats_available": int(row.get("seats_available", 0)),
                "tickets_booked": int(row.get("tickets_booked", 0)),
                "occupancy_rate": occupancy,
                "revenue": float(row.get("revenue", 0)),
            })

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "results": results,
            "data_source": "demo",
        })


# ---------------------------------------------------------------------------
# DemoBookingsView  GET /api/dataset/bookings/
# ---------------------------------------------------------------------------

class DemoBookingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        empty = {"count": 0, "page": 1, "page_size": 50, "total_pages": 0, "results": [], "data_source": "demo",
                 "stats": {"total_bookings": 0, "total_revenue": "0.00", "avg_tickets_per_show": 0}}

        pd = _try_import_pandas()
        if pd is None:
            return Response({**empty, "warning": "pandas not installed"})

        shows_path = _shows_path()
        if shows_path is None:
            return Response({**empty, "warning": "shows.csv not found in data/raw/synthetic/"})

        df, err = _read_df(shows_path, "csv")
        if err:
            return Response({**empty, "warning": err})

        # Generate plausible booking records from show rows
        # Each show row acts as a single "booking" record
        search = request.query_params.get("search", "").strip()
        if search:
            df = df[df["movie_title"].str.contains(search, case=False, na=False)]

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(200, max(1, int(request.query_params.get("page_size", 50))))
        except (TypeError, ValueError):
            page_size = 50

        total_bookings = int(df["tickets_booked"].sum()) if "tickets_booked" in df.columns else len(df)
        total_revenue = round(float(df["revenue"].sum()), 2) if "revenue" in df.columns else 0.0

        total = len(df)
        offset, total_pages = _paginate(total, page, page_size)
        page_df = df.iloc[offset: offset + page_size]

        results = []
        for idx, row in page_df.iterrows():
            results.append({
                "id": row.get("show_id", idx),
                "movie_title": row.get("movie_title", ""),
                "cinema_name": row.get("cinema_name", row.get("cinema_id", "")),
                "show_date": str(row.get("show_date", "")),
                "show_time": str(row.get("show_time", "")),
                "tickets_booked": int(row.get("tickets_booked", 0)),
                "revenue": float(row.get("revenue", 0)),
                "ticket_price": float(row.get("ticket_price", 0)),
                "occupancy_rate": round(float(row.get("occupancy_rate", 0)), 2),
                "status": "confirmed",
                "data_source": "synthetic",
            })

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "results": results,
            "stats": {
                "total_bookings": total_bookings,
                "total_revenue": str(total_revenue),
                "avg_tickets_per_show": round(total_bookings / total, 1) if total else 0,
            },
            "data_source": "demo",
        })


# ---------------------------------------------------------------------------
# DemoPredictionsView  GET /api/dataset/predictions/
# ---------------------------------------------------------------------------

def _load_model():
    """Try xgboost, then random_forest, then linear_regression. Returns (model, name) or (None, None)."""
    try:
        import joblib
    except ImportError:
        return None, None
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


def _build_feature_row_from_show_dict(row, feature_columns):
    """Build a feature DataFrame row from a synthetic show dict (not a DB Show)."""
    try:
        import pandas as pd
        import math as _math

        show_time = str(row.get("show_time", "10:00"))
        try:
            hour = int(show_time.split(":")[0])
        except (ValueError, AttributeError):
            hour = 10

        if hour < 6:
            period = "Night"
        elif hour < 12:
            period = "Morning"
        elif hour < 17:
            period = "Afternoon"
        else:
            period = "Evening"

        total_capacity = int(row.get("seats_available", 150))
        if total_capacity <= 100:
            cap_cat = "Small"
        elif total_capacity <= 300:
            cap_cat = "Medium"
        elif total_capacity <= 600:
            cap_cat = "Large"
        else:
            cap_cat = "Extra_Large"

        genre = str(row.get("genre", "")).lower().replace(" ", "_").replace("-", "_").replace("|", "_")
        rating = float(row.get("movie_rating", 3.5) or 3.5)
        rating_count = int(row.get("rating_count", 10) or 10)
        popularity_score = rating * rating_count
        popularity_log = _math.log1p(popularity_score)

        show_date_str = str(row.get("show_date", "2024-01-01"))
        try:
            from datetime import date as _date
            parts = show_date_str.split("-")
            sd = _date(int(parts[0]), int(parts[1]), int(parts[2]))
            month = sd.month
            day = sd.day
            dow = sd.weekday()
            is_weekend = int(dow >= 5)
            is_month_start = int(day <= 5)
        except Exception:
            month, day, dow, is_weekend, is_month_start = 1, 1, 0, 0, 0

        feat = {
            "average_rating": rating,
            "rating_count": rating_count,
            "movie_popularity_log": popularity_log,
            "movie_popularity_score": popularity_score,
            "ticket_price": float(row.get("ticket_price", 150)),
            "seats_available": total_capacity,
            "show_month": month,
            "show_day": day,
            "day_of_week_num": dow,
            "is_weekend": is_weekend,
            "is_month_start": is_month_start,
            "show_hour": hour,
            "is_holiday": int(row.get("is_holiday", 0) or 0),
            "promotion": int(row.get("promotion", 0) or 0),
            "simulated_advance_booking_days": int(row.get("advance_booking_days", 7) or 7),
        }

        for p in ("Afternoon", "Evening", "Morning", "Night"):
            feat[f"show_period_{p}"] = int(period == p)

        for c in ("Small", "Medium", "Large", "Extra_Large"):
            feat[f"capacity_category_{c}"] = int(cap_cat == c)

        for col in feature_columns:
            if col.startswith("genre_"):
                g = col[len("genre_"):]
                feat[col] = int(genre == g or g in genre)

        df = pd.DataFrame([feat])
        for col in feature_columns:
            if col not in df.columns:
                df[col] = 0
        df = df[feature_columns]
        return df
    except Exception:
        return None


class DemoPredictionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        unavailable_base = {
            "data_source": "demo",
            "disclaimer": (
                "Predictions derived from synthetic dataset — "
                "do not represent real-world accuracy."
            ),
        }

        model, model_name = _load_model()
        if model is None:
            return Response({
                **unavailable_base,
                "status": "unavailable",
                "reason": "No trained model files found in artifacts/models/. Run training to generate models.",
            })

        feature_columns = _load_feature_columns()
        if not feature_columns:
            return Response({
                **unavailable_base,
                "status": "unavailable",
                "reason": "feature_columns.json not found in data/processed/.",
            })

        pd = _try_import_pandas()
        if pd is None:
            return Response({
                **unavailable_base,
                "status": "unavailable",
                "reason": "pandas not installed on server.",
            })

        shows_path = _shows_path()
        if shows_path is None:
            return Response({
                **unavailable_base,
                "status": "unavailable",
                "reason": "Synthetic shows.csv not found.",
            })

        df, err = _read_df(shows_path, "csv")
        if err:
            return Response({
                **unavailable_base,
                "status": "unavailable",
                "reason": f"Could not read shows.csv: {err}",
            })

        # Use first 30 rows for predictions (same limit as live mode)
        sample = df.head(30)
        predictions = []
        for idx, row in sample.iterrows():
            row_dict = row.to_dict()
            features = _build_feature_row_from_show_dict(row_dict, feature_columns)
            if features is None:
                continue
            try:
                seats = int(row.get("seats_available", 150) or 150)
                price = float(row.get("ticket_price", 150) or 150)
                pred_tickets = float(model.predict(features)[0])
                pred_tickets = max(0.0, min(pred_tickets, seats))
                pred_occupancy = round(pred_tickets / seats * 100, 2) if seats else 0.0
                pred_revenue = round(pred_tickets * price, 2)
            except Exception:
                pred_tickets = 0.0
                pred_occupancy = 0.0
                pred_revenue = 0.0

            predictions.append({
                "show_id": row.get("show_id", idx),
                "movie": row.get("movie_title", ""),
                "cinema": row.get("cinema_name", row.get("cinema_id", "")),
                "show_date": str(row.get("show_date", "")),
                "show_time": str(row.get("show_time", "")),
                "predicted_tickets": round(pred_tickets, 1),
                "predicted_occupancy": pred_occupancy,
                "predicted_revenue": pred_revenue,
                "actual_tickets": int(row.get("tickets_booked", 0)),
                "seats_available": int(row.get("seats_available", 0)),
            })

        if not predictions:
            return Response({
                **unavailable_base,
                "status": "unavailable",
                "reason": "Could not build any prediction rows from the synthetic dataset.",
            })

        total_pred_tickets = sum(p["predicted_tickets"] for p in predictions)
        total_pred_revenue = sum(p["predicted_revenue"] for p in predictions)
        total_capacity = sum(p["seats_available"] for p in predictions)
        avg_occupancy = round(
            sum(p["predicted_occupancy"] for p in predictions) / len(predictions), 2
        ) if predictions else 0.0

        metrics = None
        if MODEL_METRICS_PATH.exists():
            try:
                with open(MODEL_METRICS_PATH, "r") as f:
                    metrics = json.load(f)
            except Exception:
                metrics = None

        response = {
            **unavailable_base,
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
