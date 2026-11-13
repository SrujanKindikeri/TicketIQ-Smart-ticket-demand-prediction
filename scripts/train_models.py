
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "processed" / "ml_ready"
MODEL_DIR = ROOT / "artifacts" / "models"
REPORT_DIR = ROOT / "reports" / "models"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

# Load prepared training and test datasets
X_train = pd.read_csv(DATA_DIR / "X_train.csv")
X_test = pd.read_csv(DATA_DIR / "X_test.csv")
y_train = pd.read_csv(DATA_DIR / "y_train.csv").squeeze("columns")
y_test = pd.read_csv(DATA_DIR / "y_test.csv").squeeze("columns")

print("Training shape:", X_train.shape)
print("Testing shape:", X_test.shape)

if len(X_train) != len(y_train) or len(X_test) != len(y_test):
    raise ValueError("Feature and target row counts do not match.")

if X_train.isna().any().any() or X_test.isna().any().any():
    raise ValueError("Missing values found. Check the preparation pipeline.")

# Models
models = {
    "Linear Regression": LinearRegression(),

    "Random Forest": RandomForestRegressor(
        n_estimators=200,
        max_depth=18,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    ),

    "XGBoost": XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=-1
    )
}

results = []

for name, model in models.items():
    print(f"\nTraining {name}...")

    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    r2 = r2_score(y_test, predictions)

    results.append({
        "model": name,
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4),
        "R2": round(r2, 4)
    })

    filename = name.lower().replace(" ", "_") + ".joblib"
    joblib.dump(model, MODEL_DIR / filename)

    print(f"MAE:  {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"R2:   {r2:.4f}")

# Save comparison
results_df = pd.DataFrame(results).sort_values("MAE")
results_df.to_csv(REPORT_DIR / "model_comparison.csv", index=False)

best_model_name = results_df.iloc[0]["model"]
metadata = {
    "best_model_by_mae": best_model_name,
    "target": "tickets_booked",
    "training_rows": int(len(X_train)),
    "testing_rows": int(len(X_test)),
    "metrics": results
}

with open(REPORT_DIR / "training_metadata.json", "w") as file:
    json.dump(metadata, file, indent=4)

print("\n========== MODEL COMPARISON ==========")
print(results_df.to_string(index=False))
print("\nBest model by MAE:", best_model_name)
print("\nModels saved to:", MODEL_DIR)
print("Reports saved to:", REPORT_DIR)

print(
    "\nWARNING: Results measure performance on synthetic demand data. "
    "They are not evidence of real-world cinema forecasting accuracy."
)
