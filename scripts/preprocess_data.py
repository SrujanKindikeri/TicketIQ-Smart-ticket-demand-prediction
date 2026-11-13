
import os
import pandas as pd
import numpy as np

print("=" * 55)
print("       TICKETIQ DATA PREPROCESSING")
print("=" * 55)

# File paths
SHOW_FILE = "data/raw/synthetic/shows.csv"
MOVIE_FILE = "data/raw/real/ml-latest-small/movies.csv"
RATING_FILE = "data/raw/real/ml-latest-small/ratings.csv"

OUTPUT_DIR = "data/processed"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Step 1: Load datasets
print("\n1. Loading datasets...")

shows = pd.read_csv(SHOW_FILE)
movies = pd.read_csv(MOVIE_FILE)
ratings = pd.read_csv(RATING_FILE)

print("Shows:", len(shows))
print("Movies:", len(movies))
print("Ratings:", len(ratings))

# Step 2: Clean movie metadata
print("\n2. Cleaning movie metadata...")

movies = movies.drop_duplicates(subset=["movieId"])

movies["title"] = movies["title"].fillna("Unknown")
movies["genres"] = movies["genres"].fillna("Unknown")

# Step 3: Calculate movie rating features
print("\n3. Creating movie rating features...")

movie_stats = ratings.groupby("movieId").agg(
    average_rating=("rating", "mean"),
    rating_count=("rating", "count")
).reset_index()

movies = movies.merge(
    movie_stats,
    on="movieId",
    how="left"
)

movies["average_rating"] = movies["average_rating"].fillna(0)
movies["rating_count"] = movies["rating_count"].fillna(0)

# Step 4: Extract release year
print("\n4. Extracting release year...")

movies["release_year"] = pd.to_numeric(
    movies["title"].str.extract(r"\((\d{4})\)$")[0],
    errors="coerce"
)

# Step 5: Process genres
print("\n5. Processing genres...")

movies["genres"] = movies["genres"].replace("(no genres listed)", "Unknown")

# Step 6: Merge movie information with shows
print("\n6. Merging datasets...")

df = shows.drop(
    columns=["movie_title", "genre", "movie_rating", "rating_count", "popularity"],
    errors="ignore"
)

df = df.merge(
    movies[[
        "movieId",
        "title",
        "genres",
        "average_rating",
        "rating_count",
        "release_year"
    ]],
    left_on="movie_id",
    right_on="movieId",
    how="left"
)

# Step 7: Handle missing values
print("\n7. Handling missing values...")

df["title"] = df["title"].fillna("Unknown")
df["genres"] = df["genres"].fillna("Unknown")
df["average_rating"] = df["average_rating"].fillna(0)
df["rating_count"] = df["rating_count"].fillna(0)
df["release_year"] = df["release_year"].fillna(0)

# Step 8: Feature engineering
print("\n8. Creating additional features...")

df["show_date"] = pd.to_datetime(df["show_date"])

df["show_month"] = df["show_date"].dt.month
df["show_day"] = df["show_date"].dt.day
df["show_year"] = df["show_date"].dt.year

df["is_weekend"] = (
    df["show_date"].dt.dayofweek >= 5
).astype(int)

df["days_since_release"] = np.where(
    df["release_year"] > 0,
    df["show_year"] - df["release_year"],
    np.nan
)

df["days_since_release"] = df["days_since_release"].clip(lower=0)

# Derive occupancy and revenue consistently
df["occupancy_rate"] = (
    df["tickets_booked"] / df["seats_available"] * 100
)

df["revenue"] = df["tickets_booked"] * df["ticket_price"]

# Step 9: Save processed dataset
print("\n9. Saving processed dataset...")

df.to_csv(
    f"{OUTPUT_DIR}/ticketiq_processed.csv",
    index=False
)

print("\nPREPROCESSING COMPLETED!")
print("Processed rows:", len(df))
print("Processed columns:", len(df.columns))
print("Output: data/processed/ticketiq_processed.csv")

print("\nMissing values:")
print(df.isnull().sum().sum())

print("=" * 55)
