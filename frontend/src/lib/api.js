import { APP_ENV } from "./env";
import { getRuntimeApiBase } from "./runtimeApi";

export const API_BASE = APP_ENV.apiBase;
export function getApiBase() {
  return getRuntimeApiBase();
}
export const BUILD_TIME = APP_ENV.buildTime || "";
export const BUILD_ID = APP_ENV.buildId || "";
export const BUILD_VERSION = APP_ENV.buildVersion || "";
