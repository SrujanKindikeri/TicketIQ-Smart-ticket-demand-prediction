import { useEffect, useState } from "react";
import axios from "axios";
import { CheckCircle2, Film, Building2, CalendarDays, Download, RefreshCw } from "lucide-react";
import "./BookingConfirmation.css";

const API = "http://127.0.0.1:8000/api/";

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function BookingConfirmation({ bookingRef, selectedMovie, selectedShow, onBack }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBooking() {
      setLoading(true);
      setError("");
      try {
        const resp = await axios.get(`${API}bookings/${bookingRef}/verify/`);
        setBooking(resp.data);
      } catch {
        setError("Unable to load booking details.");
      } finally {
        setLoading(false);
      }
    }
    if (bookingRef) fetchBooking();
  }, [bookingRef]);

  const seats = booking?.seats || [];
  const seatLabels = seats.map((s) => `${s.row || ""}${s.seat_number || s.seat || ""}`).join(", ");

  return (
    <div className="confirm-page">
      <div className="confirm-hero">
        <CheckCircle2 size={56} className="confirm-check-icon" />
        <h1>Booking Confirmed!</h1>
        <p>Your tickets are booked. Enjoy the show!</p>
      </div>

      {loading ? (
        <div className="confirm-loading">
          <RefreshCw className="confirm-spinner" size={22} />
          <span>Loading booking details...</span>
        </div>
      ) : error ? (
        <div className="confirm-error">{error}</div>
      ) : (
        <div className="confirm-card">
          <div className="confirm-ref-box">
            <span className="confirm-eyebrow">BOOKING REFERENCE</span>
            <code className="confirm-ref">{bookingRef}</code>
          </div>

          <table className="confirm-table">
            <tbody>
              <tr>
                <th><Film size={13} /> Movie</th>
                <td>{booking?.movie_title || selectedMovie?.title}</td>
              </tr>
              <tr>
                <th><Building2 size={13} /> Cinema</th>
                <td>{booking?.cinema_name || selectedShow?.cinema_name}</td>
              </tr>
              <tr>
                <th><CalendarDays size={13} /> Date</th>
                <td>{booking?.show_date || selectedShow?.show_date}</td>
              </tr>
              <tr>
                <th>Time</th>
                <td>{(booking?.show_time || selectedShow?.show_time)?.slice(0, 5)}</td>
              </tr>
              <tr>
                <th>Seats</th>
                <td>{seatLabels || "—"}</td>
              </tr>
              <tr>
                <th>Tickets</th>
                <td>{seats.length || "—"}</td>
              </tr>
              <tr>
                <th>Total</th>
                <td><strong>{formatPrice(booking?.total_amount)}</strong></td>
              </tr>
              <tr>
                <th>Payment</th>
                <td>
                  <span className={`confirm-status ${booking?.payment_status === "paid" ? "confirm-status-paid" : "confirm-status-pending"}`}>
                    {booking?.payment_status || "—"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="confirm-actions">
            <a
              href={`${API}bookings/${bookingRef}/ticket/`}
              download
              className="confirm-download-btn"
            >
              <Download size={15} />
              Download Ticket
            </a>
            <button className="confirm-another-btn" onClick={onBack}>
              Book Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
