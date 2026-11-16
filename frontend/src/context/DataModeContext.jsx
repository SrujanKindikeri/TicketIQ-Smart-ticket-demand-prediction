import { createContext, useContext, useState } from "react";

export const DATA_MODES = {
  LIVE: "live",
  DEMO: "demo",
};

const STORAGE_KEY = "ticketiq_data_mode";

const DataModeContext = createContext({
  mode: DATA_MODES.LIVE,
  setMode: () => {},
});

export function DataModeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === DATA_MODES.DEMO ? DATA_MODES.DEMO : DATA_MODES.LIVE;
  });

  function setMode(newMode) {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }

  return (
    <DataModeContext.Provider value={{ mode, setMode }}>
      {children}
    </DataModeContext.Provider>
  );
}

export function useDataMode() {
  return useContext(DataModeContext);
}
