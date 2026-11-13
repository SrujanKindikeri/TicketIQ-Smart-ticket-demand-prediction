import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Film, Building2, Clock3, CalendarDays, AlertTriangle } from "lucide-react";
import "./Checkout.css";

const API = "http://127.0.0.1:8000/api/";
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function useCountdown(expiresAt) {
  const [seconds, setSeconds] = useState(null);

  useEffect(() => {
    if (!expiresAt) return;
    function calc() {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setSeconds(diff);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Checkout({
  selectedMovie, selectedShow, heldSeats, sessionToken, expiresAt, onNext, onBack
}) {
  const [form, setForm] = useState({ customer_name: "", customer_email: "", customer_phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const countdown = useCountdown(expiresAt);
  const rzpRef = useRef(null);

  const basePrice = Number(selectedShow.ticket_price || 0);
  const CATEGORY_MULTIPLIER = { Silver: 1.0, Gold: 1.5, Premium: 2.0 };
  const total = heldSeats.reduce((sum, seat) => {
    const mult = CATEGORY_MULTIPLIER[seat.category] || 1.0;
    return sum + basePrice * mult;
  }, 0);

  function updateField(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function verifyAndConfirm(razorpayResponse) {
    const resp = await axios.post(`${API}payments/verify/`, razorpayResponse);
    onNext({ bookingRef: resp.data.booking_reference });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const resp = await axios.post(`${API}bookings/create/`, {
        hold_token: sessionToken,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
      });

      const { razorpay_key_id, razorpay_order_id, booking_reference } = resp.data;

      if (razorpay_key_id) {
        // Load Razorpay script dynamically
        if (!window.Razorpay) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          });
        }

        const rzpOptions = {
          key: razorpay_key_id,
          amount: Math.round(total * 100),
          currency: "INR",
          order_id: razorpay_order_id,
          name: "TicketIQ",
          description: `${selectedMovie.title} — ${heldSeats.length} ticket(s)`,
          handler: async (response) => {
            try {
              await verifyAndConfirm(response);
            } catch {
              setError("Payment verification failed. Contact support.");
            }
          },
          prefill: {
            name: form.customer_name,
            email: form.customer_email,
            contact: form.customer_phone,
          },
          theme: { color: "#007AFF" },
          modal: { ondismiss: () => setSubmitting(false) },
        };

        rzpRef.current = new window.Razorpay(rzpOptions);
        rzpRef.current.open();
        // Don't set submitting false here — wait for handler or dismiss
      } else {
        // Test / sandbox mode — store booking_reference for simulate button
        setSubmitting(false);
        // Store order ID for simulate
        rzpRef.current = { order_id: razorpay_order_id, booking_reference };
        // Show test mode UI by setting a flag via error-free mechanism
        setError("__TEST_MODE__:" + razorpay_order_id + ":" + booking_reference);
      }
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || data?.detail || "Unable to create booking. Please try again.");
      setSubmitting(false);
    }
  }

  async function simulatePayment() {
    setSubmitting(true);
    setError("");
    const parts = error.split(":");
    const orderId = parts[1];
    const bookingRef = parts[2];

    try {
      await axios.post(`${API}payments/verify/`, {
        razorpay_order_id: orderId,
        razorpay_payment_id: "test_pay_" + Date.now(),
        razorpay_signature: "test",
        booking_reference: bookingRef,
      });
      onNext({ bookingRef });
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || data?.detail || "Simulation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const isTestMode = error.startsWith("__TEST_MODE__");
  const realError = isTestMode ? "" : error;

  return (
    <div className="checkout-page">
      <div className="checkout-heading">
        <div>
          <span className="checkout-eyebrow">CHECKOUT</span>
          <h1>Complete Booking</h1>
          <p>Review your selection and enter your details.</p>
        </div>
        <button className="checkout-back-btn" onClick={onBack} disabled={submitting}>
          ← Change seats
        </button>
      </div>

      {countdown !== null && (
        <div className={`checkout-countdown ${Number(countdown?.split(":")[0]) === 0 && Number(countdown?.split(":")[1]) < 60 ? "checkout-countdown-warn" : ""}`}>
          <Clock3 size={15} />
          Seats held for: <strong>{countdown}</strong>
        </div>
      )}

      {isTestMode && (
        <div className="checkout-test-banner">
          <AlertTriangle size={16} />
          <div>
            <strong>Test Mode</strong> — No real payment will be processed.
            <br />
            <button
              className="checkout-simulate-btn"
              onClick={simulatePayment}
              disabled={submitting}
            >
              {submitting ? "Processing..." : "Simulate Payment Success"}
            </button>
          </div>
        </div>
      )}

      {realError && <div className="checkout-error">{realError}</div>}

      <div className="checkout-layout">
        {/* Booking Summary */}
        <div className="checkout-summary">
          <div className="checkout-summary-heading">
            <span className="checkout-eyebrow">BOOKING SUMMARY</span>
          </div>

          <div className="checkout-summary-row">
            <Film size={15} />
            <div>
              <strong>{selectedMovie.title}</strong>
              <span>{selectedMovie.genre}</span>
            </div>
          </div>

          <div className="checkout-summary-row">
            <Building2 size={15} />
            <div>
              <strong>{selectedShow.cinema_name || `Cinema #${selectedShow.cinema}`}</strong>
            </div>
          </div>

          <div className="checkout-summary-row">
            <CalendarDays size={15} />
            <div>
              <strong>{selectedShow.show_date}</strong>
              <span>{selectedShow.show_time?.slice(0, 5)}</span>
            </div>
          </div>

          <div className="checkout-seats-list">
            <span className="checkout-eyebrow">SELECTED SEATS</span>
            <div className="checkout-seat-chips">
              {heldSeats.map((seat) => (
                <span key={seat.id} className="checkout-seat-chip">
                  {seat.row}{seat.seat_number}
                  <span className="checkout-seat-cat">{seat.category}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="checkout-total-row">
            <span>Total amount</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </div>

        {/* Customer Form */}
        {!isTestMode && (
          <form className="checkout-form" onSubmit={handleSubmit}>
            <span className="checkout-eyebrow">YOUR DETAILS</span>

            <label>
              Full name *
              <input
                name="customer_name"
                value={form.customer_name}
                onChange={updateField}
                placeholder="Enter your full name"
                required
                disabled={submitting}
              />
            </label>

            <label>
              Email address *
              <input
                type="email"
                name="customer_email"
                value={form.customer_email}
                onChange={updateField}
                placeholder="you@example.com"
                required
                disabled={submitting}
              />
            </label>

            <label>
              Phone number *
              <input
                type="tel"
                name="customer_phone"
                value={form.customer_phone}
                onChange={updateField}
                placeholder="10-digit mobile number"
                pattern="[0-9]{10}"
                required
                disabled={submitting}
              />
            </label>

            <button
              type="submit"
              className="checkout-pay-btn"
              disabled={submitting}
            >
              {submitting ? "Processing..." : `Pay ${formatPrice(total)}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
