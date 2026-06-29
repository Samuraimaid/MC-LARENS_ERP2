// Playwright config for simple UI smoke tests
const fs = require("fs");

const chromePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const useSystemChrome = fs.existsSync(chromePath);

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  timeout: 90 * 1000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15 * 1000,
    trace: "off",
    ...(useSystemChrome
      ? { launchOptions: { executablePath: chromePath } }
      : {}),
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
};
