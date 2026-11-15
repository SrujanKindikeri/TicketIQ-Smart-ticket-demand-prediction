import { useEffect, useState } from "react";
import axios from "../api";
import {
  BookOpen, HelpCircle, ChevronDown, ChevronUp, CheckCircle2,
  RefreshCw, Send, Ticket, Film, Building2, CreditCard,
  MessageSquare, Wifi, WifiOff,
} from "lucide-react";
import "./HelpSupport.css";

const API = "http://127.0.0.1:8000/api/";
const APP_VERSION = "0.0.0";

const FAQ = [
  {
    q: "How do I book a ticket on TicketIQ?",
    a: "Navigate to 'Book Tickets' in the sidebar. Select a movie, then choose a cinema and showtime, pick your seats on the visual layout, fill in your details, and complete payment. You'll receive a booking confirmation with a QR-coded PDF ticket.",
  },
  {
    q: "What seat categories are available?",
    a: "TicketIQ cinemas offer three seat categories: Silver (front rows, base price), Gold (middle rows, slightly higher price), and Premium (back rows, highest price). The price multiplier for each category is shown on the seat selection screen.",
  },
  {
    q: "For how long are my selected seats held?",
    a: "Selected seats are held for 5 minutes while you complete checkout. A countdown timer is displayed on the checkout page. If the hold expires before payment, your seats are released and you need to select them again.",
  },
  {
    q: "Is payment processed in real mode?",
    a: "TicketIQ integrates with Razorpay. If a Razorpay API key is configured, real payments are processed. Without a configured key, the app runs in test mode and simulates payment so you can test the full booking flow without actual charges.",
  },
  {
    q: "How do I find my past bookings?",
    a: "Go to 'My Bookings' from the sidebar and enter the email address you used when booking. All bookings linked to that email will be listed, split into Upcoming and Past sections.",
  },
  {
    q: "Can I cancel a booking?",
    a: "Yes. In 'My Bookings', click Cancel on any confirmed or pending booking. Admin users can also cancel bookings from the Bookings management page. Cancelled bookings restore the seats to available.",
  },
  {
    q: "How do I download my ticket?",
    a: "After a confirmed booking, a 'Download Ticket' button appears on the BookingConfirmation page. You can also download the ticket from your booking history in 'My Bookings'. The ticket is a PDF with a QR code encoding your booking reference.",
  },
  {
    q: "What is the Predictions page?",
    a: "The Predictions page uses a trained machine learning model to forecast ticket demand, occupancy, and revenue for upcoming shows. It requires trained model files in the artifacts/models/ directory. Admin access is required to view predictions.",
  },
  {
    q: "I see a 403 error on the Bookings page. What should I do?",
    a: "The Bookings management page is restricted to administrators. Click 'Admin Login' (shown automatically when accessing the page) and enter your Django admin credentials. Normal customers do not have access to this section.",
  },
  {
    q: "How do I add movies, cinemas, or shows?",
    a: "Use the Movies, Cinemas, and Shows pages in the sidebar. These management pages connect directly to the Django REST API and allow CRUD operations. You can also use the Django admin at /admin/ for bulk data management.",
  },
];

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`help-faq-item ${open ? "help-faq-open" : ""}`}>
      <button
        className="help-faq-question"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{item.q}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <p className="help-faq-answer">{item.a}</p>}
    </div>
  );
}

