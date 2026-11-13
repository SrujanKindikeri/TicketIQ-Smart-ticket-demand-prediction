
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Project paths
ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "processed" / "ticketiq_processed.csv"
REPORT_DIR = ROOT / "reports" / "eda"
PLOT_DIR = REPORT_DIR / "plots"

REPORT_DIR.mkdir(parents=True, exist_ok=True)
PLOT_DIR.mkdir(parents=True, exist_ok=True)

sns.set_theme(style="whitegrid")

# Load dataset
df = pd.read_csv(DATA_PATH)
df["show_date"] = pd.to_datetime(df["show_date"], errors="coerce")

required = [
    "tickets_booked",
    "ticket_price",
    "seats_available",
    "occupancy_rate",
    "revenue",
    "show_time",
    "genres",
    "is_weekend",
]

missing = [col for col in required if col not in df.columns]
if missing:
    raise ValueError(f"Missing required columns: {missing}")

print("\n========== TICKETIQ EDA ==========")
print("Dataset shape:", df.shape)
print("\nMissing values:")
print(df[required].isna().sum())

# Summary statistics
summary = df[required[:5]].describe().round(2)
summary.to_csv(REPORT_DIR / "summary_statistics.csv")

# 1. Ticket demand distribution
plt.figure(figsize=(10, 6))
sns.histplot(df["tickets_booked"], bins=30, kde=True)
plt.title("Distribution of Tickets Booked")
plt.xlabel("Tickets Booked")
plt.ylabel("Number of Shows")
plt.tight_layout()
plt.savefig(PLOT_DIR / "ticket_demand_distribution.png", dpi=150)
plt.close()

# 2. Weekend vs weekday demand
plt.figure(figsize=(8, 5))
sns.boxplot(data=df, x="is_weekend", y="tickets_booked")
plt.title("Ticket Demand: Weekday vs Weekend")
plt.xlabel("Weekend (0 = No, 1 = Yes)")
plt.ylabel("Tickets Booked")
plt.tight_layout()
plt.savefig(PLOT_DIR / "weekend_vs_weekday.png", dpi=150)
plt.close()

# 3. Demand by showtime
plt.figure(figsize=(10, 6))
sns.boxplot(data=df, x="show_time", y="tickets_booked")
plt.title("Ticket Demand by Showtime")
plt.xlabel("Showtime")
plt.ylabel("Tickets Booked")
plt.xticks(rotation=30)
plt.tight_layout()
plt.savefig(PLOT_DIR / "demand_by_showtime.png", dpi=150)
plt.close()

# 4. Demand by genre
genre_data = (
    df.assign(genre=df["genres"].fillna("Unknown").str.split("|"))
      .explode("genre")
)
genre_summary = (
    genre_data.groupby("genre")["tickets_booked"]
    .agg(["mean", "median", "count"])
    .sort_values("mean", ascending=False)
)
genre_summary.to_csv(REPORT_DIR / "genre_demand.csv")

plt.figure(figsize=(11, 6))
sns.barplot(
    data=genre_summary.reset_index(),
    x="mean",
    y="genre"
)
plt.title("Average Ticket Demand by Genre")
plt.xlabel("Average Tickets Booked")
plt.ylabel("Genre")
plt.tight_layout()
plt.savefig(PLOT_DIR / "demand_by_genre.png", dpi=150)
plt.close()

# 5. Ticket price vs demand
plt.figure(figsize=(9, 6))
sns.scatterplot(
    data=df.sample(min(5000, len(df)), random_state=42),
    x="ticket_price",
    y="tickets_booked",
    alpha=0.35
)
plt.title("Ticket Price vs Ticket Demand")
plt.xlabel("Ticket Price")
plt.ylabel("Tickets Booked")
plt.tight_layout()
plt.savefig(PLOT_DIR / "price_vs_demand.png", dpi=150)
plt.close()

# 6. Monthly demand trend
monthly = (
    df.dropna(subset=["show_date"])
      .assign(month=lambda x: x["show_date"].dt.to_period("M").astype(str))
      .groupby("month")["tickets_booked"]
      .mean()
      .reset_index()
)

plt.figure(figsize=(12, 5))
sns.lineplot(data=monthly, x="month", y="tickets_booked", marker="o")
plt.title("Average Ticket Demand by Month")
plt.xlabel("Month")
plt.ylabel("Average Tickets Booked")
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(PLOT_DIR / "monthly_demand_trend.png", dpi=150)
plt.close()

# 7. Occupancy distribution
plt.figure(figsize=(9, 5))
sns.histplot(df["occupancy_rate"].dropna(), bins=30, kde=True)
plt.title("Cinema Occupancy Distribution")
plt.xlabel("Occupancy Rate")
plt.ylabel("Number of Shows")
plt.tight_layout()
plt.savefig(PLOT_DIR / "occupancy_distribution.png", dpi=150)
plt.close()

# 8. Correlation analysis
numeric = df.select_dtypes(include="number")
correlation = numeric.corr()
correlation.to_csv(REPORT_DIR / "correlation_matrix.csv")

plt.figure(figsize=(13, 9))
sns.heatmap(correlation, cmap="coolwarm", center=0)
plt.title("Feature Correlation Matrix")
plt.tight_layout()
plt.savefig(PLOT_DIR / "correlation_heatmap.png", dpi=150)
plt.close()

print("\nEDA completed.")
print("Reports saved to:", REPORT_DIR)
print("Charts saved to:", PLOT_DIR)
print("\nImportant: this dataset contains simulated cinema demand.")
print("These patterns are not verified real-world cinema trends.")
