import axios from "axios";

export const API_BASE = "http://127.0.0.1:8000/api/";

// Always send session cookies
axios.defaults.withCredentials = true;

// Read csrftoken cookie and attach it to every mutating request
function getCsrfToken() {
  const name = "csrftoken";
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

axios.interceptors.request.use((config) => {
  const method = (config.method || "").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    config.headers["X-CSRFToken"] = getCsrfToken();
  }
  return config;
});

export default axios;
