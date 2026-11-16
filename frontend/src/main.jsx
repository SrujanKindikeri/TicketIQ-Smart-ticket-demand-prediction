import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { DataModeProvider } from "./context/DataModeContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DataModeProvider>
      <App />
    </DataModeProvider>
  </React.StrictMode>
);
