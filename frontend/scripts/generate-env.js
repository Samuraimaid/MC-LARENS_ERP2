const fs = require('fs');
const path = require('path');

// Generate runtime env file for the SPA (public/env.js)
const publicDir = path.resolve(__dirname, '..', 'public');
const outFile = path.join(publicDir, 'env.js');

const isCapacitorBuild = process.env.VITE_IS_CAPACITOR === 'true' || process.env.CAPACITOR === 'true';
const configuredBackendUrl = process.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || (isCapacitorBuild ? 'https://mclarens-erp-836176703716.us-central1.run.app' : '');
const apiBaseExpression = configuredBackendUrl
  ? `'${String(configuredBackendUrl).replace(/\/$/, '')}/api'`
  : `(typeof window !== 'undefined' && (window.Capacitor?.isNativePlatform?.() || window.location?.protocol === 'capacitor:' || (window.location?.hostname === 'localhost' && !window.location?.port && (navigator?.userAgent?.includes('Android') || navigator?.userAgent?.includes('wv') || navigator?.userAgent?.includes('Mobile'))))) ? 'https://mclarens-erp-836176703716.us-central1.run.app/api' : '/api'`;
const attendanceKioskShortcutPin = process.env.VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN || process.env.REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN || '';
const buildTime = process.env.VITE_APP_BUILD_TIME || process.env.REACT_APP_BUILD_TIME || new Date().toISOString();
const buildId = process.env.VITE_APP_BUILD_ID || process.env.REACT_APP_BUILD_ID || (() => {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth()+1).padStart(2,'0');
  const DD = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `${YYYY}${MM}${DD}-${hh}${mm}`;
})();
// Try to include git short hash and branch for clearer build labeling when available
let gitHash = process.env.VITE_APP_GIT_HASH || process.env.REACT_APP_GIT_HASH || '';
let gitBranch = process.env.VITE_APP_GIT_BRANCH || process.env.REACT_APP_GIT_BRANCH || '';
try {
  const cp = require('child_process');
  const hasGit = cp.spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0;
  if (hasGit && !gitHash) {
    gitHash = cp.execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  }
  if (hasGit && !gitBranch) {
    gitBranch = cp.execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  }
} catch (e) {
  // ignore if git metadata is unavailable in the build environment
}
const version = process.env.VITE_APP_VERSION || process.env.REACT_APP_VERSION || require('../package.json').version || '0.2.0-beta.0';

const failoverTunnelMain = process.env.VITE_FAILOVER_TUNNEL_MAIN || process.env.REACT_APP_FAILOVER_TUNNEL_MAIN || 'https://mclarenerp.com';
const failoverTunnelNorth = process.env.VITE_FAILOVER_TUNNEL_NORTH || process.env.REACT_APP_FAILOVER_TUNNEL_NORTH || 'https://north.mclarenerp.com';
const failoverTunnelSouth = process.env.VITE_FAILOVER_TUNNEL_SOUTH || process.env.REACT_APP_FAILOVER_TUNNEL_SOUTH || 'https://south.mclarenerp.com';

const content = `// This file is auto-generated at build time
window.__API_BASE__ = ${apiBaseExpression};
window.__FAILOVER_TUNNEL_MAIN__ = '${failoverTunnelMain}';
window.__FAILOVER_TUNNEL_NORTH__ = '${failoverTunnelNorth}';
window.__FAILOVER_TUNNEL_SOUTH__ = '${failoverTunnelSouth}';
window.__ATTENDANCE_KIOSK_SHORTCUT_PIN__ = '${attendanceKioskShortcutPin}';
window.__BUILD_TIME__ = '${buildTime}';
window.__BUILD_ID__ = '${buildId}';
window.__BUILD_VERSION__ = '${version}';
window.__BUILD_GIT_HASH__ = '${gitHash}';
window.__BUILD_GIT_BRANCH__ = '${gitBranch}';
window.__BUILD_LABEL__ = '${version} | ${buildId}${gitHash ? ' | ' + gitHash : ''}${gitBranch ? ' @' + gitBranch : ''}';
`;

fs.writeFileSync(outFile, content, { encoding: 'utf8' });
console.log('Wrote', outFile);
