import { useEffect, useState } from "react";
import axios from "axios";
import { Film, Search, RefreshCw, ChevronRight } from "lucide-react";
import "./MovieSelection.css";

const API = "http://127.0.0.1:8000/api/";

export default function MovieSelection({ onNext, onBack }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function fetchMovies() {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API}movies/`);
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setMovies(data.filter((m) => m.is_active));
    } catch {
      setError("Unable to load movies. Make sure the Django backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMovies();
  }, []);

  const filtered = movies.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="movie-sel-page">
      <div className="movie-sel-heading">
        <div>
          <span className="movie-sel-eyebrow">CUSTOMER BOOKING</span>
          <h1>Book Tickets</h1>
          <p>Select a movie to start your booking.</p>
        </div>
        <button className="movie-sel-back-btn" onClick={onBack}>
          ← Back to overview
        </button>
      </div>

      <div className="movie-sel-toolbar">
        <div className="movie-sel-search">
          <Search size={18} />
          <input
            placeholder="Search movies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="movie-sel-icon-btn" onClick={fetchMovies} title="Refresh">
          <RefreshCw size={17} />
        </button>
      </div>

      {error && <div className="movie-sel-error">{error}</div>}

      {loading ? (
        <div className="movie-sel-empty">
          <RefreshCw className="movie-sel-spinner" size={25} />
          <p>Loading movies...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="movie-sel-empty">
          <div className="movie-sel-empty-icon">
            <Film size={28} />
          </div>
          <h2>{movies.length === 0 ? "No movies available" : "No matching movies"}</h2>
          <p>{movies.length === 0 ? "No active movies found." : "Try another search."}</p>
        </div>
      ) : (
        <div className="movie-sel-grid">
          {filtered.map((movie) => (
            <article className="movie-sel-card" key={movie.id}>
              <div className="movie-sel-art">
                <Film size={37} strokeWidth={1.2} />
                <span className="movie-sel-art-title">{movie.title}</span>
              </div>
              <div className="movie-sel-card-body">
                <div className="movie-sel-card-title-row">
                  <h3>{movie.title}</h3>
                  <span className="movie-sel-status active">Active</span>
                </div>
                <p className="movie-sel-meta">
                  {movie.genre || "Genre not specified"}
                  {movie.release_year && ` · ${movie.release_year}`}
                </p>
                {movie.average_rating && (
                  <p className="movie-sel-rating">★ {movie.average_rating} · {movie.rating_count || 0} ratings</p>
                )}
                <button
                  className="movie-sel-book-btn"
                  onClick={() => onNext({ selectedMovie: movie })}
                >
                  Book Now
                  <ChevronRight size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
