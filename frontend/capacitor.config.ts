import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mclarens.erp",
  appName: "MC-LARENS ERP",
  webDir: "build",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
    cleartext: true,
    allowNavigation: [
      "192.168.*",
      "10.*",
      "127.0.0.1",
      "localhost",
      "*.mclarenerp.com",
      "mclarenerp.com",
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;