export default function HelpSupport() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    axios.get(`${API}dashboard/`)
      .then(() => setSystemStatus("connected"))
      .catch(() => setSystemStatus("disconnected"));
  }, []);

  function updateField(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await axios.post(`${API}contact/`, form);
      setSubmitted(true);
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      const d = err.response?.data;
      setFormError(d?.error || d?.detail || "Unable to send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="help-page">
      <div className="help-heading">
        <div>
          <span className="help-eyebrow">HELP & SUPPORT</span>
          <h1>Help & Support</h1>
          <p>Everything you need to get started with TicketIQ.</p>
        </div>
        <div className="help-system-status">
          {systemStatus === "connected" ? (
            <><Wifi size={15} className="help-status-icon connected" /> API Connected</>
          ) : systemStatus === "disconnected" ? (
            <><WifiOff size={15} className="help-status-icon disconnected" /> API Disconnected</>
          ) : (
            <><RefreshCw size={14} className="help-spin" /> Checking...</>
          )}
          <span className="help-version">v{APP_VERSION}</span>
        </div>
      </div>

      {/* Overview card */}
      <section className="help-section">
        <div className="help-section-header">
          <BookOpen size={18} />
          <h2>About TicketIQ</h2>
        </div>
        <p className="help-text">
          TicketIQ is a smart cinema booking platform that connects audiences to cinemas
          through a clean, fast interface. It includes real-time seat selection, Razorpay
          payment integration, QR-coded PDF tickets, ML demand forecasting, and a full
          admin dashboard for managing movies, cinemas, shows, and bookings.
        </p>
        <div className="help-features-grid">
          <div className="help-feature-card">
            <Film size={20} />
            <strong>Movie Management</strong>
            <span>Add and manage your film catalogue</span>
          </div>
          <div className="help-feature-card">
            <Building2 size={20} />
            <strong>Cinema Management</strong>
            <span>Configure cinemas and seat layouts</span>
          </div>
          <div className="help-feature-card">
            <Ticket size={20} />
            <strong>Booking Workflow</strong>
            <span>End-to-end customer booking with seat holds</span>
          </div>
          <div className="help-feature-card">
            <CreditCard size={20} />
            <strong>Razorpay Payments</strong>
            <span>Secure payment integration with test mode</span>
          </div>
        </div>
      </section>

      {/* User guide */}
      <section className="help-section">
        <div className="help-section-header">
          <BookOpen size={18} />
          <h2>User Guide</h2>
        </div>
        <ol className="help-steps">
          <li>Open TicketIQ and navigate to <strong>Overview</strong> to see the system dashboard and API connection status.</li>
          <li>Use <strong>Movies</strong> to browse or manage the film catalogue.</li>
          <li>Use <strong>Cinemas</strong> to view cinema locations and generate seat layouts using the Generate Seats action.</li>
          <li>Use <strong>Shows</strong> to schedule screenings and assign movies to cinemas with dates and times.</li>
          <li>Navigate to <strong>Book Tickets</strong> to begin a customer booking flow.</li>
          <li>After booking, use <strong>My Bookings</strong> to look up booking history by email and download ticket PDFs.</li>
          <li>Admin users can review all bookings in the <strong>Bookings</strong> section and use the <strong>Predictions</strong> page for ML demand forecasting.</li>
        </ol>
      </section>

      {/* Booking instructions */}
      <section className="help-section">
        <div className="help-section-header">
          <Ticket size={18} />
          <h2>Booking Instructions</h2>
        </div>
        <ol className="help-steps">
          <li>Click <strong>Book Tickets</strong> in the sidebar.</li>
          <li>Select a movie from the grid.</li>
          <li>Choose a cinema, date, and showtime from the showtime selection screen.</li>
          <li>Select your seats from the visual cinema layout.</li>
          <li>Click <strong>Continue</strong> to hold your seats (5-minute hold).</li>
          <li>Enter your name, email, and phone number on the checkout screen.</li>
          <li>Click <strong>Pay</strong> to complete payment via Razorpay.</li>
          <li>After payment, your Booking Confirmation is shown with a downloadable PDF ticket.</li>
        </ol>
      </section>

      {/* Seat selection instructions */}
      <section className="help-section">
        <div className="help-section-header">
          <Building2 size={18} />
          <h2>Seat Selection Guide</h2>
        </div>
        <ul className="help-bullets">
          <li>The screen is shown at the top of the layout. Seats closer to the screen are Silver category.</li>
          <li>Green seats are <strong>available</strong>. Click to select; click again to deselect.</li>
          <li>Grey seats are <strong>held</strong> by another customer and temporarily unavailable.</li>
          <li>Dark seats are <strong>booked</strong> and cannot be selected.</li>
          <li>Your selected seats are highlighted in blue. The total price updates as you select.</li>
          <li>You can select multiple seats in a single transaction.</li>
          <li>The seat layout refreshes automatically every 30 seconds to show current availability.</li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="help-section">
        <div className="help-section-header">
          <HelpCircle size={18} />
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="help-faq-list">
          {FAQ.map((item, i) => (
            <FAQItem key={i} item={item} />
          ))}
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="help-section">
        <div className="help-section-header">
          <RefreshCw size={18} />
          <h2>Troubleshooting</h2>
        </div>
        <div className="help-troubleshoot-list">
          <div className="help-troubleshoot-item">
            <strong>API Disconnected on Dashboard</strong>
            <p>Ensure the Django backend is running: <code>python manage.py runserver</code> from the backend directory. Check that the database is accessible and migrations have been applied.</p>
          </div>
          <div className="help-troubleshoot-item">
            <strong>403 Forbidden on Bookings or Settings</strong>
            <p>These pages require admin login. Use the Admin Login modal that appears automatically, or sign in via <code>/admin/</code> first. Ensure your user account has is_staff or is_superuser set to True in Django admin.</p>
          </div>
          <div className="help-troubleshoot-item">
            <strong>No movies or shows displayed</strong>
            <p>Use the Movies and Shows pages to add entries to the database. You can also import data using Django management commands or the admin panel at <code>/admin/</code>.</p>
          </div>
          <div className="help-troubleshoot-item">
            <strong>Seat layout is empty</strong>
            <p>No seats have been generated for this cinema. Go to the Cinemas page, select the cinema, and use the Generate Seats action to create a seat layout.</p>
          </div>
          <div className="help-troubleshoot-item">
            <strong>Predictions show "Model unavailable"</strong>
            <p>No trained model files were found in <code>artifacts/models/</code>. Run the training notebook to generate <code>xgboost.joblib</code>, <code>random_forest.joblib</code>, or <code>linear_regression.joblib</code>.</p>
          </div>
        </div>
      </section>

      {/* System status */}
      <section className="help-section">
        <div className="help-section-header">
          <Wifi size={18} />
          <h2>System Status</h2>
        </div>
        <div className="help-status-row">
          <span>Django REST API</span>
          {systemStatus === "connected" ? (
            <span className="help-status-chip connected">Connected</span>
          ) : systemStatus === "disconnected" ? (
            <span className="help-status-chip disconnected">Disconnected</span>
          ) : (
            <span className="help-status-chip checking">Checking...</span>
          )}
        </div>
        <div className="help-status-row">
          <span>Application Version</span>
          <span className="help-status-chip version">v{APP_VERSION}</span>
        </div>
      </section>

      {/* Contact form */}
      <section className="help-section">
        <div className="help-section-header">
          <MessageSquare size={18} />
          <h2>Contact Support</h2>
        </div>
        {submitted ? (
          <div className="help-submit-success">
            <CheckCircle2 size={22} />
            <div>
              <strong>Message sent!</strong>
              <p>Thank you for reaching out. We'll get back to you as soon as possible.</p>
            </div>
            <button className="help-send-another" onClick={() => setSubmitted(false)}>
              Send another message
            </button>
          </div>
        ) : (
          <form className="help-contact-form" onSubmit={handleSubmit}>
            {formError && <div className="help-form-error">{formError}</div>}
            <div className="help-form-fields">
              <div className="help-form-field">
                <label>Your Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  placeholder="Full name"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="help-form-field">
                <label>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="you@example.com"
                  required
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="help-form-field">
              <label>Message *</label>
              <textarea
                name="message"
                value={form.message}
                onChange={updateField}
                placeholder="Describe your issue or question..."
                rows={5}
                required
                disabled={submitting}
              />
            </div>
            <button type="submit" className="help-submit-btn" disabled={submitting}>
              {submitting ? <RefreshCw size={15} className="help-spin" /> : <Send size={15} />}
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
