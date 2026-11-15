import { useState } from "react";
import axios from "axios";
import { Film, Building2, CalendarDays, Download, X, RefreshCw, Ticket } from "lucide-react";
import "./MyBookings.css";

const API = "http://127.0.0.1:8000/api/";

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function MyBookings() {
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  async function fetchBookings(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setBookings([]);
    setSearched(false);

    try {
      const resp = await axios.get(`${API}bookings/my/?email=${encodeURIComponent(email.trim())}`);
      const data = Array.isArray(resp.data) ? resp.data : resp.data.results || [];
      setBookings(data);
      setSearched(true);
    } catch {
      setError("Unable to load bookings. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(bookingReference) {
    if (!window.confirm("Cancel this booking?")) return;
    setCancelling(bookingReference);
    setError("");
    try {
      await axios.post(`${API}bookings/${bookingReference}/customer-cancel/`, {
        customer_email: email.trim(),
      });
      // Refresh
      const resp = await axios.get(`${API}bookings/my/?email=${encodeURIComponent(email.trim())}`);
      const data = Array.isArray(resp.data) ? resp.data : resp.data.results || [];
      setBookings(data);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || data?.detail || "Unable to cancel booking.");
    } finally {
      setCancelling(null);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = bookings.filter((b) => b.show_date >= today);
  const past = bookings.filter((b) => b.show_date < today);

  function BookingCard({ booking }) {
    const canDownload = booking.status === "confirmed";
    const canCancel = ["confirmed", "pending"].includes(booking.status);

    return (
      <div className="mybookings-card">
        <div className="mybookings-card-header">
          <div className="mybookings-card-icon"><Film size={18} /></div>
          <div className="mybookings-card-info">
            <h3>{booking.movie_title || "Movie"}</h3>
            <p>
              <Building2 size={12} style={{ display: "inline", verticalAlign: "middle" }} />
              {" "}{booking.cinema_name || "—"}
            </p>
          </div>
          <span className={`mybookings-status mybookings-status-${booking.status}`}>
            {booking.status}
          </span>
        </div>

        <div className="mybookings-card-details">
          <div className="mybookings-detail">
            <CalendarDays size={13} />
            <span>{formatDate(booking.show_date)}{booking.show_time ? ` · ${booking.show_time.slice(0, 5)}` : ""}</span>
          </div>
          <div className="mybookings-detail">
            <Ticket size={13} />
            <span>
              {booking.booking_seats && booking.booking_seats.length > 0
                ? booking.booking_seats.map((bs) => bs.seat_label || `${bs.seat || ""}`).join(", ")
                : `${booking.tickets_count || "—"} seat(s)`}
            </span>
          </div>
          <div className="mybookings-detail">
            <span className="mybookings-ref">Ref: <code>{booking.booking_reference}</code></span>
          </div>
        </div>

        <div className="mybookings-card-footer">
          <strong className="mybookings-amount">{formatPrice(booking.total_amount)}</strong>
          <span className={`mybookings-pay-status mybookings-pay-${booking.payment_status}`}>
            {booking.payment_status || "—"}
          </span>
          <div className="mybookings-card-actions">
            {canDownload && (
              <a
                href={`${API}bookings/${booking.booking_reference}/ticket/`}
                download
                className="mybookings-download-btn"
              >
                <Download size={13} />
                Ticket
              </a>
            )}
            {canCancel && (
              <button
                className="mybookings-cancel-btn"
                onClick={() => cancelBooking(booking.booking_reference)}
                disabled={cancelling === booking.booking_reference}
              >
                {cancelling === booking.booking_reference ? <RefreshCw size={12} className="mybookings-spinner" /> : <X size={13} />}
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mybookings-page">
      <div className="mybookings-heading">
        <div>
          <span className="mybookings-eyebrow">BOOKING HISTORY</span>
          <h1>My Bookings</h1>
          <p>Enter your email to view your booking history.</p>
        </div>
      </div>

      <form className="mybookings-form" onSubmit={fetchBookings}>
        <input
          type="email"
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mybookings-email-input"
        />
        <button type="submit" className="mybookings-search-btn" disabled={loading}>
          {loading ? <RefreshCw size={15} className="mybookings-spinner" /> : null}
          {loading ? "Searching..." : "Find Bookings"}
        </button>
      </form>

      {error && <div className="mybookings-error">{error}</div>}

      {searched && bookings.length === 0 && (
        <div className="mybookings-empty">
          <div className="mybookings-empty-icon"><Ticket size={28} /></div>
          <h2>No bookings found</h2>
          <p>No bookings were found for <strong>{email}</strong>.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mybookings-section">
          <h2 className="mybookings-section-title">Upcoming ({upcoming.length})</h2>
          <div className="mybookings-grid">
            {upcoming.map((b) => <BookingCard key={b.id} booking={b} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mybookings-section">
          <h2 className="mybookings-section-title">Past ({past.length})</h2>
          <div className="mybookings-grid">
            {past.map((b) => <BookingCard key={b.id} booking={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}
