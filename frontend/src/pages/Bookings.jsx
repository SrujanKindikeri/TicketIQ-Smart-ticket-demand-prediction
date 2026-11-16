import { useEffect, useState } from "react";
import axios from "axios";
import {
  Ticket, Search, RefreshCw, Eye, X,
  Film, Building2, CalendarDays
} from "lucide-react";
import { useDataMode, DATA_MODES } from "../context/DataModeContext";
import DataSourceBadge from "../components/DataSourceBadge";
import "./Bookings.css";

const API = "http://127.0.0.1:8000/api/";
const API_DEMO = "http://127.0.0.1:8000/api/dataset/bookings/";

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const { mode } = useDataMode();
  const isDemo = mode === DATA_MODES.DEMO;

  async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      if (isDemo) {
        const response = await axios.get(API_DEMO, { params: { page: 1, page_size: 200 } });
        const data = response.data;
        setBookings(data.results || []);
        setStats(data.stats ? {
          total_bookings: data.stats.total_bookings,
          confirmed_bookings: data.stats.total_bookings,
          cancelled_bookings: 0,
          pending_bookings: 0,
          total_revenue: data.stats.total_revenue,
        } : null);
      } else {
        const [bookingsResp, statsResp] = await Promise.all([
          axios.get(`${API}admin/bookings/`, { withCredentials: true }),
          axios.get(`${API}admin/bookings/stats/`, { withCredentials: true }),
        ]);
        const data = Array.isArray(bookingsResp.data) ? bookingsResp.data : bookingsResp.data.results || [];
        setBookings(data);
        setStats(statsResp.data);
      }
    } catch (err) {
      const data = err.response?.data;
      setError(data?.detail || data?.error || "Unable to load bookings. Ensure you are logged in as admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, [mode]);

  async function cancelBooking(booking) {
    if (!window.confirm(`Cancel booking ${booking.booking_reference}?`)) return;
    setCancelling(booking.id);
    setError("");
    try {
      await axios.post(`${API}bookings/${booking.id}/cancel/`, {}, { withCredentials: true });
      await fetchAll();
      if (detail?.id === booking.id) setDetail(null);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || data?.detail || "Unable to cancel booking.");
    } finally {
      setCancelling(null);
    }
  }

  const filtered = bookings.filter((b) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      (b.booking_reference || "").toLowerCase().includes(q) ||
      (b.customer_name || "").toLowerCase().includes(q) ||
      (b.movie_title || "").toLowerCase().includes(q) ||
      (b.cinema_name || "").toLowerCase().includes(q);
    const matchesStatus = !statusFilter || b.status === statusFilter;
    const matchesDate = !dateFilter || b.show_date === dateFilter;
    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="admin-bookings-page">
      <div className="admin-bookings-heading">
        <div>
          <span className="admin-bookings-eyebrow">BOOKING MANAGEMENT</span>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            Bookings
            <DataSourceBadge mode={mode} />
          </h1>
          <p>{isDemo ? "Browsing synthetic booking data (read-only)." : "Manage and review all cinema bookings."}</p>
        </div>
        <button className="admin-bookings-refresh-btn" onClick={fetchAll} disabled={loading} title="Refresh">
          <RefreshCw size={17} className={loading ? "admin-bookings-spinner" : ""} />
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <section className="admin-bookings-stats">
          <div className="admin-bookings-stat-icon"><Ticket size={22} /></div>
          <div className="admin-bookings-stat">
            <span>Total</span>
            <strong>{stats.total_bookings ?? bookings.length}</strong>
          </div>
          <div className="admin-bookings-stat-divider" />
          <div className="admin-bookings-stat">
            <span>Confirmed</span>
            <strong>{stats.confirmed_bookings ?? 0}</strong>
          </div>
          <div className="admin-bookings-stat-divider" />
          <div className="admin-bookings-stat">
            <span>Cancelled</span>
            <strong>{stats.cancelled_bookings ?? 0}</strong>
          </div>
          <div className="admin-bookings-stat-divider" />
          <div className="admin-bookings-stat">
            <span>Pending</span>
            <strong>{stats.pending_bookings ?? 0}</strong>
          </div>
          <div className="admin-bookings-stat-divider" />
          <div className="admin-bookings-stat">
            <span>Revenue</span>
            <strong>{formatPrice(stats.total_revenue)}</strong>
          </div>
        </section>
      )}

      {error && <div className="admin-bookings-error">{error}</div>}

      {/* Toolbar */}
      <div className="admin-bookings-toolbar">
        <div className="admin-bookings-search">
          <Search size={17} />
          <input
            placeholder="Search by reference, customer, movie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-bookings-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          className="admin-bookings-filter"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label="Filter by date"
        />
      </div>

      {loading ? (
        <div className="admin-bookings-loading">
          <RefreshCw className="admin-bookings-spinner" size={24} />
          <p>Loading bookings...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-bookings-empty">
          <div className="admin-bookings-empty-icon"><Ticket size={28} /></div>
          <h2>{bookings.length === 0 ? "No bookings yet" : "No matching bookings"}</h2>
          <p>{bookings.length === 0 ? "Bookings will appear here once customers start booking." : "Try adjusting your search or filters."}</p>
        </div>
      ) : (
        <div className="admin-bookings-table-wrap">
          {isDemo ? (
            <table className="admin-bookings-table">
              <thead>
                <tr>
                  <th>Movie</th>
                  <th>Cinema</th>
                  <th>Date / Time</th>
                  <th>Tickets Booked</th>
                  <th>Ticket Price</th>
                  <th>Revenue</th>
                  <th>Occupancy</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <div className="admin-bookings-movie-cell">
                        <div className="admin-bookings-cell-icon"><Film size={16} /></div>
                        <strong>{booking.movie_title || "—"}</strong>
                      </div>
                    </td>
                    <td>{booking.cinema_name || "—"}</td>
                    <td>
                      <div>
                        <strong>{formatDate(booking.show_date)}</strong>
                        <span className="admin-bookings-time">{(booking.show_time || "").slice(0, 5)}</span>
                      </div>
                    </td>
                    <td>{booking.tickets_booked ?? "—"}</td>
                    <td>{formatPrice(booking.ticket_price)}</td>
                    <td className="admin-bookings-amount">{formatPrice(booking.revenue)}</td>
                    <td>{booking.occupancy_rate != null ? `${booking.occupancy_rate}%` : "—"}</td>
                    <td>
                      <span className="booking-status confirmed">confirmed (simulated)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
          <table className="admin-bookings-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Customer</th>
                <th>Movie / Cinema</th>
                <th>Date / Time</th>
                <th>Seats</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <code className="admin-bookings-ref">{booking.booking_reference}</code>
                  </td>
                  <td>
                    <div className="admin-bookings-customer">
                      <strong>{booking.customer_name || "—"}</strong>
                      <span>{booking.customer_email || ""}</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-bookings-movie-cell">
                      <div className="admin-bookings-cell-icon"><Film size={16} /></div>
                      <div>
                        <strong>{booking.movie_title || `Movie #${booking.movie}`}</strong>
                        <span>
                          <Building2 size={11} />
                          {booking.cinema_name || "—"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>{formatDate(booking.show_date)}</strong>
                      <span className="admin-bookings-time">{(booking.show_time || "").slice(0, 5)}</span>
                    </div>
                  </td>
                  <td>{booking.tickets_count ?? (booking.booking_seats?.length ?? "—")}</td>
                  <td className="admin-bookings-amount">{formatPrice(booking.total_amount)}</td>
                  <td>
                    <span className={`booking-status ${booking.status}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td>
                    <span className={`booking-status ${booking.payment_status === "paid" ? "confirmed" : booking.payment_status === "failed" ? "cancelled" : "pending"}`}>
                      {booking.payment_status || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-bookings-actions">
                      <button
                        className="admin-bookings-btn-icon"
                        onClick={() => setDetail(booking)}
                        title="View details"
                        aria-label="View booking details"
                      >
                        <Eye size={15} />
                      </button>
                      {["confirmed", "pending"].includes(booking.status) && (
                        <button
                          className="admin-bookings-btn-cancel"
                          onClick={() => cancelBooking(booking)}
                          disabled={cancelling === booking.id}
                          title="Cancel booking"
                          aria-label="Cancel booking"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div
          className="admin-bookings-modal-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}
        >
          <div className="admin-bookings-modal">
            <div className="admin-bookings-modal-heading">
              <div>
                <span className="admin-bookings-eyebrow">BOOKING DETAIL</span>
                <h2>{detail.booking_reference}</h2>
              </div>
              <button className="admin-bookings-btn-icon" onClick={() => setDetail(null)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            <table className="admin-bookings-detail-table">
              <tbody>
                <tr><th>Customer</th><td>{detail.customer_name || "—"}</td></tr>
                <tr><th>Email</th><td>{detail.customer_email || "—"}</td></tr>
                <tr><th>Phone</th><td>{detail.customer_phone || "—"}</td></tr>
                <tr><th>Movie</th><td>{detail.movie_title || "—"}</td></tr>
                <tr><th>Cinema</th><td>{detail.cinema_name || "—"}</td></tr>
                <tr><th>Date</th><td>{formatDate(detail.show_date)}</td></tr>
                <tr><th>Time</th><td>{(detail.show_time || "").slice(0, 5) || "—"}</td></tr>
                <tr>
                  <th>Seats</th>
                  <td>
                    {detail.booking_seats && detail.booking_seats.length > 0
                      ? detail.booking_seats.map((bs) => `${bs.seat_label || ""} (${bs.category || ""})`).join(", ")
                      : "—"}
                  </td>
                </tr>
                <tr><th>Amount</th><td><strong>{formatPrice(detail.total_amount)}</strong></td></tr>
                <tr><th>Status</th><td><span className={`booking-status ${detail.status}`}>{detail.status}</span></td></tr>
                <tr><th>Payment</th><td><span className={`booking-status ${detail.payment_status === "paid" ? "confirmed" : "pending"}`}>{detail.payment_status || "—"}</span></td></tr>
                <tr><th>Created</th><td>{detail.created_at ? new Date(detail.created_at).toLocaleString("en-IN") : "—"}</td></tr>
              </tbody>
            </table>

            <div className="admin-bookings-modal-actions">
              <a
                href={`${API}bookings/${detail.booking_reference}/ticket/`}
                download
                className="admin-bookings-download"
              >
                Download Ticket
              </a>
              {["confirmed", "pending"].includes(detail.status) && (
                <button
                  className="admin-bookings-cancel-modal"
                  onClick={() => cancelBooking(detail)}
                  disabled={cancelling === detail.id}
                >
                  {cancelling === detail.id ? "Cancelling..." : "Cancel Booking"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
