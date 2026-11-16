import { Database, Wifi } from "lucide-react";
import { DATA_MODES, useDataMode } from "../context/DataModeContext";
import "./DataModeSwitch.css";

export default function DataModeSwitch() {
  const { mode, setMode } = useDataMode();

  return (
    <div className="data-mode-switch">
      <div className="data-mode-switch__track" role="group" aria-label="Data mode">
        <button
          className={`data-mode-switch__btn live${mode === DATA_MODES.LIVE ? " data-mode-switch__btn--active" : ""}`}
          onClick={() => setMode(DATA_MODES.LIVE)}
          aria-pressed={mode === DATA_MODES.LIVE}
          title="Switch to Live Database"
        >
          <span className="data-mode-switch__dot" />
          <Wifi size={13} />
          Live Database
        </button>

        <button
          className={`data-mode-switch__btn demo${mode === DATA_MODES.DEMO ? " data-mode-switch__btn--active" : ""}`}
          onClick={() => setMode(DATA_MODES.DEMO)}
          aria-pressed={mode === DATA_MODES.DEMO}
          title="Switch to Dataset Demo"
        >
          <span className="data-mode-switch__dot" />
          <Database size={13} />
          Dataset Demo
        </button>
      </div>

      {mode === DATA_MODES.DEMO && (
        <span className="data-mode-switch__badge">SIMULATED</span>
      )}
    </div>
  );
}
