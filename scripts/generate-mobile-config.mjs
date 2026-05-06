import { writeFileSync } from "node:fs";

const DEFAULT_MOBILE_APP_ORIGIN = "https://gymos.example";

const configuredOrigin =
  process.env.GYMOS_MOBILE_APP_ORIGIN ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_BASE_URL ||
  DEFAULT_MOBILE_APP_ORIGIN;
const normalizedOrigin = configuredOrigin.includes("://")
  ? configuredOrigin
  : `https://${configuredOrigin}`;

const mobileAppUrl = new URL(normalizedOrigin);
const mobileConfig = `window.GymOSMobileConfig = Object.freeze({
  appOrigin: ${JSON.stringify(mobileAppUrl.origin)},
  appHost: ${JSON.stringify(mobileAppUrl.host)}
});
`;

writeFileSync("mobile-shell/mobile-config.js", mobileConfig, "utf8");

console.log(`Generated GymOS mobile runtime config for ${mobileAppUrl.host}.`);
