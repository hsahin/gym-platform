import type { CapacitorConfig } from "@capacitor/cli";

const memberPortalUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  "https://gym-platform-vc9yk.ondigitalocean.app/reserve";

const config: CapacitorConfig = {
  appId: "nl.gymos.members",
  appName: "GymOS Leden",
  webDir: "mobile-shell",
  backgroundColor: "#111820",
  loggingBehavior: "debug",
  server: {
    url: memberPortalUrl,
    cleartext: false,
    allowNavigation: [
      "gym-platform-vc9yk.ondigitalocean.app",
      "*.mollie.com",
      "pay.mollie.com",
      "www.mollie.com",
    ],
  },
};

export default config;
