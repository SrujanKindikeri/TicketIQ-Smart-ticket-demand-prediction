
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Film,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Star,
  Clapperboard,
  RefreshCw,
} from "lucide-react";
import { useDataMode, DATA_MODES } from "../context/DataModeContext";
import DataSourceBadge from "../components/DataSourceBadge";
import "./Movies.css";

const API_LIVE = "http://127.0.0.1:8000/api/movies/";
const API_DEMO = "http://127.0.0.1:8000/api/dataset/movies/";

const emptyMovie = {
  title: "",
  genre: "",
  release_year: "",
  average_rating: "",
  rating_count: 0,
  is_active: true,
};

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyMovie);
  const [saving, setSaving] = useState(false);

  const { mode } = useDataMode();
  const isDemo = mode === DATA_MODES.DEMO;

  async function fetchMovies() {
    setLoading(true);
    setError("");

    try {
      if (isDemo) {
        const params = { page: 1, page_size: 200 };
        const response = await axios.get(API_DEMO, { params });
        const results = response.data.results || [];
        setMovies(results.map((m) => ({
          id: m.id,
          title: m.title,
          genre: m.genre,
          release_year: m.year,
          average_rating: m.avg_rating,
          rating_count: m.rating_count,
          is_active: true,
        })));
      } else {
        const response = await axios.get(API_LIVE);
        setMovies(Array.isArray(response.data) ? response.data : response.data.results || []);
      }
    } catch {
      setError("Unable to load movies. Make sure the Django backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMovies();
  }, [mode]);

  const genres = useMemo(
    () => [
      "All",
      ...new Set(
        movies.map((movie) => movie.genre).filter(Boolean)
      ),
    ],
    [movies]
  );

  const filteredMovies = movies.filter((movie) => {
    const matchesSearch = movie.title
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesGenre =
      genreFilter === "All" || movie.genre === genreFilter;

    return matchesSearch && matchesGenre;
  });

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyMovie);
    setShowForm(true);
  }

  function openEditForm(movie) {
    setEditingId(movie.id);
    setForm({
      title: movie.title || "",
      genre: movie.genre || "",
      release_year: movie.release_year || "",
      average_rating: movie.average_rating ?? "",
      rating_count: movie.rating_count ?? 0,
      is_active: movie.is_active,
    });
    setShowForm(true);
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function saveMovie(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      title: form.title.trim(),
      genre: form.genre.trim(),
      release_year: form.release_year
        ? Number(form.release_year)
        : null,
      average_rating: form.average_rating === ""
        ? null
        : Number(form.average_rating),
      rating_count: Number(form.rating_count || 0),
      is_active: form.is_active,
    };

    try {
      if (editingId !== null) {
        await axios.put(`${API}${editingId}/`, payload);
      } else {
        await axios.post(API, payload);
      }

      setShowForm(false);
      setForm(emptyMovie);
      setEditingId(null);
      await fetchMovies();
    } catch (err) {
      const detail = err.response?.data;
      setError(
        typeof detail === "object"
          ? JSON.stringify(detail)
          : "Unable to save the movie. Check your input and backend."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMovie(movie) {
    const confirmed = window.confirm(
      `Delete "${movie.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await axios.delete(`${API}${movie.id}/`);
      await fetchMovies();
    } catch {
      setError("Unable to delete this movie.");
    }
  }

  return (
    <div className="movies-page">
      <div className="movies-heading">
        <div>
          <span className="movies-eyebrow">CONTENT MANAGEMENT</span>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            Movies
            <DataSourceBadge mode={mode} />
          </h1>
          <p>{isDemo ? "Browsing MovieLens dataset (read-only)." : "Manage your cinema movie catalog."}</p>
        </div>

        {!isDemo && (
          <button className="movie-primary-btn" onClick={openCreateForm}>
            <Plus size={17} />
            Add movie
          </button>
        )}
      </div>

      <div className="movie-summary">
        <div className="movie-summary-icon">
          <Film size={22} />
        </div>
        <div>
          <span>Total movies</span>
          <strong>{movies.length}</strong>
        </div>
        <div className="movie-summary-divider" />
        <div>
          <span>Active movies</span>
          <strong>
            {movies.filter((movie) => movie.is_active).length}
          </strong>
        </div>
      </div>

      <div className="movie-toolbar">
        <div className="movie-search">
          <Search size={18} />
          <input
            placeholder="Search movies by title..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="movie-filter"
          value={genreFilter}
          onChange={(event) => setGenreFilter(event.target.value)}
        >
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre === "All" ? "All genres" : genre}
            </option>
          ))}
        </select>

        <button
          className="movie-icon-btn"
          onClick={fetchMovies}
          title="Refresh movies"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {error && (
        <div className="movie-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="movie-empty">
          <RefreshCw className="loading-icon" size={25} />
          <p>Loading your movie catalog...</p>
        </div>
      ) : filteredMovies.length === 0 ? (
        <div className="movie-empty">
          <div className="movie-empty-icon">
            <Clapperboard size={28} />
          </div>
          <h2>{movies.length ? "No matching movies" : "Your catalog is empty"}</h2>
          <p>
            {movies.length
              ? "Try another search or genre."
              : "Add your first movie to start building your catalog."}
          </p>
          {!movies.length && (
            <button className="movie-primary-btn" onClick={openCreateForm}>
              <Plus size={16} />
              Add your first movie
            </button>
          )}
        </div>
      ) : (
        <div className="movie-grid">
          {filteredMovies.map((movie) => (
            <article className="movie-card" key={movie.id}>
              <div className="movie-art">
                <Film size={37} strokeWidth={1.2} />
                <span className="movie-art-title">
                  {movie.title}
                </span>
              </div>

              <div className="movie-card-body">
                <div className="movie-card-title-row">
                  <h3>{movie.title}</h3>
                  <span className={
                    movie.is_active
                      ? "movie-status active"
                      : "movie-status inactive"
                  }>
                    {movie.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="movie-meta">
                  {movie.genre || "Genre not specified"}
                  {movie.release_year && ` · ${movie.release_year}`}
                </p>

                <div className="movie-rating">
                  <Star size={15} fill="#E6AA36" color="#E6AA36" />
                  <strong>
                    {movie.average_rating ?? "N/A"}
                  </strong>
                  <span>
                    {movie.rating_count ?? 0} ratings
                  </span>
                </div>

                <div className="movie-card-actions">
                  {!isDemo && (
                    <button onClick={() => openEditForm(movie)}>
                      <Pencil size={14} />
                      Edit
                    </button>
                  )}
                  {!isDemo && (
                    <button
                      className="delete-action"
                      onClick={() => deleteMovie(movie)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                  {isDemo && (
                    <span style={{ fontSize: 11, color: "#b8700a", fontWeight: 600 }}>Read-only (demo)</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && !isDemo && (
        <div
          className="movie-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="movie-modal">
            <div className="movie-modal-heading">
              <div>
                <span className="movies-eyebrow">MOVIE CATALOG</span>
                <h2>{editingId ? "Edit movie" : "Add new movie"}</h2>
              </div>
              <button
                className="movie-icon-btn"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveMovie}>
              <label>
                Movie title *
                <input
                  name="title"
                  value={form.title}
                  onChange={updateField}
                  placeholder="Enter movie title"
                  required
                  maxLength={200}
                />
              </label>

              <div className="movie-form-row">
                <label>
                  Genre
                  <input
                    name="genre"
                    value={form.genre}
                    onChange={updateField}
                    placeholder="Action, Drama..."
                    maxLength={100}
                  />
                </label>

                <label>
                  Release year
                  <input
                    type="number"
                    name="release_year"
                    value={form.release_year}
                    onChange={updateField}
                    min="1888"
                    max="2100"
                    placeholder="2026"
                  />
                </label>
              </div>

              <div className="movie-form-row">
                <label>
                  Average rating
                  <input
                    type="number"
                    name="average_rating"
                    value={form.average_rating}
                    onChange={updateField}
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="0 - 5"
                  />
                </label>

                <label>
                  Rating count
                  <input
                    type="number"
                    name="rating_count"
                    value={form.rating_count}
                    onChange={updateField}
                    min="0"
                  />
                </label>
              </div>

              <label className="movie-checkbox">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={updateField}
                />
                Movie is active
              </label>

              <div className="movie-modal-actions">
                <button
                  type="button"
                  className="movie-cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="movie-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Create movie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
