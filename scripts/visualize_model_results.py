
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports" / "models"
PLOT_DIR = REPORT_DIR / "plots"

RESULT_FILE = REPORT_DIR / "final_evaluation.csv"

PLOT_DIR.mkdir(parents=True, exist_ok=True)

if not RESULT_FILE.exists():
    raise FileNotFoundError(
        "final_evaluation.csv not found. Run evaluate_models.py first."
    )

df = pd.read_csv(RESULT_FILE)

required = {"Model", "MAE", "RMSE", "R2"}
if not required.issubset(df.columns):
    raise ValueError(f"Expected columns: {required}")

sns.set_theme(style="whitegrid")

metrics = ["MAE", "RMSE", "R2"]

for metric in metrics:
    plt.figure(figsize=(9, 5))

    sns.barplot(
        data=df,
        x="Model",
        y=metric
    )

    plt.title(f"Model Comparison - {metric}")
    plt.xlabel("Machine Learning Model")
    plt.ylabel(metric)
    plt.xticks(rotation=15)
    plt.tight_layout()

    plt.savefig(
        PLOT_DIR / f"{metric.lower()}_comparison.png",
        dpi=150
    )
    plt.close()

print("Model comparison charts generated successfully.")
print("Saved to:", PLOT_DIR)
