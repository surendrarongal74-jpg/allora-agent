/** Shared by connection settings and reporting before the full API module can load. */
export const API_BASE_STORAGE_KEY = "rakazo.api_base";
export const LOCAL_API = "http://127.0.0.1:3100";
/** ALLORA's own server: release builds sign up here with no server step. */
export const ALLORA_SERVER = "https://didactic-space-goggles-7775gxr7xqqhp97w-5173.app.github.dev";
/**
 * Set at build time with EXPO_PUBLIC_DEFAULT_SERVER_URL (or the older EXPO_PUBLIC_API_URL).
 * Without either, release bundles use ALLORA's server and development keeps the local one.
 * A server the user saved always wins over this default.
 */
export const DEFAULT_API =
  process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? ALLORA_SERVER : LOCAL_API);
