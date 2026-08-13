/**
 * Konfigurasi environment yang aman untuk SSR dan CSR.
 * Menggantikan import.meta.env (Vite) dengan process.env (Next.js).
 */
export const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8000/api";

export const DEVICE_API_TOKEN =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEVICE_API_TOKEN) ||
  "";

export const APP_MODE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_MODE) ||
  "demo";
