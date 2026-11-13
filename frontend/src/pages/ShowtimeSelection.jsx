import { useEffect, useState } from "react";
import axios from "axios";
import { Film, Building2, CalendarDays, Clock3, ChevronRight, RefreshCw } from "lucide-react";
import "./ShowtimeSelection.css";

const API = "http://127.0.0.1:8000/api/";

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function ShowtimeSelection({ selectedMovie, onNext, onBack }) {
  const [shows, setShows] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const [showResp, cinemaResp] = await Promise.all([
        axios.get(`${API}shows/?movie=${selectedMovie.id}`),
        axios.get(`${API}cinemas/`),
      ]);
      const showData = Array.isArray(showResp.data) ? showResp.data : showResp.data.results || [];
      const cinemaData = Array.isArray(cinemaResp.data) ? cinemaResp.data : cinemaResp.data.results || [];
      setShows(showData);
      setCinemas(cinemaData);
    } catch {
      setError("Unable to load showtimes. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [selectedMovie.id]);

  // Group shows: { cinemaId: { date: [show, ...] } }
  const cinemaMap = {};
  cinemas.forEach((c) => { cinemaMap[c.id] = c; });

  const grouped = {};
  shows.forEach((show) => {
    const cid = show.cinema;
    if (!grouped[cid]) grouped[cid] = {};
    const d = show.show_date;
    if (!grouped[cid][d]) grouped[cid][d] = [];
    grouped[cid][d].push(show);
  });

  const cinemaIds = Object.keys(grouped);

  return (
    <div className="showtime-sel-page">
      <div className="showtime-sel-heading">
        <div className="showtime-sel-movie-info">
          <div className="showtime-sel-movie-icon">
            <Film size={22} />
          </div>
          <div>
            <span className="showtime-sel-eyebrow">SELECT SHOWTIME</span>
            <h1>{selectedMovie.title}</h1>
            <p>{selectedMovie.genre}{selectedMovie.release_year ? ` · ${selectedMovie.release_year}` : ""}</p>
          </div>
        </div>
        <button className="showtime-sel-back-btn" onClick={onBack}>
          ← Change movie
        </button>
      </div>

      {error && <div className="showtime-sel-error">{error}</div>}

      {loading ? (
        <div className="showtime-sel-empty">
          <RefreshCw className="showtime-sel-spinner" size={25} />
          <p>Loading showtimes...</p>
        </div>
      ) : cinemaIds.length === 0 ? (
        <div className="showtime-sel-empty">
          <div className="showtime-sel-empty-icon">
            <CalendarDays size={28} />
          </div>
          <h2>No shows available</h2>
          <p>No showtimes are currently scheduled for this movie.</p>
          <button className="showtime-sel-back-btn" onClick={onBack}>← Back to movies</button>
        </div>
      ) : (
        <div className="showtime-sel-cinemas">
          {cinemaIds.map((cid) => {
            const cinema = cinemaMap[Number(cid)] || {};
            const dateGroups = grouped[cid];
            const sortedDates = Object.keys(dateGroups).sort();

            return (
              <div className="showtime-sel-cinema-card" key={cid}>
                <div className="showtime-sel-cinema-header">
                  <div className="showtime-sel-cinema-icon">
                    <Building2 size={19} />
                  </div>
                  <div>
                    <h2>{cinema.name || `Cinema #${cid}`}</h2>
                    <span>{cinema.city}{cinema.location ? `, ${cinema.location}` : ""}</span>
                  </div>
                </div>

                {sortedDates.map((date) => (
                  <div className="showtime-sel-date-group" key={date}>
                    <div className="showtime-sel-date-label">
                      <CalendarDays size={14} />
                      {formatDate(date)}
                    </div>
                    <div className="showtime-sel-slots">
                      {dateGroups[date].map((show) => (
                        <button
                          key={show.id}
                          className="showtime-sel-slot"
                          onClick={() => onNext({ selectedShow: show })}
                        >
                          <span className="showtime-sel-slot-time">
                            <Clock3 size={13} />
                            {show.show_time?.slice(0, 5) || "—"}
                          </span>
                          <span className="showtime-sel-slot-price">
                            {formatPrice(show.ticket_price)}
                          </span>
                          <span className="showtime-sel-slot-avail">
                            {Math.max(0, (show.seats_available || 0) - (show.tickets_booked || 0))} seats left
                          </span>
                          <ChevronRight size={13} className="showtime-sel-slot-arrow" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
