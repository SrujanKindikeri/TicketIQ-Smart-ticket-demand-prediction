
import os
import pandas as pd
import numpy as np

FILE = "data/processed/ticketiq_processed.csv"

print("=" * 60)
print("     TICKETIQ ADVANCED DATA VALIDATION")
print("=" * 60)

df = pd.read_csv(FILE)

# 1. Dataset information
print("\n1. DATASET INFORMATION")
print("Rows:", len(df))
print("Columns:", len(df.columns))

# 2. Missing values
print("\n2. MISSING VALUES")
missing = df.isnull().sum()
print(missing[missing > 0] if missing.any() else "No missing values")

# 3. Duplicate records
print("\n3. DUPLICATE CHECK")
print("Duplicate show IDs:", df["show_id"].duplicated().sum())
print("Duplicate rows:", df.duplicated().sum())

# 4. Invalid numeric values
print("\n4. NUMERIC VALIDATION")

checks = {
    "Negative ticket bookings": (df["tickets_booked"] < 0).sum(),
    "Negative ticket prices": (df["ticket_price"] < 0).sum(),
    "Negative capacity": (df["seats_available"] <= 0).sum(),
    "Bookings above capacity": (
        df["tickets_booked"] > df["seats_available"]
    ).sum(),
    "Invalid occupancy": (
        (df["occupancy_rate"] < 0) |
        (df["occupancy_rate"] > 100)
    ).sum(),
    "Negative revenue": (df["revenue"] < 0).sum()
}

for name, value in checks.items():
    print(f"{name}: {value}")

# 5. Date validation
print("\n5. DATE VALIDATION")

df["show_date"] = pd.to_datetime(
    df["show_date"], errors="coerce"
)

print("Invalid dates:", df["show_date"].isna().sum())

# 6. Revenue consistency
print("\n6. REVENUE VALIDATION")

expected_revenue = (
    df["tickets_booked"] * df["ticket_price"]
)

revenue_errors = (
    df["revenue"] != expected_revenue
).sum()

print("Revenue mismatches:", revenue_errors)

# 7. Occupancy consistency
print("\n7. OCCUPANCY VALIDATION")

expected_occupancy = (
    df["tickets_booked"] /
    df["seats_available"] * 100
)

occupancy_errors = (
    (df["occupancy_rate"] - expected_occupancy).abs() > 0.02
).sum()

print("Occupancy mismatches:", occupancy_errors)

# 8. Category validation
print("\n8. CATEGORY VALIDATION")

print("Unknown genres:", (df["genres"] == "Unknown").sum())
print("Unique cinemas:", df["cinema_id"].nunique())
print("Unique movies:", df["movie_id"].nunique())

# 9. Save report
os.makedirs("reports", exist_ok=True)

report = pd.DataFrame({
    "validation": list(checks.keys()) + [
        "Duplicate show IDs",
        "Duplicate rows",
        "Invalid dates",
        "Revenue mismatches",
        "Occupancy mismatches"
    ],
    "errors": list(checks.values()) + [
        df["show_id"].duplicated().sum(),
        df.duplicated().sum(),
        df["show_date"].isna().sum(),
        revenue_errors,
        occupancy_errors
    ]
})

report.to_csv(
    "reports/processed_data_quality.csv",
    index=False
)

print("\nReport saved:")
print("reports/processed_data_quality.csv")

print("\nVALIDATION COMPLETED")
print("=" * 60)
