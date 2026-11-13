
import os
import pandas as pd

SHOW_FILE = "data/raw/synthetic/shows.csv"
CINEMA_FILE = "data/raw/synthetic/cinemas.csv"
MOVIE_FILE = "data/raw/real/ml-latest-small/movies.csv"

print("=" * 55)
print("          TICKETIQ DATA VALIDATION")
print("=" * 55)

# Load datasets
shows = pd.read_csv(SHOW_FILE)
cinemas = pd.read_csv(CINEMA_FILE)
movies = pd.read_csv(MOVIE_FILE)

# 1. Dataset dimensions
print("\n1. DATASET INFORMATION")
print("Total shows:", len(shows))
print("Total cinemas:", len(cinemas))
print("Total MovieLens movies:", len(movies))
print("Total columns:", len(shows.columns))

# 2. Missing values
print("\n2. MISSING VALUES")
missing = shows.isnull().sum()
print(missing[missing > 0] if missing.any() else "No missing values")

# 3. Duplicate records
print("\n3. DUPLICATE CHECKS")
print("Duplicate show IDs:", shows["show_id"].duplicated().sum())
print("Duplicate complete rows:", shows.duplicated().sum())

# 4. Booking validation
print("\n4. BOOKING VALIDATION")
print("Negative bookings:", (shows["tickets_booked"] < 0).sum())
print("Bookings above capacity:",
      (shows["tickets_booked"] > shows["seats_available"]).sum())

# 5. Occupancy validation
expected_occupancy = (
    shows["tickets_booked"] /
    shows["seats_available"] * 100
)

occupancy_errors = (
    (shows["occupancy_rate"] - expected_occupancy).abs() > 0.02
)

print("Invalid occupancy records:", occupancy_errors.sum())
print("Minimum occupancy:", shows["occupancy_rate"].min())
print("Maximum occupancy:", shows["occupancy_rate"].max())

# 6. Revenue validation
expected_revenue = (
    shows["tickets_booked"] * shows["ticket_price"]
)

revenue_errors = (
    shows["revenue"] != expected_revenue
)

print("Invalid revenue records:", revenue_errors.sum())

# 7. Foreign key validation
print("\n5. RELATIONSHIP VALIDATION")

unknown_cinemas = ~shows["cinema_id"].isin(cinemas["cinema_id"])
unknown_movies = ~shows["movie_id"].isin(movies["movieId"])

print("Unknown cinema IDs:", unknown_cinemas.sum())
print("Unknown movie IDs:", unknown_movies.sum())

# 8. Save report
os.makedirs("reports", exist_ok=True)

report = pd.DataFrame({
    "check": [
        "Total shows",
        "Total cinemas",
        "Missing values",
        "Duplicate show IDs",
        "Invalid bookings",
        "Invalid occupancy",
        "Invalid revenue",
        "Unknown cinema IDs",
        "Unknown movie IDs"
    ],
    "result": [
        len(shows),
        len(cinemas),
        int(shows.isnull().sum().sum()),
        int(shows["show_id"].duplicated().sum()),
        int(((shows["tickets_booked"] < 0) |
             (shows["tickets_booked"] > shows["seats_available"])).sum()),
        int(occupancy_errors.sum()),
        int(revenue_errors.sum()),
        int(unknown_cinemas.sum()),
        int(unknown_movies.sum())
    ]
})

report.to_csv("reports/data_validation_report.csv", index=False)

print("\nValidation report saved!")
print("reports/data_validation_report.csv")
print("=" * 55)
