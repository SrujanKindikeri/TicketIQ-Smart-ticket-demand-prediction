
import os
import numpy as np
import pandas as pd

# Reproducible synthetic data
np.random.seed(42)

BASE_DIR = "data/raw/synthetic"
MOVIE_FILE = "data/raw/real/ml-latest-small/movies.csv"
RATING_FILE = "data/raw/real/ml-latest-small/ratings.csv"

os.makedirs(BASE_DIR, exist_ok=True)

print("Loading MovieLens datasets...")

movies = pd.read_csv(MOVIE_FILE)
ratings = pd.read_csv(RATING_FILE)

# Calculate movie rating statistics
movie_stats = ratings.groupby("movieId").agg(
    movie_rating=("rating", "mean"),
    rating_count=("rating", "count")
).reset_index()

movies = movies.merge(movie_stats, on="movieId", how="left")

movies["movie_rating"] = movies["movie_rating"].fillna(
    movies["movie_rating"].mean()
)

movies["rating_count"] = movies["rating_count"].fillna(0)

# Popularity proxy based on rating volume
movies["popularity"] = np.log1p(movies["rating_count"])

movies["popularity"] = (
    movies["popularity"] - movies["popularity"].min()
) / (
    movies["popularity"].max() - movies["popularity"].min()
)

# Create 20 simulated cinemas
cinemas = []

for i in range(1, 21):
    cinemas.append({
        "cinema_id": f"CIN{i:03d}",
        "cinema_name": f"TicketIQ Cinema {i}",
        "city": np.random.choice([
            "Delhi", "Mumbai", "Bangalore",
            "Hyderabad", "Chennai", "Pune",
            "Phagwara", "Chandigarh"
        ]),
        "capacity": np.random.randint(80, 221),
        "data_source": "synthetic"
    })

cinema_df = pd.DataFrame(cinemas)

cinema_df.to_csv(
    f"{BASE_DIR}/cinemas.csv",
    index=False
)

print("Created 20 cinemas.")

# Simulated Indian holiday dates
holidays = {
    "2024-01-26", "2024-03-25", "2024-08-15",
    "2024-10-12", "2024-11-01", "2024-12-25",
    "2025-01-26", "2025-03-14", "2025-08-15",
    "2025-10-02", "2025-10-20", "2025-12-25"
}

# Daily showtime schedule
showtimes = [
    "10:00", "13:30", "17:00", "20:30"
]

# Generate two years of show records
dates = pd.date_range(
    start="2024-01-01",
    end="2025-12-31",
    freq="D"
)

# Weighted movie selection using rating volume
weights = movies["rating_count"].values.astype(float) + 1
weights = weights / weights.sum()

records = []

print("Generating cinema show records...")

for cinema in cinemas:

    for date in dates:

        date_string = date.strftime("%Y-%m-%d")

        is_weekend = int(date.dayofweek >= 5)
        is_holiday = int(date_string in holidays)

        for show_number in range(8):

            movie_index = np.random.choice(
                len(movies),
                p=weights
            )

            movie = movies.iloc[movie_index]

            showtime = showtimes[show_number % 4]

            capacity = cinema["capacity"] + np.random.randint(-15, 16)
            capacity = max(60, capacity)

            movie_rating = float(movie["movie_rating"])
            popularity = float(movie["popularity"])

            evening = int(showtime in ["17:00", "20:30"])

            promotion = int(np.random.random() < 0.25)

            advance_days = int(
                np.random.randint(0, 15)
            )

            ticket_price = (
                np.random.randint(150, 301)
                + evening * 40
                + is_weekend * 30
                - promotion * 20
            )

            # Demand probability
            demand_score = (
                -0.6
                + 0.20 * (movie_rating - 3.0)
                + 1.00 * popularity
                + 0.35 * is_weekend
                + 0.40 * is_holiday
                + 0.35 * evening
                + 0.20 * promotion
                + 0.025 * advance_days
                + np.random.normal(0, 0.30)
            )

            probability = 1 / (
                1 + np.exp(-demand_score)
            )

            tickets_booked = np.random.binomial(
                capacity,
                probability
            )

            occupancy_rate = (
                tickets_booked / capacity
            ) * 100

            revenue = tickets_booked * ticket_price

            records.append({
                "show_id": f"SHOW{len(records)+1:07d}",
                "cinema_id": cinema["cinema_id"],
                "movie_id": int(movie["movieId"]),
                "movie_title": movie["title"],
                "genre": movie["genres"],
                "show_date": date_string,
                "show_time": showtime,
                "day_of_week": date.day_name(),
                "is_weekend": is_weekend,
                "is_holiday": is_holiday,
                "movie_rating": round(movie_rating, 2),
                "rating_count": int(movie["rating_count"]),
                "popularity": round(popularity, 4),
                "ticket_price": int(ticket_price),
                "seats_available": int(capacity),
                "promotion": promotion,
                "advance_booking_days": advance_days,
                "tickets_booked": int(tickets_booked),
                "occupancy_rate": round(occupancy_rate, 2),
                "revenue": int(revenue),
                "data_source": "synthetic"
            })

# Convert to DataFrame
shows = pd.DataFrame(records)

# Save datasets
shows.to_csv(
    f"{BASE_DIR}/shows.csv",
    index=False
)

print("\nSynthetic dataset generated successfully!")
print("Total cinemas:", len(cinema_df))
print("Total shows:", len(shows))
print("Total movies used:", shows["movie_id"].nunique())
print("Total tickets sold:", shows["tickets_booked"].sum())
print("Average occupancy:", round(shows["occupancy_rate"].mean(), 2), "%")
print("Total simulated revenue: ₹", shows["revenue"].sum())

print("\nSaved files:")
print("cinemas.csv")
print("shows.csv")
