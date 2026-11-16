import axios from "axios";
import i18n from "../i18n";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787/api";

export const api = axios.create({ baseURL: API_URL });

export function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export function setToken(token: string, rememberMe: boolean) {
  if (rememberMe) {
    localStorage.setItem("token", token);
    sessionStorage.removeItem("token");
  } else {
    sessionStorage.setItem("token", token);
    localStorage.removeItem("token");
  }
}

export function clearToken() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    // No response at all (network/DNS/CORS failure, timeout, or the backend is down)
    // is a connectivity problem, not whatever the caller's fallback describes (e.g.
    // "Invalid email or password") — showing that fallback here would misreport an
    // outage as a credentials or validation error.
    if (!err.response) {
      return i18n.t("common.connectionError");
    }
    return err.response.data?.error || fallback;
  }
  return fallback;
}
