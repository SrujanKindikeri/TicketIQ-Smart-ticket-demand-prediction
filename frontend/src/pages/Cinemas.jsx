
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  MapPin,
  Armchair,
  RefreshCw,
  Clapperboard,
} from "lucide-react";
import "./Cinemas.css";

const API = "http://127.0.0.1:8000/api/cinemas/";

const emptyCinema = {
  name: "",
  location: "",
  city: "",
  total_seats: "",
  is_active: true,
};

export default function Cinemas() {
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyCinema);

  async function fetchCinemas() {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(API);
      setCinemas(response.data);
    } catch (err) {
      setError(
        "Unable to load cinemas. Check your Django API and backend server."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCinemas();
  }, []);

  const cities = useMemo(
    () => [
      "All",
      ...new Set(cinemas.map((cinema) => cinema.city).filter(Boolean)),
    ],
    [cinemas]
  );

  const filteredCinemas = cinemas.filter((cinema) => {
    const term = search.toLowerCase();

    const matchesSearch =
      cinema.name.toLowerCase().includes(term) ||
      cinema.city.toLowerCase().includes(term) ||
      cinema.location.toLowerCase().includes(term);

    const matchesCity =
      cityFilter === "All" || cinema.city === cityFilter;

    return matchesSearch && matchesCity;
  });

  const activeCount = cinemas.filter(
    (cinema) => cinema.is_active
  ).length;

  const totalSeats = cinemas.reduce(
    (sum, cinema) => sum + Number(cinema.total_seats || 0),
    0
  );

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyCinema);
    setShowForm(true);
  }

  function openEditForm(cinema) {
    setEditingId(cinema.id);

    setForm({
      name: cinema.name || "",
      location: cinema.location || "",
      city: cinema.city || "",
      total_seats: cinema.total_seats ?? "",
      is_active: cinema.is_active,
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

  async function saveCinema(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),
      city: form.city.trim(),
      total_seats: Number(form.total_seats),
      is_active: form.is_active,
    };

    try {
      if (editingId !== null) {
        await axios.put(`${API}${editingId}/`, payload);
      } else {
        await axios.post(API, payload);
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyCinema);

      await fetchCinemas();
    } catch (err) {
      const detail = err.response?.data;

      setError(
        typeof detail === "object"
          ? JSON.stringify(detail)
          : "Unable to save cinema. Check the form and backend."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCinema(cinema) {
    const confirmed = window.confirm(
      `Delete ${cinema.name}? This action may be blocked if it has existing shows.`
    );

    if (!confirmed) return;

    try {
      await axios.delete(`${API}${cinema.id}/`);
      await fetchCinemas();
    } catch (err) {
      setError(
        err.response?.status === 400 || err.response?.status === 409
          ? "This cinema cannot be deleted because related records may exist."
          : "Unable to delete cinema. Check the backend response."
      );
    }
  }

  return (
    <div className="cinemas-page">
      <div className="cinemas-heading">
        <div>
          <span className="cinemas-eyebrow">NETWORK MANAGEMENT</span>
          <h1>Cinemas</h1>
          <p>Manage your cinema locations and seating capacity.</p>
        </div>

        <button
          className="cinema-primary-btn"
          onClick={openCreateForm}
        >
          <Plus size={17} />
          Add cinema
        </button>
      </div>

      <div className="cinema-stats">
        <div className="cinema-stat-icon">
          <Building2 size={22} />
        </div>

        <div className="cinema-stat">
          <span>Total cinemas</span>
          <strong>{cinemas.length}</strong>
        </div>

        <div className="cinema-stat-divider" />

        <div className="cinema-stat">
          <span>Active cinemas</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="cinema-stat-divider" />

        <div className="cinema-stat">
          <span>Total seating capacity</span>
          <strong>{totalSeats.toLocaleString("en-IN")}</strong>
        </div>
      </div>

      <div className="cinema-toolbar">
        <div className="cinema-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cinema, location or city..."
          />
        </div>

        <select
          className="cinema-filter"
          value={cityFilter}
          onChange={(event) => setCityFilter(event.target.value)}
        >
          {cities.map((city) => (
            <option value={city} key={city}>
              {city === "All" ? "All cities" : city}
            </option>
          ))}
        </select>

        <button
          className="cinema-icon-btn"
          onClick={fetchCinemas}
          title="Refresh cinemas"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {error && (
        <div className="cinema-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="cinema-empty">
          <RefreshCw className="cinema-loading" size={25} />
          <p>Loading cinema locations...</p>
        </div>
      ) : filteredCinemas.length === 0 ? (
        <div className="cinema-empty">
          <div className="cinema-empty-icon">
            <Clapperboard size={28} />
          </div>

          <h2>
            {cinemas.length ? "No matching cinemas" : "No cinemas registered"}
          </h2>

          <p>
            {cinemas.length
              ? "Try another search or city filter."
              : "Add your first cinema location to get started."}
          </p>

          {!cinemas.length && (
            <button
              className="cinema-primary-btn"
              onClick={openCreateForm}
            >
              <Plus size={16} />
              Add your first cinema
            </button>
          )}
        </div>
      ) : (
        <div className="cinema-grid">
          {filteredCinemas.map((cinema) => (
            <article className="cinema-card" key={cinema.id}>
              <div className="cinema-card-art">
                <div className="cinema-building-icon">
                  <Building2 size={34} strokeWidth={1.4} />
                </div>

                <span className="cinema-city-label">
                  {cinema.city}
                </span>
              </div>

              <div className="cinema-card-body">
                <div className="cinema-card-title">
                  <h3>{cinema.name}</h3>

                  <span
                    className={
                      cinema.is_active
                        ? "cinema-status active"
                        : "cinema-status inactive"
                    }
                  >
                    {cinema.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="cinema-detail">
                  <MapPin size={14} />
                  <span>{cinema.location}, {cinema.city}</span>
                </div>

                <div className="cinema-detail">
                  <Armchair size={14} />
                  <span>
                    {Number(cinema.total_seats).toLocaleString("en-IN")}
                    {" "}total seats
                  </span>
                </div>

                <div className="cinema-card-actions">
                  <button onClick={() => openEditForm(cinema)}>
                    <Pencil size={14} />
                    Edit
                  </button>

                  <button
                    className="cinema-delete-action"
                    onClick={() => deleteCinema(cinema)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div
          className="cinema-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="cinema-modal">
            <div className="cinema-modal-heading">
              <div>
                <span className="cinemas-eyebrow">
                  CINEMA NETWORK
                </span>

                <h2>
                  {editingId !== null ? "Edit cinema" : "Add new cinema"}
                </h2>
              </div>

              <button
                className="cinema-icon-btn"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveCinema}>
              <label>
                Cinema name *
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  placeholder="Example: PVR Cinemas"
                  maxLength={150}
                  required
                />
              </label>

              <label>
                Full location *
                <input
                  name="location"
                  value={form.location}
                  onChange={updateField}
                  placeholder="Mall, street or area"
                  maxLength={255}
                  required
                />
              </label>

              <div className="cinema-form-row">
                <label>
                  City *
                  <input
                    name="city"
                    value={form.city}
                    onChange={updateField}
                    placeholder="Example: Delhi"
                    maxLength={100}
                    required
                  />
                </label>

                <label>
                  Total seats *
                  <input
                    type="number"
                    name="total_seats"
                    value={form.total_seats}
                    onChange={updateField}
                    placeholder="500"
                    min="1"
                    required
                  />
                </label>
              </div>

              <label className="cinema-checkbox">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={updateField}
                />
                Cinema is active
              </label>

              <div className="cinema-modal-actions">
                <button
                  type="button"
                  className="cinema-cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="cinema-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save changes"
                      : "Create cinema"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
