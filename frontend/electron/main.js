const { app, BrowserWindow, Menu, session } = require("electron");
const path = require("path");

const SESSION_PARTITION = "persist:mclarens-erp";
const isDev = process.env.ELECTRON_DEV === "1" || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0f172a",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: SESSION_PARTITION,
      devTools: isDev,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL || "http://127.0.0.1:3000");
  } else {
    win.loadFile(path.join(__dirname, "..", "build", "index.html"));
  }

  if (!isDev) {
    win.webContents.on("before-input-event", (event, input) => {
      const blocked =
        (input.control || input.meta) && input.shift && input.key.toLowerCase() === "i" ||
        input.key === "F12";
      if (blocked) event.preventDefault();
    });
    win.webContents.on("devtools-opened", () => win.webContents.closeDevTools());
  }

  return win;
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  const erpSession = session.fromPartition(SESSION_PARTITION);
  erpSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});