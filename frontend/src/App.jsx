
import { useEffect, useState } from "react";
import axios from "axios";

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
} from "lucide-react";

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

import "./App.css";

const API_BASE = "http://127.0.0.1:8000/api/";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Movies", icon: Film },
  { name: "Cinemas", icon: Clapperboard },
  { name: "Shows", icon: CalendarDays },
  { name: "Bookings", icon: Ticket },
  { name: "Predictions", icon: TrendingUp },
  { name: "Book Tickets", icon: ShoppingBag },
  { name: "My Bookings", icon: Ticket },
];

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  async function fetchDashboard() {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`${API_BASE}dashboard/`);
      setData(response.data);
      setConnected(true);
    } catch (err) {
      setConnected(false);
      setError(
        "Unable to connect to the Django backend. Check that the server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

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
          <h1>{greeting}.</h1>
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
            <span>PostgreSQL</span>
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
            TicketIQ's machine learning engine will estimate ticket
            demand, expected occupancy and potential revenue for
            upcoming cinema shows.
          </p>

          <div className="status-chip">
            <span className="status-dot" />
            Prediction interface under development
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

function PlaceholderPage({ name, onBack }) {
  const pageInfo = {
    Predictions: "Forecast cinema demand, occupancy and revenue.",
    Settings: "Manage your application preferences.",
    "Help & Support": "Find help and information about TicketIQ.",
  };

  return (
    <section className="panel coming-soon">
      <div className="empty-chart-icon">
        <Command size={26} />
      </div>

      <h2>{name}</h2>

      <p>
        {pageInfo[name] || "This module is being developed."}
      </p>

      <button className="primary-button" onClick={onBack}>
        Return to overview
      </button>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Booking flow state
  const [bookingStep, setBookingStep] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [heldSeats, setHeldSeats] = useState([]);
  const [sessionToken, setSessionToken] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [bookingRef, setBookingRef] = useState("");

  function navigateTo(page) {
    setActivePage(page);
    setSidebarOpen(false);
    // Reset booking flow when navigating away from booking pages
    if (page !== "Book Tickets") {
      setBookingStep(null);
    }
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
  };

  return (
    <div className="app-shell">
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
            <div className="profile-avatar">A</div>

            <div className="profile-info">
              <strong>Administrator</strong>
              <span>Workspace admin</span>
            </div>

            <ChevronDown size={16} />
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
            <button className="icon-button" aria-label="Search">
              <Search size={20} />
            </button>

            <button className="icon-button" aria-label="Notifications">
              <Bell size={20} />
            </button>

            <div className="topbar-divider" />

            <div className="topbar-avatar">A</div>
          </div>
        </header>

        <div className="content-area">
          {activePage === "Overview" && <Dashboard />}

          {activePage === "Movies" && <Movies />}

          {activePage === "Cinemas" && <Cinemas />}

          {activePage === "Shows" && <Shows />}

          {activePage === "Bookings" && <Bookings />}

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

          {![
            "Overview",
            "Movies",
            "Cinemas",
            "Shows",
            "Bookings",
            "My Bookings",
            "Book Tickets",
          ].includes(activePage) && (
            <PlaceholderPage
              name={activePage}
              onBack={() => navigateTo("Overview")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
