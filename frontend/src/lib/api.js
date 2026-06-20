import { APP_ENV } from "./env";

export const API_BASE = APP_ENV.apiBase;
export const BUILD_TIME = APP_ENV.buildTime || "";
export const BUILD_ID = APP_ENV.buildId || "";
export const BUILD_VERSION = APP_ENV.buildVersion || "";
