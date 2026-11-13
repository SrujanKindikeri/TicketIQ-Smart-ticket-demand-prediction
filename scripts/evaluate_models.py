
from pathlib import Path
import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

ROOT = Path(__file__).resolve().parents[1]

DATA_DIR = ROOT / "data" / "processed" / "ml_ready"
MODEL_DIR = ROOT / "artifacts" / "models"
REPORT_DIR = ROOT / "reports" / "models"

REPORT_DIR.mkdir(parents=True, exist_ok=True)

X_test = pd.read_csv(DATA_DIR / "X_test.csv")
y_test = pd.read_csv(DATA_DIR / "y_test.csv").squeeze("columns")

model_files = {
    "Linear Regression": "linear_regression.joblib",
    "Random Forest": "random_forest.joblib",
    "XGBoost": "xgboost.joblib"
}

results = []

for model_name, filename in model_files.items():

    model_path = MODEL_DIR / filename

    if not model_path.exists():
        print(f"Skipping {model_name}: model file not found.")
        continue

    model = joblib.load(model_path)
    predictions = model.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    r2 = r2_score(y_test, predictions)

    results.append({
        "Model": model_name,
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4),
        "R2": round(r2, 4)
    })

if not results:
    raise RuntimeError("No trained models were found.")

results_df = pd.DataFrame(results).sort_values("MAE")

results_df.to_csv(
    REPORT_DIR / "final_evaluation.csv",
    index=False
)

print("\n========== FINAL MODEL EVALUATION ==========")
print(results_df.to_string(index=False))

print("\nBest model based on MAE:")
print(results_df.iloc[0]["Model"])

print("\nReport saved to:", REPORT_DIR / "final_evaluation.csv")

print(
    "\nNote: Evaluation uses synthetic cinema demand data. "
    "It does not establish real-world forecasting accuracy."
)
