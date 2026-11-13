
import os
import json
import pandas as pd
import numpy as np

# ==========================================
# TICKETIQ - FEATURE ENGINEERING
# ==========================================

INPUT_FILE = "data/processed/ticketiq_processed.csv"
OUTPUT_FILE = "data/processed/ticketiq_features.csv"
FEATURE_FILE = "data/processed/feature_columns.json"

print("=" * 60)
print("          TICKETIQ FEATURE ENGINEERING")
print("=" * 60)

# 1. Load dataset
print("\n1. Loading processed dataset...")

df = pd.read_csv(INPUT_FILE)

print("Dataset shape:", df.shape)

# 2. Validate required columns
print("\n2. Checking required columns...")

required_columns = [
    "show_id",
    "movie_id",
    "cinema_id",
    "show_date",
    "show_time",
    "tickets_booked",
    "ticket_price",
    "seats_available",
    "average_rating",
    "rating_count",
    "genres",
    "is_holiday",
    "promotion",
    "advance_booking_days"
]

missing_columns = [
    col for col in required_columns
    if col not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Missing required columns: {missing_columns}"
    )

# 3. Date features
print("\n3. Creating date features...")

df["show_date"] = pd.to_datetime(
    df["show_date"], errors="coerce"
)

if df["show_date"].isna().any():
    raise ValueError("Invalid show dates found.")

df["show_year"] = df["show_date"].dt.year
df["show_month"] = df["show_date"].dt.month
df["show_day"] = df["show_date"].dt.day

df["day_of_week_num"] = (
    df["show_date"].dt.day_of_week
)

df["is_weekend"] = (
    df["day_of_week_num"] >= 5
).astype(int)

df["is_month_start"] = (
    df["show_date"].dt.day <= 7
).astype(int)

# 4. Showtime features
print("\n4. Creating showtime features...")

show_datetime = pd.to_datetime(
    df["show_time"],
    format="%H:%M",
    errors="coerce"
)

if show_datetime.isna().any():
    raise ValueError("Invalid showtime values found.")

df["show_hour"] = show_datetime.dt.hour

def classify_show(hour):
    if hour < 12:
        return "Morning"
    elif hour < 17:
        return "Afternoon"
    elif hour < 20:
        return "Evening"
    else:
        return "Night"

df["show_period"] = df["show_hour"].apply(
    classify_show
)

# 5. Movie features
print("\n5. Creating movie features...")

df["average_rating"] = pd.to_numeric(
    df["average_rating"], errors="coerce"
).fillna(0)

df["rating_count"] = pd.to_numeric(
    df["rating_count"], errors="coerce"
).fillna(0)

df["movie_popularity_log"] = np.log1p(
    df["rating_count"]
)

max_popularity = df["movie_popularity_log"].max()

if max_popularity > 0:
    df["movie_popularity_score"] = (
        df["movie_popularity_log"] / max_popularity
    )
else:
    df["movie_popularity_score"] = 0

# 6. Genre features
print("\n6. Creating genre features...")

df["genres"] = df["genres"].fillna("Unknown")

genre_list = [
    "Action", "Adventure", "Animation",
    "Children", "Comedy", "Crime",
    "Documentary", "Drama", "Fantasy",
    "Horror", "Musical", "Mystery",
    "Romance", "Sci-Fi", "Thriller",
    "War", "Western"
]

for genre in genre_list:

    column = (
        "genre_" +
        genre.lower().replace("-", "_")
    )

    df[column] = df["genres"].apply(
        lambda value: int(
            genre in str(value).split("|")
        )
    )

# 7. Cinema capacity features
print("\n7. Creating cinema capacity features...")

df["seats_available"] = pd.to_numeric(
    df["seats_available"], errors="coerce"
)

df["capacity_category"] = pd.cut(
    df["seats_available"],
    bins=[0, 100, 150, 200, float("inf")],
    labels=[
        "Small",
        "Medium",
        "Large",
        "Extra_Large"
    ]
)

# 8. Pricing and booking features
print("\n8. Creating pricing and booking features...")

df["ticket_price"] = pd.to_numeric(
    df["ticket_price"], errors="coerce"
)

df["simulated_advance_booking_days"] = (
    pd.to_numeric(
        df["advance_booking_days"],
        errors="coerce"
    ).fillna(0)
)

df["promotion"] = pd.to_numeric(
    df["promotion"], errors="coerce"
).fillna(0).astype(int)

df["is_holiday"] = pd.to_numeric(
    df["is_holiday"], errors="coerce"
).fillna(0).astype(int)

# 9. Clean target variable
print("\n9. Cleaning target variable...")

df["tickets_booked"] = pd.to_numeric(
    df["tickets_booked"], errors="coerce"
)

df = df.dropna(
    subset=[
        "tickets_booked",
        "ticket_price",
        "seats_available"
    ]
)

df = df[
    (df["tickets_booked"] >= 0) &
    (df["tickets_booked"] <= df["seats_available"]) &
    (df["ticket_price"] > 0) &
    (df["seats_available"] > 0)
].copy()

# 10. Encode categorical features
print("\n10. Encoding categorical features...")

df = pd.get_dummies(
    df,
    columns=[
        "show_period",
        "capacity_category"
    ],
    dtype=int
)

# 11. Define ML features
print("\n11. Preparing machine learning features...")

feature_columns = [
    "average_rating",
    "rating_count",
    "movie_popularity_log",
    "movie_popularity_score",
    "ticket_price",
    "seats_available",
    "show_month",
    "show_day",
    "day_of_week_num",
    "is_weekend",
    "is_month_start",
    "show_hour",
    "is_holiday",
    "promotion",
    "simulated_advance_booking_days"
]

feature_columns += [
    "genre_" + g.lower().replace("-", "_")
    for g in genre_list
]

feature_columns += [
    col for col in df.columns
    if col.startswith("show_period_")
    or col.startswith("capacity_category_")
]

# Check feature availability
feature_columns = [
    col for col in feature_columns
    if col in df.columns
]

# Check invalid feature values
if df[feature_columns].isna().any().any():
    raise ValueError("Missing values found in model features.")

# 12. Save outputs
print("\n12. Saving feature dataset...")

os.makedirs(
    "data/processed",
    exist_ok=True
)

df.to_csv(
    OUTPUT_FILE,
    index=False
)

with open(FEATURE_FILE, "w") as file:
    json.dump(
        feature_columns,
        file,
        indent=4
    )

# 13. Final summary
print("\n" + "=" * 60)
print("       FEATURE ENGINEERING COMPLETED")
print("=" * 60)

print("Total records:", len(df))
print("Total columns:", len(df.columns))
print("Total ML features:", len(feature_columns))
print("Target variable: tickets_booked")

print("\nSaved files:")
print(OUTPUT_FILE)
print(FEATURE_FILE)

print("\nFeature columns:")
for feature in feature_columns:
    print("-", feature)

print("\nDataset source:", df["data_source"].value_counts().to_dict())

print("\nSUCCESS!")
print("=" * 60)
