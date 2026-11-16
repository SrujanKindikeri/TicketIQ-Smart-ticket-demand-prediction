
import { useEffect, useState } from "react";
import axios from "./api";

import {
  LayoutDashboard,
  Film,
  Clapperboard,
  CalendarDays,
  Ticket,
  TrendingUp,
  Settings,
  CircleHelp,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  Command,
  Wallet,
  Users,
  Building2,
  RefreshCw,
  ShoppingBag,
  Lock,
  LogIn,
  Database,
} from "lucide-react";

import { useDataMode, DATA_MODES } from "./context/DataModeContext";
import DataModeSwitch from "./components/DataModeSwitch";
import DataSourceBadge from "./components/DataSourceBadge";

import Movies from "./pages/Movies";
import Cinemas from "./pages/Cinemas";
import Shows from "./pages/Shows";
import MovieSelection from "./pages/MovieSelection";
import ShowtimeSelection from "./pages/ShowtimeSelection";
import SeatSelection from "./pages/SeatSelection";
import Checkout from "./pages/Checkout";
import BookingConfirmation from "./pages/BookingConfirmation";
import MyBookings from "./pages/MyBookings";
import Bookings from "./pages/Bookings";
import Predictions from "./pages/Predictions";
import SettingsPage from "./pages/Settings";
import HelpSupport from "./pages/HelpSupport";
import DatasetExplorer from "./pages/DatasetExplorer";

import "./App.css";

const API_BASE = "http://127.0.0.1:8000/api/";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Movies", icon: Film },
  { name: "Cinemas", icon: Clapperboard },
  { name: "Shows", icon: CalendarDays },
  { name: "Bookings", icon: Ticket },
  { name: "Predictions", icon: TrendingUp },
  { name: "Dataset Explorer", icon: Database },
  { name: "Book Tickets", icon: ShoppingBag },
  { name: "My Bookings", icon: Ticket },
];

// =====================================================
// ADMIN LOGIN MODAL
// =====================================================

