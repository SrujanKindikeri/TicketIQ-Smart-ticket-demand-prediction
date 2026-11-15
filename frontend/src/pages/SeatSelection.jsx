import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { RefreshCw, Film, Building2 } from "lucide-react";
import "./SeatSelection.css";

const API = "http://127.0.0.1:8000/api/";

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function SeatSelection({ selectedMovie, selectedShow, onNext, onBack }) {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState([]);
  const [holding, setHolding] = useState(false);
  const [holdError, setHoldError] = useState("");
  const intervalRef = useRef(null);

  const fetchAvailability = useCallback(async () => {
    try {
      const resp = await axios.get(`${API}shows/${selectedShow.id}/availability/`);
      setAvailability(resp.data);
      setError("");
    } catch {
      setError("Unable to load seat availability.");
    } finally {
      setLoading(false);
    }
  }, [selectedShow.id]);

  useEffect(() => {
    fetchAvailability();
    intervalRef.current = setInterval(fetchAvailability, 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchAvailability]);

  function toggleSeat(seat) {
    if (seat.status !== "available") return;
    setSelected((prev) => {
      const idx = prev.findIndex((s) => s.id === seat.id);
      if (idx >= 0) return prev.filter((s) => s.id !== seat.id);
      return [...prev, seat];
    });
  }

  function isSeatSelected(seat) {
    return selected.some((s) => s.id === seat.id);
  }

  function getSeatClass(seat) {
    if (isSeatSelected(seat)) return "seat-sel-seat seat-selected";
    if (seat.status === "booked") return "seat-sel-seat seat-booked";
    if (seat.status === "held") return "seat-sel-seat seat-held";
    return "seat-sel-seat seat-available";
  }

  // Group seats by row
  const rows = {};
  if (availability?.seats) {
    availability.seats.forEach((seat) => {
      if (!rows[seat.row]) rows[seat.row] = [];
      rows[seat.row].push(seat);
    });
  }
  const sortedRows = Object.keys(rows).sort();

  // Calculate total using the `price` field returned directly by the API
  const total = selected.reduce((sum, seat) => {
    return sum + Number(seat.price || 0);
  }, 0);

  async function handleContinue() {
    if (selected.length === 0) return;
    setHolding(true);
    setHoldError("");
    try {
      const resp = await axios.post(`${API}shows/${selectedShow.id}/hold/`, {
        seat_ids: selected.map((s) => s.id),
      });
      onNext({
        heldSeats: resp.data.seats || selected,
        sessionToken: resp.data.session_token,
        expiresAt: resp.data.expires_at,
      });
    } catch (err) {
      const data = err.response?.data;
      setHoldError(
        data?.error || data?.detail || "Unable to hold seats. Please try again."
      );
    } finally {
      setHolding(false);
    }
  }

  return (
    <div className="seat-sel-page">
      <div className="seat-sel-heading">
        <div className="seat-sel-movie-info">
          <div className="seat-sel-movie-icon"><Film size={19} /></div>
          <div>
            <span className="seat-sel-eyebrow">SELECT SEATS</span>
            <h1>{selectedMovie.title}</h1>
            <p>
              <Building2 size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              {selectedShow.cinema_name || `Cinema #${selectedShow.cinema}`}
              {" · "}
              {selectedShow.show_date}
              {" · "}
              {selectedShow.show_time?.slice(0, 5)}
            </p>
          </div>
        </div>
        <button className="seat-sel-back-btn" onClick={onBack}>← Change showtime</button>
      </div>

      {error && <div className="seat-sel-error">{error}</div>}
      {holdError && <div className="seat-sel-error">{holdError}</div>}

      {loading ? (
        <div className="seat-sel-loading">
          <RefreshCw className="seat-sel-spinner" size={25} />
          <p>Loading seats...</p>
        </div>
      ) : (
        <>
          {/* Screen */}
          <div className="seat-sel-screen-wrap">
            <div className="seat-sel-screen">
              <span>SCREEN</span>
            </div>
            <div className="seat-sel-screen-shadow" />
          </div>

          {/* Seat grid */}
          <div className="seat-sel-grid">
            {sortedRows.map((row) => (
              <div className="seat-sel-row" key={row}>
                <span className="seat-sel-row-label">{row}</span>
                <div className="seat-sel-row-seats">
                  {rows[row]
                    .slice()
                    .sort((a, b) => a.seat_number - b.seat_number)
                    .map((seat) => (
                      <button
                        key={seat.id}
                        className={getSeatClass(seat)}
                        disabled={seat.status === "booked" || seat.status === "held"}
                        onClick={() => toggleSeat(seat)}
                        title={`${row}${seat.seat_number} · ${seat.category} · ${seat.status}`}
                        aria-label={`Seat ${row}${seat.seat_number}, ${seat.category}, ${seat.status}`}
                        aria-pressed={isSeatSelected(seat)}
                      >
                        {seat.seat_number}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="seat-sel-legend">
            <div className="seat-sel-legend-item">
              <span className="seat-sel-legend-dot available" />
              Available
            </div>
            <div className="seat-sel-legend-item">
              <span className="seat-sel-legend-dot selected-dot" />
              Selected
            </div>
            <div className="seat-sel-legend-item">
              <span className="seat-sel-legend-dot held-dot" />
              Held
            </div>
            <div className="seat-sel-legend-item">
              <span className="seat-sel-legend-dot booked-dot" />
              Booked
            </div>
          </div>

          {/* Category pricing — derived from actual seat prices in availability data */}
          <div className="seat-sel-categories">
            {["silver", "gold", "premium"].map((cat) => {
              const sample = availability?.seats?.find(
                (s) => s.category?.toLowerCase() === cat && s.status === "available"
              );
              if (!sample) return null;
              return (
                <div className="seat-sel-category" key={cat}>
                  <span className={`seat-sel-cat-badge cat-${cat}`}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </span>
                  <span>{formatPrice(sample.price)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div className="seat-sel-bottombar">
        <div className="seat-sel-summary">
          <span className="seat-sel-count">{selected.length} seat{selected.length !== 1 ? "s" : ""} selected</span>
          <span className="seat-sel-total">Total: {formatPrice(total)}</span>
        </div>
        <button
          className="seat-sel-continue-btn"
          disabled={selected.length === 0 || holding}
          onClick={handleContinue}
        >
          {holding ? "Holding seats..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
