const path = require("path");
const os = require("os");
const { defineConfig, loadEnv } = require("vite");
const react = require("@vitejs/plugin-react");

const SERVER_START_TIME = Date.now();

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / (1024 ** index)) * 100) / 100} ${units[index]}`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function healthPlugin() {
  return {
    name: "frontend-health-endpoints",
    configureServer(server) {
      const buildState = {
        state: "success",
        errors: [],
        warnings: [],
        totalCompiles: 1,
        firstCompileTime: SERVER_START_TIME,
        lastCompileTime: SERVER_START_TIME,
        lastSuccessTime: SERVER_START_TIME,
        compileDuration: 0,
      };

      server.middlewares.use((req, res, next) => {
        const memUsage = process.memoryUsage();
        const uptime = Date.now() - SERVER_START_TIME;

        const sendJson = (statusCode, payload) => {
          res.statusCode = statusCode;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        };

        if (req.url === "/ping") {
          return sendJson(200, { status: "ok", time: new Date().toISOString() });
        }

        if (req.url === "/health") {
          return sendJson(200, {
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: {
              seconds: Math.floor(uptime / 1000),
              formatted: formatDuration(uptime),
            },
            bundler: {
              name: "vite",
              ...buildState,
              isHealthy: true,
              hasCompiled: true,
              errorCount: 0,
              warningCount: 0,
            },
            server: {
              nodeVersion: process.version,
              platform: os.platform(),
              arch: os.arch(),
              cpus: os.cpus().length,
              memory: {
                heapUsed: formatBytes(memUsage.heapUsed),
                heapTotal: formatBytes(memUsage.heapTotal),
                rss: formatBytes(memUsage.rss),
                external: formatBytes(memUsage.external),
              },
            },
            environment: process.env.NODE_ENV || "development",
          });
        }

        if (req.url === "/health/simple") {
          res.statusCode = 200;
          res.end("OK");
          return;
        }

        if (req.url === "/health/ready") {
          return sendJson(200, { ready: true, state: buildState.state });
        }

        if (req.url === "/health/live") {
          return sendJson(200, { alive: true, timestamp: new Date().toISOString() });
        }

        if (req.url === "/health/errors") {
          return sendJson(200, {
            errorCount: 0,
            warningCount: 0,
            errors: [],
            warnings: [],
            state: buildState.state,
          });
        }

        if (req.url === "/health/stats") {
          return sendJson(200, {
            totalCompiles: buildState.totalCompiles,
            averageCompileTime: `${buildState.compileDuration}ms`,
            lastCompileDuration: `${buildState.compileDuration}ms`,
            firstCompileTime: new Date(buildState.firstCompileTime).toISOString(),
            serverUptime: formatDuration(uptime),
          });
        }

        next();
      });
    },
  };
}

module.exports = defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isDevServer = command === "serve";
  const buildTimestamp = new Date().toISOString();
  const envProcess = {
    NODE_ENV: mode === "production" ? "production" : "development",
    REACT_APP_BACKEND_URL: env.REACT_APP_BACKEND_URL || env.VITE_BACKEND_URL || "",
    REACT_APP_AUTH_URL: env.REACT_APP_AUTH_URL || env.VITE_AUTH_URL || "",
    REACT_APP_VERSION: env.REACT_APP_VERSION || env.npm_package_version || "0.2.0-cloud",
    REACT_APP_BUILD_TIME: env.REACT_APP_BUILD_TIME || buildTimestamp,
    REACT_APP_BUILD_ID: env.REACT_APP_BUILD_ID || buildTimestamp,
    REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN: env.REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN || env.VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN || "",
  };

  return {
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.[jt]sx?$/,
      exclude: [],
    },
    plugins: [
      react({
        include: /\.(jsx|js|tsx|ts)$/,
        babel: isDevServer
          ? {
              plugins: [path.resolve(__dirname, "plugins/visual-edits/babel-metadata-plugin.js")],
            }
          : undefined,
      }),
      healthPlugin(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
      extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    },
    publicDir: path.resolve(__dirname, "public"),
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      watch: {
        ignored: ["**/node_modules/**", "**/.git/**", "**/build/**", "**/dist/**", "**/coverage/**"],
      },
      proxy: {
        "/api": {
          target: env.DEV_API_PROXY_TARGET || env.VITE_DEV_API_PROXY_TARGET || "http://127.0.0.1:8001",
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
    },
    build: {
      outDir: "build",
      emptyOutDir: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("recharts")) {
              return "charts-vendor";
            }

            if (id.includes("react-day-picker") || id.includes("date-fns")) {
              return "date-vendor";
            }

            return "vendor";
          },
        },
      },
    },
    define: {
      "process.env": JSON.stringify(envProcess),
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.{test,spec}.{js,jsx}"],
      exclude: ["e2e/**", "tests/**", "node_modules/**", "build/**"],
    },
  };
});