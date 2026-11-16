import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Database, Search, Download, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle,
} from "lucide-react";
import DataSourceBadge from "../components/DataSourceBadge";
import { DATA_MODES, useDataMode } from "../context/DataModeContext";
import "./DatasetExplorer.css";

const API_BASE = "http://127.0.0.1:8000/api/dataset/";

function tagClass(source) {
  const map = { real: "real", synthetic: "synthetic", interim: "interim", processed: "processed" };
  return `dataset-item__tag dataset-item__tag--${map[source] || "processed"}`;
}

export default function DatasetExplorer() {
  const { mode } = useDataMode();

  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  async function fetchDatasets() {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(API_BASE);
      setDatasets(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError("Unable to load dataset list. Make sure the Django backend is running.");
    } finally {
      setLoading(false);
    }
  }

  const fetchPreview = useCallback(async (id, pg, pgSize, srch) => {
    if (!id) return;
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const params = { page: pg, page_size: pgSize };
      if (srch) params.search = srch;
      const response = await axios.get(`${API_BASE}${id}/preview/`, { params });
      setPreview(response.data);
    } catch (err) {
      const d = err.response?.data;
      setPreviewError(d?.error || d?.warning || "Unable to load dataset preview.");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchPreview(selectedId, page, pageSize, search);
    }
  }, [selectedId, page, pageSize, search, fetchPreview]);

  function selectDataset(id) {
    setSelectedId(id);
    setPage(1);
    setSearch("");
    setSearchInput("");
    setPreview(null);
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function downloadUrl(id) {
    return `${API_BASE}${id}/download/`;
  }

  const selectedDs = datasets.find((d) => d.id === selectedId);

  return (
    <div className="dataset-explorer">
      <div className="dataset-explorer-heading">
        <div>
          <span className="dataset-explorer-eyebrow">DATA INTELLIGENCE</span>
          <h1>
            Dataset Explorer
            <DataSourceBadge mode={mode} />
          </h1>
          <p>Inspect, search, and download the raw datasets powering TicketIQ.</p>
        </div>
        <button
          className="dataset-download-btn"
          onClick={fetchDatasets}
          title="Refresh dataset list"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="dataset-loading">
          <RefreshCw className="dataset-loading-spin" size={28} />
          <p>Discovering datasets...</p>
        </div>
      ) : error ? (
        <div className="dataset-error">
          <AlertTriangle size={28} />
          <p>{error}</p>
        </div>
      ) : (
        <div className="dataset-layout">
          {/* Sidebar */}
          <aside className="dataset-sidebar">
            <div className="dataset-sidebar-title">AVAILABLE DATASETS</div>
            {datasets.length === 0 && (
              <p style={{ fontSize: 13, color: "#969ba7", padding: "8px 4px" }}>No datasets found.</p>
            )}
            {datasets.map((ds) => (
              <button
                key={ds.id}
                className={`dataset-item${selectedId === ds.id ? " dataset-item--active" : ""}`}
                onClick={() => selectDataset(ds.id)}
              >
                <span className="dataset-item__name">{ds.name}</span>
                <div className="dataset-item__meta">
                  <span className={tagClass(ds.data_source)}>{ds.data_source}</span>
                  {ds.record_count != null && (
                    <span className="dataset-item__count">{ds.record_count.toLocaleString()} rows</span>
                  )}
                  {ds.column_count != null && (
                    <span className="dataset-item__count">{ds.column_count} cols</span>
                  )}
                  {ds.error && (
                    <span style={{ fontSize: 10, color: "#c0392b" }}>⚠ {ds.error}</span>
                  )}
                </div>
              </button>
            ))}
          </aside>

          {/* Main area */}
          <div className="dataset-main">
            {!selectedId ? (
              <div className="dataset-no-selection">
                <Database size={36} strokeWidth={1.3} />
                <h3>Select a dataset</h3>
                <p>Choose a dataset from the sidebar to explore its contents.</p>
              </div>
            ) : (
              <>
                {/* Dataset meta */}
                <div className="dataset-panel">
                  <div className="dataset-panel-heading">
                    <div>
                      <h2>{selectedDs?.name}</h2>
                      <p>{selectedDs?.file_path}</p>
                    </div>
                    <div className="dataset-panel-actions">
                      <DataSourceBadge mode={selectedDs?.data_source === "real" ? DATA_MODES.LIVE : DATA_MODES.DEMO} />
                      <a
                        className="dataset-download-btn"
                        href={downloadUrl(selectedId)}
                        download
                        title="Download as CSV"
                      >
                        <Download size={14} />
                        Download CSV
                      </a>
                    </div>
                  </div>

                  {selectedDs && !selectedDs.error && (
                    <div className="dataset-meta-grid">
                      <div className="dataset-meta-cell">
                        <span className="dataset-meta-cell__label">Records</span>
                        <span className="dataset-meta-cell__value">{selectedDs.record_count?.toLocaleString() ?? "—"}</span>
                      </div>
                      <div className="dataset-meta-cell">
                        <span className="dataset-meta-cell__label">Columns</span>
                        <span className="dataset-meta-cell__value">{selectedDs.column_count ?? "—"}</span>
                      </div>
                      <div className="dataset-meta-cell">
                        <span className="dataset-meta-cell__label">Missing Values</span>
                        <span className="dataset-meta-cell__value">{selectedDs.missing_value_count?.toLocaleString() ?? "—"}</span>
                      </div>
                      <div className="dataset-meta-cell">
                        <span className="dataset-meta-cell__label">Date Range</span>
                        <span className="dataset-meta-cell__value">
                          {selectedDs.date_range
                            ? `${selectedDs.date_range.min} → ${selectedDs.date_range.max}`
                            : "—"}
                        </span>
                      </div>
                      <div className="dataset-meta-cell">
                        <span className="dataset-meta-cell__label">Source</span>
                        <span className="dataset-meta-cell__value">{selectedDs.data_source}</span>
                      </div>
                      <div className="dataset-meta-cell">
                        <span className="dataset-meta-cell__label">Type</span>
                        <span className="dataset-meta-cell__value">{selectedDs.file_type?.toUpperCase()}</span>
                      </div>
                    </div>
                  )}

                  {selectedDs?.error && (
                    <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>
                      ⚠ {selectedDs.error}
                    </div>
                  )}
                </div>

                {/* Column descriptions */}
                {selectedDs?.columns && selectedDs.columns.length > 0 && (
                  <div className="dataset-panel">
                    <div className="dataset-panel-heading">
                      <div>
                        <h2>Column Descriptions</h2>
                        <p>{selectedDs.columns.length} columns</p>
                      </div>
                    </div>
                    <div className="dataset-table-wrap">
                      <table className="dataset-columns-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Column name</th>
                            <th>Data type</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDs.columns.map((col, i) => (
                            <tr key={col.name}>
                              <td style={{ color: "#969ba7" }}>{i + 1}</td>
                              <td><strong>{col.name}</strong></td>
                              <td><span className="dataset-dtype-badge">{col.dtype}</span></td>
                              <td>{col.description || <span style={{ color: "#969ba7" }}>—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Data preview */}
                <div className="dataset-panel">
                  <div className="dataset-panel-heading">
                    <div>
                      <h2>Data Preview</h2>
                      <p>
                        {preview
                          ? `${preview.count.toLocaleString()} records${search ? ` matching "${search}"` : ""}`
                          : "Paginated rows from the dataset"}
                      </p>
                    </div>
                    <div className="dataset-panel-actions">
                      <label className="dataset-pagination__size">
                        <span style={{ fontSize: 11, color: "#969ba7", marginRight: 4 }}>Rows:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {/* Search */}
                  <form onSubmit={handleSearch} className="dataset-search-bar">
                    <Search size={16} style={{ color: "#969ba7", flexShrink: 0 }} />
                    <input
                      placeholder="Search in any column..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    <button type="submit" className="dataset-pagination__btn" style={{ padding: "4px 12px" }}>
                      Search
                    </button>
                    {search && (
                      <button
                        type="button"
                        className="dataset-pagination__btn"
                        style={{ padding: "4px 10px" }}
                        onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
                      >
                        Clear
                      </button>
                    )}
                  </form>

                  {previewError && (
                    <div className="dataset-error">
                      <AlertTriangle size={20} />
                      <p>{previewError}</p>
                    </div>
                  )}

                  {previewLoading ? (
                    <div className="dataset-loading" style={{ padding: 32 }}>
                      <RefreshCw className="dataset-loading-spin" size={22} />
                      <p>Loading preview...</p>
                    </div>
                  ) : preview && preview.columns && preview.columns.length > 0 ? (
                    <>
                      <div className="dataset-table-wrap">
                        <table className="dataset-table">
                          <thead>
                            <tr>
                              {preview.columns.map((col) => (
                                <th key={col}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((row, rowIdx) => (
                              <tr key={rowIdx}>
                                {row.map((cell, cellIdx) => (
                                  <td key={cellIdx} title={cell != null ? String(cell) : ""}>
                                    {cell != null ? String(cell) : <span style={{ color: "#c0c4cc" }}>null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="dataset-pagination">
                        <span className="dataset-pagination__info">
                          Page {preview.page} of {preview.total_pages} &nbsp;·&nbsp; {preview.count.toLocaleString()} rows total
                        </span>
                        <button
                          className="dataset-pagination__btn"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          <ChevronLeft size={15} />
                          Prev
                        </button>
                        <button
                          className="dataset-pagination__btn"
                          onClick={() => setPage((p) => Math.min(preview.total_pages, p + 1))}
                          disabled={page >= preview.total_pages}
                        >
                          Next
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </>
                  ) : preview && preview.rows && preview.rows.length === 0 ? (
                    <div className="dataset-empty">
                      <p>No records match your search.</p>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