function AdminLoginModal({ onSuccess, onClose }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const resp = await axios.post(`${API_BASE}auth/login/`, form);
      onSuccess(resp.data);
    } catch (err) {
      const d = err.response?.data;
      setError(d?.error || d?.detail || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal admin-login-modal">
        <div className="modal-heading">
          <div className="modal-heading-icon">
            <Lock size={20} />
          </div>
          <div>
            <h2>Admin Login</h2>
            <p>Enter your Django administrator credentials.</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleLogin} className="modal-form">
          <label>
            Username
            <input
              name="username"
              value={form.username}
              onChange={update}
              placeholder="admin"
              required
              autoFocus
              disabled={loading}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={update}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </label>
          <button type="submit" className="modal-submit-btn" disabled={loading}>
            {loading ? <RefreshCw size={15} className="spin" /> : <LogIn size={15} />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// =====================================================
// DASHBOARD
// =====================================================

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const { mode } = useDataMode();
  const isDemo = mode === DATA_MODES.DEMO;

  async function fetchDashboard() {
    setLoading(true);
    setError("");

    const url = isDemo
      ? "http://127.0.0.1:8000/api/dataset/dashboard/"
      : "http://127.0.0.1:8000/api/dashboard/";

    try {
      const response = await axios.get(url);
      setData(response.data);
      setConnected(true);
    } catch (err) {
      setConnected(false);
      setError(
        isDemo
          ? "Unable to load demo dataset stats. Check that the Django backend is running."
          : "Unable to connect to the Django backend. Check that the server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, [mode]);

  const stats = [
    {
      label: "Total cinemas",
      value: data?.total_cinemas ?? 0,
      description: "Registered locations",
      icon: Building2,
    },
    {
      label: "Movies",
      value: data?.total_movies ?? 0,
      description: "Movies in your catalog",
      icon: Film,
    },
    {
      label: "Scheduled shows",
      value: data?.total_shows ?? 0,
      description: "Shows in the database",
      icon: CalendarDays,
    },
    {
      label: "Confirmed bookings",
      value: data?.total_bookings ?? 0,
      description: "Recorded bookings",
      icon: Ticket,
    },
  ];

  const revenue = Number(data?.total_revenue ?? 0);
  const occupancy = Number(data?.overall_occupancy ?? 0);

  const formattedRevenue = revenue.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR CINEMA INTELLIGENCE</span>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {greeting}.
            <DataSourceBadge mode={mode} />
          </h1>
          <p>Here's what's happening across your cinema network.</p>
        </div>

        <div className="heading-date">
          <CalendarDays size={16} />
          {date}
        </div>
      </div>

      {error && (
        <div className="api-alert">
          <RefreshCw size={17} />
          {error}

          <button
            onClick={fetchDashboard}
            className="primary-button"
            style={{ marginLeft: "auto", marginTop: 0 }}
          >
            Retry
          </button>
        </div>
      )}

      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article className="stat-card" key={stat.label}>
              <div className="stat-card-top">
                <span className="stat-label">{stat.label}</span>

                <div className="stat-icon">
                  <Icon size={19} />
                </div>
              </div>

              <div className="stat-value">
                {loading
                  ? "—"
                  : stat.value.toLocaleString("en-IN")}
              </div>

              <div className="stat-description">
                {stat.description}
              </div>
            </article>
          );
        })}
      </div>

      <div className="secondary-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">FINANCIAL OVERVIEW</span>
              <h2>Total revenue</h2>
            </div>

            <div className="panel-icon">
              <Wallet size={19} />
            </div>
          </div>

          <div className="revenue-value">
            {loading ? "—" : `₹${formattedRevenue}`}
          </div>

          <p className="muted-text">
            Revenue from confirmed bookings
          </p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">NETWORK PERFORMANCE</span>
              <h2>Overall occupancy</h2>
            </div>

            <div className="panel-icon">
              <Users size={19} />
            </div>
          </div>

          <div className="revenue-value">
            {loading ? "—" : `${occupancy.toFixed(1)}%`}
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, Math.max(0, occupancy))}%`,
              }}
            />
          </div>

          <p className="muted-text">
            Based on recorded show capacity and tickets booked
          </p>
        </section>
      </div>

      <section className="panel analytics-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">DEMAND INTELLIGENCE</span>
            <h2>Ticket demand analytics</h2>

            <p className="muted-text">
              Historical demand and performance overview
            </p>
          </div>

          <div className="live-label">
            <span className="live-dot" />
            API {connected ? "connected" : "disconnected"}
          </div>
        </div>

        <div className="empty-chart">
          <div className="empty-chart-icon">
            <TrendingUp size={24} />
          </div>

          <h3>Demand analytics</h3>

          <p>
            Your demand charts will appear here when historical
            show and booking data is available.
          </p>
        </div>
      </section>

      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">SYSTEM STATUS</span>
              <h2>Backend connection</h2>
            </div>

            <div className="panel-icon">
              <Command size={19} />
            </div>
          </div>

          <div className="system-row">
            Django REST API
            <span className={connected ? "status-good" : "status-bad"}>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>

          <div className="system-row">
            Dashboard data
            <span className={data ? "status-good" : "status-bad"}>
              {data ? "Available" : "Unavailable"}
            </span>
          </div>

          <div className="system-row">
            Data source
            <span>{isDemo ? "Dataset Demo (Synthetic)" : "PostgreSQL"}</span>
          </div>

          <button
            className="primary-button"
            onClick={fetchDashboard}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh dashboard"}
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">MODEL INTELLIGENCE</span>
              <h2>Prediction engine</h2>
            </div>

            <div className="panel-icon">
              <TrendingUp size={19} />
            </div>
          </div>

          <p className="muted-text">
            TicketIQ's machine learning engine estimates ticket
            demand, expected occupancy and potential revenue for
            upcoming cinema shows.
          </p>

          <div className="status-chip">
            <span className="status-dot" />
            Navigate to Predictions to run forecasts
          </div>
        </section>
      </div>

      <footer className="dashboard-footer">
        <span>TicketIQ Intelligence</span>
        <span>Smart Cinema Demand Platform</span>
      </footer>
    </>
  );
}

// =====================================================
// APP ROOT
// =====================================================

export default function App() {
  // Read initial page from hash
  const getInitialPage = () => {
    const hash = window.location.hash.slice(1);
    return hash || "Overview";
  };

  const [activePage, setActivePage] = useState(getInitialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth state
  const [auth, setAuth] = useState({ authenticated: false, is_admin: false, username: null });
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Data mode
  const { mode } = useDataMode();
  const isDemo = mode === DATA_MODES.DEMO;

  // Booking flow state
  const [bookingStep, setBookingStep] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [heldSeats, setHeldSeats] = useState([]);
  const [sessionToken, setSessionToken] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [bookingRef, setBookingRef] = useState("");

  // Check auth status on mount
  useEffect(() => {
    axios.get(`${API_BASE}auth/status/`)
      .then((resp) => setAuth(resp.data))
      .catch(() => {});
  }, []);

  // Show login modal when navigating to protected pages without auth.
  // Bookings and Predictions are only gated in Live Database mode; in Demo
  // mode they use local dataset data and do not require authentication.
  useEffect(() => {
    const alwaysProtected = ["Settings"];
    const liveOnlyProtected = ["Bookings", "Predictions"];
    const needsAuth =
      alwaysProtected.includes(activePage) ||
      (!isDemo && liveOnlyProtected.includes(activePage));

    if (needsAuth && !auth.authenticated) {
      axios.get(`${API_BASE}auth/status/`)
        .then((resp) => {
          setAuth(resp.data);
          if (!resp.data.authenticated) setShowLoginModal(true);
        })
        .catch(() => setShowLoginModal(true));
    }
  }, [activePage, isDemo]);

  function navigateTo(page) {
    setActivePage(page);
    window.location.hash = page;
    setSidebarOpen(false);
    if (page !== "Book Tickets") {
      setBookingStep(null);
    }
  }

  // Keep hash in sync when back/forward navigation occurs
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1);
      if (hash) setActivePage(hash);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function handleLoginSuccess(data) {
    setAuth({ authenticated: true, is_admin: data.is_staff || data.is_superuser, username: data.username });
    setShowLoginModal(false);
  }

  async function handleLogout() {
    try {
      await axios.post(`${API_BASE}auth/logout/`);
    } catch {}
    setAuth({ authenticated: false, is_admin: false, username: null });
    navigateTo("Overview");
  }

  const pageTitles = {
    Overview: "Overview",
    Movies: "Movies",
    Cinemas: "Cinemas",
    Shows: "Shows",
    Bookings: "Bookings",
    Predictions: "Predictions",
    Settings: "Settings",
    "Help & Support": "Help & Support",
    "Book Tickets": "Book Tickets",
    "My Bookings": "My Bookings",
    "Dataset Explorer": "Dataset Explorer",
  };

  return (
    <div className="app-shell">
      {showLoginModal && (
        <AdminLoginModal
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Command size={25} />
          </div>

          <div>
            <strong>TicketIQ</strong>
            <span>INTELLIGENCE</span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">T</div>

          <div className="workspace-info">
            <strong>TicketIQ Workspace</strong>
            <span>Management console</span>
          </div>

          <ChevronDown size={16} />
        </div>

        <div className="nav-section-label">WORKSPACE</div>

        <nav className="main-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.name;

            return (
              <button
                key={item.name}
                className={`nav-item ${isActive ? "nav-active" : ""}`}
                onClick={() => navigateTo(item.name)}
              >
                <Icon size={19} />
                <span>{item.name}</span>

                {isActive && <span className="nav-indicator" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-section-label">PREFERENCES</div>

          <button
            className={`nav-item ${
              activePage === "Settings" ? "nav-active" : ""
            }`}
            onClick={() => navigateTo("Settings")}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "Help & Support" ? "nav-active" : ""
            }`}
            onClick={() => navigateTo("Help & Support")}
          >
            <CircleHelp size={19} />
            <span>Help & Support</span>
          </button>

          <div className="profile-card">
            <div className="profile-avatar">
              {auth.username ? auth.username[0].toUpperCase() : "A"}
            </div>

            <div className="profile-info">
              <strong>{auth.username || "Guest"}</strong>
              <span>{auth.is_admin ? "Administrator" : auth.authenticated ? "Staff" : "Not signed in"}</span>
            </div>

            {auth.authenticated ? (
              <button
                className="profile-logout-btn"
                onClick={handleLogout}
                title="Sign out"
              >
                <X size={14} />
              </button>
            ) : (
              <button
                className="profile-logout-btn"
                onClick={() => setShowLoginModal(true)}
                title="Admin sign in"
              >
                <LogIn size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              Workspace <span>/</span> {pageTitles[activePage] || activePage}
            </div>
          </div>

          <div className="topbar-actions">
            <DataModeSwitch />

            <div className="topbar-divider" />

            <button className="icon-button" aria-label="Search">
              <Search size={20} />
            </button>

            <button className="icon-button" aria-label="Notifications">
              <Bell size={20} />
            </button>

            <div className="topbar-divider" />

            <div className="topbar-avatar">
              {auth.username ? auth.username[0].toUpperCase() : "A"}
            </div>
          </div>
        </header>

        <div className="content-area">
          {activePage === "Overview" && <Dashboard />}

          {activePage === "Movies" && <Movies />}

          {activePage === "Cinemas" && <Cinemas />}

          {activePage === "Shows" && <Shows />}

          {activePage === "Bookings" && (
            isDemo || auth.authenticated ? (
              <Bookings auth={auth} />
            ) : (
              <div className="auth-gate-panel">
                <Lock size={32} className="auth-gate-icon" />
                <h2>Admin access required</h2>
                <p>The Bookings page is restricted to administrators in Live Database mode.</p>
                <button
                  className="primary-button"
                  onClick={() => setShowLoginModal(true)}
                >
                  <LogIn size={15} />
                  Sign In as Admin
                </button>
              </div>
            )
          )}

          {activePage === "Predictions" && (
            isDemo || auth.authenticated ? (
              <Predictions auth={auth} />
            ) : (
              <div className="auth-gate-panel">
                <Lock size={32} className="auth-gate-icon" />
                <h2>Admin access required</h2>
                <p>The Predictions page is restricted to administrators in Live Database mode.</p>
                <button
                  className="primary-button"
                  onClick={() => setShowLoginModal(true)}
                >
                  <LogIn size={15} />
                  Sign In as Admin
                </button>
              </div>
            )
          )}

          {activePage === "Settings" && (
            auth.authenticated ? (
              <SettingsPage auth={auth} />
            ) : (
              <div className="auth-gate-panel">
                <Lock size={32} className="auth-gate-icon" />
                <h2>Admin access required</h2>
                <p>Settings are restricted to administrators.</p>
                <button
                  className="primary-button"
                  onClick={() => setShowLoginModal(true)}
                >
                  <LogIn size={15} />
                  Sign In as Admin
                </button>
              </div>
            )
          )}

          {activePage === "Help & Support" && <HelpSupport />}

          {activePage === "Dataset Explorer" && <DatasetExplorer />}

          {activePage === "My Bookings" && <MyBookings />}

          {activePage === "Book Tickets" && bookingStep === null && (
            <MovieSelection
              onNext={(data) => {
                setSelectedMovie(data.selectedMovie);
                setBookingStep("showtime");
              }}
              onBack={() => navigateTo("Overview")}
            />
          )}

          {activePage === "Book Tickets" && bookingStep === "showtime" && (
            <ShowtimeSelection
              selectedMovie={selectedMovie}
              onNext={(data) => {
                setSelectedShow(data.selectedShow);
                setBookingStep("seat");
              }}
              onBack={() => setBookingStep(null)}
            />
          )}

          {activePage === "Book Tickets" && bookingStep === "seat" && (
            <SeatSelection
              selectedMovie={selectedMovie}
              selectedShow={selectedShow}
              onNext={(data) => {
                setHeldSeats(data.heldSeats);
                setSessionToken(data.sessionToken);
                setExpiresAt(data.expiresAt);
                setBookingStep("checkout");
              }}
              onBack={() => setBookingStep("showtime")}
            />
          )}

          {activePage === "Book Tickets" && bookingStep === "checkout" && (
            <Checkout
              selectedMovie={selectedMovie}
              selectedShow={selectedShow}
              heldSeats={heldSeats}
              sessionToken={sessionToken}
              expiresAt={expiresAt}
              onNext={(data) => {
                setBookingRef(data.bookingRef);
                setBookingStep("confirmation");
              }}
              onBack={() => setBookingStep("seat")}
            />
          )}

          {activePage === "Book Tickets" && bookingStep === "confirmation" && (
            <BookingConfirmation
              bookingRef={bookingRef}
              selectedMovie={selectedMovie}
              selectedShow={selectedShow}
              onBack={() => {
                setBookingStep(null);
                navigateTo("Book Tickets");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
