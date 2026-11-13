
import os
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("TMDB_BEARER_TOKEN")

if not TOKEN:
    raise ValueError("TMDB_BEARER_TOKEN missing from .env")

BASE_URL = "https://api.themoviedb.org/3"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "accept": "application/json"
}

movies = []

for page in range(1, 6):
    url = f"{BASE_URL}/movie/popular"

    params = {
        "language": "en-US",
        "page": page
    }

    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()
    movies.extend(data.get("results", []))

    print(f"Downloaded page {page}")

df = pd.DataFrame(movies)

os.makedirs("data/raw/real", exist_ok=True)

df.to_csv(
    "data/raw/real/tmdb_movies.csv",
    index=False
)

print("TMDB collection completed!")
print("Total movies:", len(df))
print("Saved: data/raw/real/tmdb_movies.csv")
