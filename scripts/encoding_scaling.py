
import os
import json
import joblib
import pandas as pd

from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer

INPUT_FILE = "data/processed/ticketiq_features.csv"
OUTPUT_DIR = "data/processed"

print("=" * 60)
print("       TICKETIQ ENCODING AND SCALING")
print("=" * 60)

# 1. Load dataset
df = pd.read_csv(INPUT_FILE)

print("\n1. Dataset loaded:", df.shape)

# 2. Define target and identifiers
target = "tickets_booked"

excluded = [
    target,
    "show_id",
    "movie_id",
    "cinema_id",
    "movieId",
    "title",
    "movie_title",
    "genres",
    "show_date",
    "show_time",
    "day_of_week",
    "data_source",
    "occupancy_rate",
    "revenue"
]

# 3. Select model features
feature_columns = [
    col for col in df.columns
    if col not in excluded
]

X = df[feature_columns].copy()
y = df[target].copy()

# 4. Identify column types
numeric_columns = X.select_dtypes(
    include=["number"]
).columns.tolist()

categorical_columns = X.select_dtypes(
    include=["object", "category", "bool"]
).columns.tolist()

print("\n2. FEATURE TYPES")
print("Numerical features:", len(numeric_columns))
print("Categorical features:", len(categorical_columns))

# 5. Build numerical preprocessing
numeric_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler())
])

# 6. Build categorical preprocessing
categorical_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(
        handle_unknown="ignore",
        sparse_output=False
    ))
])

# 7. Combine preprocessing
transformers = []

if numeric_columns:
    transformers.append(
        ("numeric", numeric_pipeline, numeric_columns)
    )

if categorical_columns:
    transformers.append(
        ("categorical", categorical_pipeline, categorical_columns)
    )

preprocessor = ColumnTransformer(
    transformers=transformers,
    remainder="drop"
)

# 8. Fit transformation
print("\n3. Fitting preprocessing pipeline...")

X_transformed = preprocessor.fit_transform(X)

# 9. Save transformed dataset
print("\n4. Saving transformed dataset...")

feature_names = preprocessor.get_feature_names_out()

processed_X = pd.DataFrame(
    X_transformed,
    columns=feature_names
)

processed_X[target] = y.reset_index(drop=True)

processed_X.to_csv(
    f"{OUTPUT_DIR}/ticketiq_scaled.csv",
    index=False
)

# 10. Save pipeline
joblib.dump(
    preprocessor,
    f"{OUTPUT_DIR}/ticketiq_preprocessor.pkl"
)

# 11. Save feature metadata
with open(
    f"{OUTPUT_DIR}/encoded_feature_names.json",
    "w"
) as file:
    json.dump(
        list(feature_names),
        file,
        indent=4
    )

print("\n5. ENCODING COMPLETED")
print("Original features:", X.shape[1])
print("Encoded features:", len(feature_names))
print("Processed records:", len(processed_X))
print("Target:", target)

print("\nSaved:")
print("ticketiq_scaled.csv")
print("ticketiq_preprocessor.pkl")
print("encoded_feature_names.json")

print("\nSUCCESS!")
print("=" * 60)
