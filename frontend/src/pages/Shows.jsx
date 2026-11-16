
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  Clock3,
  Ticket,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Clapperboard,
  Film,
  Building2,
  Users,
  IndianRupee,
  AlertCircle,
} from "lucide-react";
import { useDataMode, DATA_MODES } from "../context/DataModeContext";
import DataSourceBadge from "../components/DataSourceBadge";
import "./Shows.css";

const API = "http://127.0.0.1:8000/api/";
const API_DEMO_SHOWS = "http://127.0.0.1:8000/api/dataset/shows/";

const emptyForm = {
  cinema: "",
  movie: "",
  show_date: "",
  show_time: "",
  ticket_price: "",
  seats_available: "",
  tickets_booked: "0",
  promotion: false,
  data_source: "real",
};

function getList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error) {
  const data = error.response?.data;

  if (!data) {
    return "Unable to connect to the backend. Check that Django is running.";
  }

  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;

  return Object.entries(data)
    .map(([key, value]) => {
      const message = Array.isArray(value) ? value.join(", ") : String(value);
      return `${key.replaceAll("_", " ")}: ${message}`;
    })
    .join(" | ");
}

export default function Shows() {
  const [shows, setShows] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [movies, setMovies] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [cinemaFilter, setCinemaFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { mode } = useDataMode();
  const isDemo = mode === DATA_MODES.DEMO;

  async function fetchData() {
    setLoading(true);
    setError("");

    try {
      if (isDemo) {
        const response = await axios.get(API_DEMO_SHOWS, { params: { page: 1, page_size: 200 } });
        setShows(response.data.results || []);
        setCinemas([]);
        setMovies([]);
      } else {
        const [showResponse, cinemaResponse, movieResponse] =
          await Promise.all([
            axios.get(`${API}shows/`),
            axios.get(`${API}cinemas/`),
            axios.get(`${API}movies/`),
          ]);

        setShows(getList(showResponse.data));
        setCinemas(getList(cinemaResponse.data));
        setMovies(getList(movieResponse.data));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [mode]);

  const filteredShows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return shows.filter((show) => {
      const matchesSearch =
        !query ||
        (show.movie_title || "").toLowerCase().includes(query) ||
        (show.cinema_name || "").toLowerCase().includes(query);

      const matchesCinema =
        cinemaFilter === "all" ||
        String(show.cinema) === String(cinemaFilter);

      const matchesDate =
        !dateFilter || show.show_date === dateFilter;

      return matchesSearch && matchesCinema && matchesDate;
    });
  }, [shows, search, cinemaFilter, dateFilter]);

  const totalCapacity = shows.reduce(
    (sum, show) => sum + Number(show.seats_available || 0),
    0
  );

  const totalBooked = shows.reduce(
    (sum, show) => sum + Number(show.tickets_booked || 0),
    0
  );

  const occupancy =
    totalCapacity > 0
      ? (totalBooked / totalCapacity) * 100
      : 0;

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(show) {
    setEditingId(show.id);
    setForm({
      cinema: String(show.cinema),
      movie: String(show.movie),
      show_date: show.show_date,
      show_time: show.show_time?.slice(0, 5) || "",
      ticket_price: show.ticket_price,
      seats_available: String(show.seats_available),
      tickets_booked: String(show.tickets_booked ?? 0),
      promotion: Boolean(show.promotion),
      data_source: show.data_source || "real",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      cinema: Number(form.cinema),
      movie: Number(form.movie),
      show_date: form.show_date,
      show_time: form.show_time,
      ticket_price: form.ticket_price,
      seats_available: Number(form.seats_available),
      tickets_booked: Number(form.tickets_booked || 0),
      promotion: form.promotion,
      data_source: form.data_source,
    };

    try {
      if (editingId !== null) {
        await axios.put(`${API}shows/${editingId}/`, payload);
        setSuccess("Show updated successfully.");
      } else {
        await axios.post(`${API}shows/`, payload);
        setSuccess("Show created successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteShow(show) {
    const confirmed = window.confirm(
      `Delete the show "${show.movie_title}" at "${show.cinema_name}"?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await axios.delete(`${API}shows/${show.id}/`);
      setSuccess("Show deleted successfully.");
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="shows-page">
      <div className="shows-heading">
        <div>
          <span className="shows-eyebrow">SCHEDULE MANAGEMENT</span>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            Shows
            <DataSourceBadge mode={mode} />
          </h1>
          <p>{isDemo ? "Browsing synthetic show dataset (read-only)." : "Manage cinema schedules, showtimes and ticket capacity."}</p>
        </div>

        {!isDemo && (
          <button className="shows-primary-button" onClick={openCreateForm}>
            <Plus size={18} />
            Add show
          </button>
        )}
      </div>

      {error && (
        <div className="shows-alert shows-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="shows-alert shows-success">
          {success}
          <button onClick={() => setSuccess("")} aria-label="Dismiss message">
            <X size={17} />
          </button>
        </div>
      )}

      <section className="shows-stats">
        <div className="shows-stat-icon">
          <CalendarDays size={22} />
        </div>

        <div className="shows-stat">
          <span>Total shows</span>
          <strong>{shows.length}</strong>
        </div>

        <div className="shows-stat">
          <span>Total capacity</span>
          <strong>{totalCapacity.toLocaleString("en-IN")}</strong>
        </div>

        <div className="shows-stat">
          <span>Tickets booked</span>
          <strong>{totalBooked.toLocaleString("en-IN")}</strong>
        </div>

        <div className="shows-stat">
          <span>Occupancy</span>
          <strong>{occupancy.toFixed(1)}%</strong>
        </div>
      </section>

      <section className="shows-toolbar">
        <div className="shows-search">
          <Search size={19} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by movie or cinema..."
          />
        </div>

        <select
          value={cinemaFilter}
          onChange={(event) => setCinemaFilter(event.target.value)}
          aria-label="Filter by cinema"
        >
          <option value="all">All cinemas</option>
          {cinemas.map((cinema) => (
            <option key={cinema.id} value={cinema.id}>
              {cinema.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          aria-label="Filter by date"
        />

        <button
          className="shows-icon-button"
          onClick={fetchData}
          disabled={loading}
          title="Refresh shows"
        >
          <RefreshCw size={18} />
        </button>
      </section>

      <div className="shows-results-heading">
        <div>
          <h2>Scheduled shows</h2>
          <span>{filteredShows.length} records</span>
        </div>
      </div>

      {loading ? (
        <div className="shows-empty">
          <RefreshCw size={25} className="shows-spinner" />
          <h3>Loading shows...</h3>
          <p>Fetching schedules from your cinema database.</p>
        </div>
      ) : filteredShows.length === 0 ? (
        <div className="shows-empty">
          <div className="shows-empty-icon">
            <CalendarDays size={27} />
          </div>

          <h3>{shows.length === 0 ? "No shows scheduled" : "No matching shows"}</h3>

          <p>
            {shows.length === 0
              ? "Create your first show by selecting a cinema, movie and showtime."
              : "Try changing your search or filters."}
          </p>

          {shows.length === 0 && (
            <button className="shows-primary-button" onClick={openCreateForm}>
              <Plus size={18} />
              Schedule your first show
            </button>
          )}
        </div>
      ) : (
        <div className="shows-table-wrap">
          <table className="shows-table">
            <thead>
              <tr>
                <th>Movie / Cinema</th>
                <th>Date & time</th>
                <th>Ticket price</th>
                <th>Bookings</th>
                <th>Occupancy</th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredShows.map((show) => {
                const rate = Number(show.occupancy_rate || 0);

                return (
                  <tr key={show.id}>
                    <td>
                      <div className="shows-movie-cell">
                        <div className="shows-movie-icon">
                          <Film size={19} />
                        </div>

                        <div>
                          <strong>{show.movie_title || `Movie #${show.movie}`}</strong>
                          <span>
                            <Building2 size={13} />
                            {show.cinema_name || `Cinema #${show.cinema}`}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="shows-date-cell">
                        <strong>{formatDate(show.show_date)}</strong>
                        <span>
                          <Clock3 size={13} />
                          {show.show_time?.slice(0, 5) || "—"}
                        </span>
                      </div>
                    </td>

                    <td className="shows-price">
                      {formatCurrency(show.ticket_price)}
                    </td>

                    <td>
                      <strong>
                        {show.tickets_booked} / {show.seats_available}
                      </strong>
                      <span className="shows-small-label">tickets / seats</span>
                    </td>

                    <td>
                      <div className="shows-occupancy">
                        <strong>{rate.toFixed(1)}%</strong>
                        <div className="shows-progress">
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, rate))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`shows-source ${show.data_source}`}>
                        {show.data_source || "unknown"}
                      </span>
                    </td>

                    <td>
                      <div className="shows-actions">
                        {!isDemo && (
                          <button
                            onClick={() => openEditForm(show)}
                            title="Edit show"
                            aria-label="Edit show"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {!isDemo && (
                          <button
                            className="shows-delete"
                            onClick={() => deleteShow(show)}
                            title="Delete show"
                            aria-label="Delete show"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {isDemo && (
                          <span style={{ fontSize: 11, color: "#b8700a", fontWeight: 600 }}>Read-only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && !isDemo && (
        <div
          className="shows-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowForm(false);
            }
          }}
        >
          <section
            className="shows-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shows-modal-title"
          >
            <div className="shows-modal-heading">
              <div>
                <span className="shows-eyebrow">SHOW SCHEDULING</span>
                <h2 id="shows-modal-title">
                  {editingId !== null ? "Edit show" : "Create a show"}
                </h2>
                <p>Enter the details for this cinema show.</p>
              </div>

              <button
                className="shows-close-button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="shows-form-grid">
                <label>
                  Cinema
                  <select
                    name="cinema"
                    value={form.cinema}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select cinema</option>
                    {cinemas.map((cinema) => (
                      <option key={cinema.id} value={cinema.id}>
                        {cinema.name} — {cinema.city}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Movie
                  <select
                    name="movie"
                    value={form.movie}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select movie</option>
                    {movies.map((movie) => (
                      <option key={movie.id} value={movie.id}>
                        {movie.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Show date
                  <input
                    type="date"
                    name="show_date"
                    value={form.show_date}
                    onChange={updateField}
                    required
                  />
                </label>

                <label>
                  Show time
                  <input
                    type="time"
                    name="show_time"
                    value={form.show_time}
                    onChange={updateField}
                    required
                  />
                </label>

                <label>
                  Ticket price (₹)
                  <input
                    type="number"
                    name="ticket_price"
                    value={form.ticket_price}
                    onChange={updateField}
                    min="0"
                    step="0.01"
                    placeholder="250.00"
                    required
                  />
                </label>

                <label>
                  Seat capacity
                  <input
                    type="number"
                    name="seats_available"
                    value={form.seats_available}
                    onChange={updateField}
                    min="1"
                    placeholder="150"
                    required
                  />
                </label>

                <label>
                  Tickets already booked
                  <input
                    type="number"
                    name="tickets_booked"
                    value={form.tickets_booked}
                    onChange={updateField}
                    min="0"
                    max={form.seats_available || undefined}
                    required
                  />
                </label>

                <label>
                  Data source
                  <select
                    name="data_source"
                    value={form.data_source}
                    onChange={updateField}
                  >
                    <option value="real">Real</option>
                    <option value="synthetic">Synthetic</option>
                  </select>
                </label>
              </div>

              <label className="shows-checkbox-label">
                <input
                  type="checkbox"
                  name="promotion"
                  checked={form.promotion}
                  onChange={updateField}
                />
                Promotional offer active for this show
              </label>

              <div className="shows-modal-footer">
                <button
                  type="button"
                  className="shows-secondary-button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="shows-primary-button"
                  disabled={saving || cinemas.length === 0 || movies.length === 0}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save changes"
                      : "Create show"}
                </button>
              </div>

              {(cinemas.length === 0 || movies.length === 0) && (
                <p className="shows-form-note">
                  Add at least one cinema and one movie before scheduling a show.
                </p>
              )}
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
