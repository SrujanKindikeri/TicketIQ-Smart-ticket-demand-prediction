
import os
import json
import joblib
import pandas as pd
import numpy as np

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

# ==========================================
# TICKETIQ - FINAL ML DATASET PREPARATION
# ==========================================

INPUT_FILE = "data/processed/ticketiq_features.csv"
FEATURE_FILE = "data/processed/feature_columns.json"
OUTPUT_DIR = "data/processed/ml_ready"

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 60)
print("      TICKETIQ FINAL ML DATASET PREPARATION")
print("=" * 60)

# 1. Load data
print("\n1. Loading feature dataset...")

df = pd.read_csv(INPUT_FILE)

with open(FEATURE_FILE, "r") as f:
    feature_columns = json.load(f)

print("Total records:", len(df))

# 2. Validate columns
print("\n2. Validating columns...")

required = feature_columns + [
    "tickets_booked",
    "show_date",
    "show_id"
]

missing = [c for c in required if c not in df.columns]

if missing:
    raise ValueError(f"Missing columns: {missing}")

if df["show_id"].duplicated().any():
    raise ValueError("Duplicate show IDs detected.")

# 3. Clean target and dates
print("\n3. Cleaning target and dates...")

df["show_date"] = pd.to_datetime(
    df["show_date"], errors="coerce"
)

df["tickets_booked"] = pd.to_numeric(
    df["tickets_booked"], errors="coerce"
)

df = df.dropna(
    subset=["show_date", "tickets_booked"]
).copy()

df = df.sort_values(
    ["show_date", "show_id"]
).reset_index(drop=True)

# 4. Select model features
print("\n4. Selecting model features...")

X = df[feature_columns].copy()
y = df["tickets_booked"].astype(int).copy()

# All features must be available in the dataset
if X.isna().all().any():
    bad = X.columns[X.isna().all()].tolist()
    raise ValueError(f"Entirely missing features: {bad}")

# 5. Chronological train/test split
print("\n5. Splitting data chronologically...")

unique_dates = np.sort(df["show_date"].unique())

split_index = int(len(unique_dates) * 0.80)

if split_index <= 0 or split_index >= len(unique_dates):
    raise ValueError("Not enough dates for train/test split.")

cutoff_date = pd.Timestamp(unique_dates[split_index])

train_mask = df["show_date"] < cutoff_date
test_mask = df["show_date"] >= cutoff_date

X_train = X.loc[train_mask].copy()
X_test = X.loc[test_mask].copy()

y_train = y.loc[train_mask].copy()
y_test = y.loc[test_mask].copy()

print("Training records:", len(X_train))
print("Testing records:", len(X_test))
print("Training ends:", df.loc[train_mask, "show_date"].max())
print("Testing starts:", df.loc[test_mask, "show_date"].min())

# 6. Build preprocessing pipeline
print("\n6. Building preprocessing pipeline...")

numeric_columns = X_train.select_dtypes(
    include=["number"]
).columns.tolist()

categorical_columns = X_train.select_dtypes(
    include=["object", "category", "bool"]
).columns.tolist()

transformers = []

if numeric_columns:
    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])

    transformers.append(
        ("numeric", numeric_pipeline, numeric_columns)
    )

if categorical_columns:
    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(
            handle_unknown="ignore",
            sparse_output=False
        ))
    ])

    transformers.append(
        ("categorical", categorical_pipeline, categorical_columns)
    )

preprocessor = ColumnTransformer(
    transformers=transformers,
    remainder="drop"
)

# 7. Fit ONLY on training data
print("\n7. Fitting pipeline on training data...")

X_train_array = preprocessor.fit_transform(X_train)

# Test data only receives transform, never fit
X_test_array = preprocessor.transform(X_test)

encoded_names = preprocessor.get_feature_names_out()

X_train_final = pd.DataFrame(
    X_train_array,
    columns=encoded_names
)

X_test_final = pd.DataFrame(
    X_test_array,
    columns=encoded_names
)

# 8. Save final datasets
print("\n8. Saving ML datasets...")

X_train_final.to_csv(
    f"{OUTPUT_DIR}/X_train.csv", index=False
)

X_test_final.to_csv(
    f"{OUTPUT_DIR}/X_test.csv", index=False
)

y_train.to_frame().to_csv(
    f"{OUTPUT_DIR}/y_train.csv", index=False
)

y_test.to_frame().to_csv(
    f"{OUTPUT_DIR}/y_test.csv", index=False
)

# Save preprocessing pipeline
joblib.dump(
    preprocessor,
    f"{OUTPUT_DIR}/preprocessor.pkl"
)

# Save feature names
with open(
    f"{OUTPUT_DIR}/encoded_features.json", "w"
) as f:
    json.dump(list(encoded_names), f, indent=4)

# Save split information
metadata = {
    "target": "tickets_booked",
    "split_method": "chronological",
    "train_percentage": 80,
    "test_percentage": 20,
    "cutoff_date": str(cutoff_date),
    "training_records": len(X_train),
    "testing_records": len(X_test),
    "original_features": feature_columns,
    "encoded_features": list(encoded_names),
    "data_source": "synthetic cinema records with MovieLens features"
}

with open(
    f"{OUTPUT_DIR}/dataset_metadata.json", "w"
) as f:
    json.dump(metadata, f, indent=4)

# 9. Final report
print("\n" + "=" * 60)
print("       ML DATASET PREPARATION COMPLETED")
print("=" * 60)

print("Training samples:", len(X_train_final))
print("Testing samples:", len(X_test_final))
print("Input features:", len(encoded_names))
print("Target variable: tickets_booked")
print("Cutoff date:", cutoff_date)

print("\nGenerated files:")
print("X_train.csv")
print("X_test.csv")
print("y_train.csv")
print("y_test.csv")
print("preprocessor.pkl")
print("encoded_features.json")
print("dataset_metadata.json")

print("\nSUCCESS!")
print("=" * 60)
