import { DATA_MODES } from "../context/DataModeContext";

const styles = {
  live: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.6px",
    padding: "3px 9px",
    borderRadius: 6,
    background: "rgba(52, 199, 89, 0.1)",
    color: "#1a7a38",
    border: "1px solid rgba(52, 199, 89, 0.28)",
  },
  demo: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.6px",
    padding: "3px 9px",
    borderRadius: 6,
    background: "rgba(245, 166, 35, 0.1)",
    color: "#b8700a",
    border: "1px solid rgba(245, 166, 35, 0.28)",
  },
};

export default function DataSourceBadge({ mode }) {
  const isDemo = mode === DATA_MODES.DEMO;
  return (
    <span style={isDemo ? styles.demo : styles.live}>
      {isDemo ? "◈" : "●"} {isDemo ? "SIMULATED" : "LIVE"}
    </span>
  );
}
