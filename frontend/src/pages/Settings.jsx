import { useEffect, useState } from "react";
import axios from "../api";
import { Save, RefreshCw, Settings as SettingsIcon, User, Bell, Lock, Ticket, IndianRupee } from "lucide-react";
import "./Settings.css";

const API = "http://127.0.0.1:8000/api/";

const DEFAULTS = {
  app_name: "TicketIQ",
  timezone: "Asia/Kolkata",
  currency: "INR",
  max_seats_per_booking: "10",
  hold_expiry_minutes: "5",
  default_ticket_price: "150",
  silver_multiplier: "1.00",
  gold_multiplier: "1.30",
  premium_multiplier: "1.60",
  email_notifications: "true",
  session_timeout_minutes: "60",
};

export default function Settings({ auth }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchSettings() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const resp = await axios.get(`${API}settings/`);
      setSettings({ ...DEFAULTS, ...resp.data });
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || d?.error || "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  function update(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await axios.patch(`${API}settings/`, settings);
      setSuccess("Settings saved successfully.");
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || d?.error || "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    fetchSettings();
  }

  return (
    <div className="settings-page">
      <div className="settings-heading">
        <div>
          <span className="settings-eyebrow">CONFIGURATION</span>
          <h1>Settings</h1>
          <p>Manage application preferences and configuration.</p>
        </div>
      </div>

      {error && <div className="settings-error">{error}</div>}
      {success && <div className="settings-success">{success}</div>}

      {loading ? (
        <div className="settings-loading">
          <RefreshCw className="settings-spin" size={24} />
          <p>Loading settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="settings-form">
          {/* Application Profile */}
          <section className="settings-section">
            <div className="settings-section-header">
              <SettingsIcon size={18} />
              <h2>Application Profile</h2>
            </div>
            <div className="settings-fields">
              <div className="settings-field">
                <label>Application Name</label>
                <input
                  value={settings.app_name}
                  onChange={(e) => update("app_name", e.target.value)}
                  placeholder="TicketIQ"
                />
              </div>
              <div className="settings-field">
                <label>Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                </select>
              </div>
              <div className="settings-field">
                <label>Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => update("currency", e.target.value)}
                >
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
            </div>
          </section>

          {/* Administrator Profile */}
          <section className="settings-section">
            <div className="settings-section-header">
              <User size={18} />
              <h2>Administrator Profile</h2>
            </div>
            <div className="settings-fields">
              <div className="settings-field">
                <label>Display Name</label>
                <input
                  value={auth?.username || "Administrator"}
                  readOnly
                  className="settings-input-readonly"
                />
                <span className="settings-hint">Username from Django auth — change via Django admin.</span>
              </div>
              <div className="settings-field">
                <label>Role</label>
                <input
                  value={auth?.is_admin ? "Administrator" : "Staff"}
                  readOnly
                  className="settings-input-readonly"
                />
              </div>
            </div>
          </section>

          {/* Booking Configuration */}
          <section className="settings-section">
            <div className="settings-section-header">
              <Ticket size={18} />
              <h2>Booking Configuration</h2>
            </div>
            <div className="settings-fields">
              <div className="settings-field">
                <label>Max Seats per Booking</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.max_seats_per_booking}
                  onChange={(e) => update("max_seats_per_booking", e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label>Seat Hold Expiry (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.hold_expiry_minutes}
                  onChange={(e) => update("hold_expiry_minutes", e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label>Default Ticket Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.default_ticket_price}
                  onChange={(e) => update("default_ticket_price", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Ticket Pricing */}
          <section className="settings-section">
            <div className="settings-section-header">
              <IndianRupee size={18} />
              <h2>Ticket Pricing Configuration</h2>
            </div>
            <p className="settings-section-desc">
              Price multipliers applied to the base ticket price by seat category.
            </p>
            <div className="settings-fields">
              <div className="settings-field">
                <label>Silver Multiplier</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={settings.silver_multiplier}
                  onChange={(e) => update("silver_multiplier", e.target.value)}
                />
                <span className="settings-hint">Base rows (front)</span>
              </div>
              <div className="settings-field">
                <label>Gold Multiplier</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={settings.gold_multiplier}
                  onChange={(e) => update("gold_multiplier", e.target.value)}
                />
                <span className="settings-hint">Middle rows</span>
              </div>
              <div className="settings-field">
                <label>Premium Multiplier</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={settings.premium_multiplier}
                  onChange={(e) => update("premium_multiplier", e.target.value)}
                />
                <span className="settings-hint">Back rows</span>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="settings-section">
            <div className="settings-section-header">
              <Bell size={18} />
              <h2>Notification Preferences</h2>
            </div>
            <div className="settings-fields">
              <div className="settings-field settings-field-toggle">
                <div>
                  <label>Email Notifications</label>
                  <span className="settings-hint">Send booking confirmation emails to customers.</span>
                </div>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.email_notifications === "true"}
                    onChange={(e) => update("email_notifications", e.target.checked ? "true" : "false")}
                  />
                  <span className="settings-toggle-track" />
                </label>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="settings-section">
            <div className="settings-section-header">
              <Lock size={18} />
              <h2>Security Settings</h2>
            </div>
            <div className="settings-fields">
              <div className="settings-field">
                <label>Session Timeout (minutes)</label>
                <input
                  value={settings.session_timeout_minutes}
                  readOnly
                  className="settings-input-readonly"
                />
                <span className="settings-hint">Configured via Django session settings.</span>
              </div>
            </div>
          </section>

          <div className="settings-actions">
            <button
              type="button"
              className="settings-reset-btn"
              onClick={handleReset}
              disabled={saving}
            >
              <RefreshCw size={15} />
              Reset
            </button>
            <button
              type="submit"
              className="settings-save-btn"
              disabled={saving}
            >
              {saving ? <RefreshCw size={15} className="settings-spin" /> : <Save size={15} />}
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
