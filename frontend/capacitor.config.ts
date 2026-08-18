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
      "172.16.*",
      "127.0.0.1",
      "localhost",
      "*.mclarenerp.com",
      "mclarenerp.com",
      "*.run.app",
      "mclarens-erp-836176703716.us-central1.run.app",
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#09090b",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#09090b",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
      overlaysWebView: false,
    },
  },
};

export default config;