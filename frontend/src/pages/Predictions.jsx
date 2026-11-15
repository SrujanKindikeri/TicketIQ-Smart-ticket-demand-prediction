import { useEffect, useState } from "react";
import axios from "../api";
import {
  TrendingUp, RefreshCw, AlertTriangle, BarChart2, Cpu, History,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import "./Predictions.css";

const API = "http://127.0.0.1:8000/api/";

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function Predictions() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [genMessage, setGenMessage] = useState("");

  async function fetchPredictions() {
    setLoading(true);
    setError("");
    setGenMessage("");
    try {
      const [predResp, histResp] = await Promise.all([
        axios.get(`${API}ml/predictions/`),
        axios.get(`${API}predictions/?page_size=10`),
      ]);
      setData(predResp.data);
      const histData = Array.isArray(histResp.data)
        ? histResp.data
        : histResp.data.results || [];
      setHistory(histData);
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || d?.error || d?.reason || "Unable to load predictions.");
    } finally {
      setLoading(false);
    }
  }

  async function generatePredictions() {
    setGenerating(true);
    setGenMessage("");
    setError("");
    try {
      const resp = await axios.post(`${API}ml/predictions/generate/`);
      setGenMessage(`Generated and saved ${resp.data.saved} prediction(s) using ${resp.data.model_name}.`);
      await fetchPredictions();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || d?.error || d?.reason || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    fetchPredictions();
  }, []);

  const isUnavailable = data?.status === "unavailable";
  const predictions = data?.predictions || [];
  const summary = data?.summary || {};

  // Chart: predicted vs actual tickets (top 10 by show_date)
  const chartData = predictions.slice(0, 10).map((p) => ({
    name: `${p.movie.slice(0, 12)}… ${p.show_date.slice(5)}`,
    predicted: Math.round(p.predicted_tickets),
    actual: p.actual_tickets,
  }));

  return (
    <div className="predictions-page">
      <div className="predictions-heading">
        <div>
          <span className="predictions-eyebrow">ML FORECASTING</span>
          <h1>Demand Predictions</h1>
          <p>Ticket demand forecasts from trained machine learning models.</p>
        </div>
        <div className="predictions-heading-actions">
          <button
            className="predictions-refresh-btn"
            onClick={fetchPredictions}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={17} className={loading ? "predictions-spin" : ""} />
          </button>
          <button
            className="predictions-generate-btn"
            onClick={generatePredictions}
            disabled={generating || loading}
          >
            {generating ? <RefreshCw size={15} className="predictions-spin" /> : <TrendingUp size={15} />}
            {generating ? "Generating..." : "Generate Prediction"}
          </button>
        </div>
      </div>

      {genMessage && <div className="predictions-success">{genMessage}</div>}
      {error && (
        <div className="predictions-error">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Model status card */}
      <section className="predictions-model-card">
        <div className="predictions-model-icon">
          <Cpu size={22} />
        </div>
        <div className="predictions-model-info">
          <span className="predictions-eyebrow">MODEL STATUS</span>
          <h2>{data?.model_name || "—"}</h2>
          <p>Feature count: {data?.feature_count ?? "—"}</p>
        </div>
        <span className={`predictions-model-badge ${isUnavailable ? "unavailable" : "available"}`}>
          {isUnavailable ? "Unavailable" : "Available"}
        </span>
      </section>

      {loading ? (
        <div className="predictions-loading">
          <RefreshCw className="predictions-spin" size={25} />
          <p>Loading predictions...</p>
        </div>
      ) : isUnavailable ? (
        <div className="predictions-unavailable">
          <AlertTriangle size={32} />
          <h2>Model unavailable</h2>
          <p>{data?.reason || "No trained model found."}</p>
          <p className="predictions-setup-hint">
            Run the training notebook or script to generate model files in <code>artifacts/models/</code>.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="predictions-stats-grid">
            <div className="predictions-stat-card">
              <span className="predictions-stat-label">Predicted Tickets</span>
              <div className="predictions-stat-value">{summary.predicted_tickets?.toLocaleString("en-IN") ?? "—"}</div>
              <span className="predictions-stat-sub">across {summary.show_count ?? 0} shows</span>
            </div>
            <div className="predictions-stat-card">
              <span className="predictions-stat-label">Avg Occupancy</span>
              <div className="predictions-stat-value">{summary.predicted_occupancy ?? "—"}%</div>
              <span className="predictions-stat-sub">predicted average</span>
            </div>
            <div className="predictions-stat-card">
              <span className="predictions-stat-label">Predicted Revenue</span>
              <div className="predictions-stat-value">{formatPrice(summary.predicted_revenue)}</div>
              <span className="predictions-stat-sub">estimated total</span>
            </div>
            <div className="predictions-stat-card">
              <span className="predictions-stat-label">Total Capacity</span>
              <div className="predictions-stat-value">{summary.total_capacity?.toLocaleString("en-IN") ?? "—"}</div>
              <span className="predictions-stat-sub">seats across shows</span>
            </div>
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <section className="predictions-chart-section">
              <div className="predictions-section-heading">
                <BarChart2 size={18} />
                <h2>Predicted vs Actual Tickets</h2>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend verticalAlign="top" />
                  <Bar dataKey="predicted" fill="#3478f6" name="Predicted" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" fill="#34c759" name="Actual" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Per-show forecast table */}
          {predictions.length > 0 && (
            <section className="predictions-table-section">
              <div className="predictions-section-heading">
                <TrendingUp size={18} />
                <h2>Per-Show Forecast</h2>
              </div>
              <div className="predictions-table-wrap">
                <table className="predictions-table">
                  <thead>
                    <tr>
                      <th>Movie</th>
                      <th>Cinema</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Predicted Tickets</th>
                      <th>Actual Tickets</th>
                      <th>Occupancy</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((p) => (
                      <tr key={p.show_id}>
                        <td>{p.movie}</td>
                        <td>{p.cinema}</td>
                        <td>{p.show_date}</td>
                        <td>{p.show_time}</td>
                        <td><strong>{p.predicted_tickets}</strong></td>
                        <td>{p.actual_tickets}</td>
                        <td>
                          <div className="predictions-occupancy-bar">
                            <div
                              className="predictions-occupancy-fill"
                              style={{ width: `${Math.min(100, p.predicted_occupancy)}%` }}
                            />
                            <span>{p.predicted_occupancy}%</span>
                          </div>
                        </td>
                        <td>{formatPrice(p.predicted_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Model metrics — only shown if backend returned them */}
          {data?.model_metrics && (
            <section className="predictions-metrics-section">
              <div className="predictions-section-heading">
                <Cpu size={18} />
                <h2>Model Metrics</h2>
              </div>
              <div className="predictions-metrics-grid">
                {Object.entries(data.model_metrics).map(([key, value]) => (
                  <div className="predictions-metric-card" key={key}>
                    <span className="predictions-metric-label">{key}</span>
                    <div className="predictions-metric-value">
                      {typeof value === "number" ? value.toFixed(4) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Prediction history */}
      {history.length > 0 && (
        <section className="predictions-history-section">
          <div className="predictions-section-heading">
            <History size={18} />
            <h2>Prediction History (last 10)</h2>
          </div>
          <div className="predictions-history-list">
            {history.map((h) => (
              <div className="predictions-history-item" key={h.id}>
                <div>
                  <strong>Show #{h.show}</strong>
                  <span className="predictions-history-model">{h.model_name}</span>
                </div>
                <div className="predictions-history-stats">
                  <span>{h.predicted_tickets?.toFixed(0)} tickets</span>
                  <span>{h.predicted_occupancy?.toFixed(1)}%</span>
                  <span>{formatPrice(h.predicted_revenue)}</span>
                </div>
                <span className="predictions-history-date">
                  {new Date(h.created_at).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
