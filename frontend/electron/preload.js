const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("__ELECTRON_RUNTIME__", {
  platform: process.platform,
  isDesktop: true,
  sessionPartition: "persist:mclarens-erp",
});