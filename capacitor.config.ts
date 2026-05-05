import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "nl.gymos.members",
  appName: "GymOS Leden",
  webDir: "mobile-shell",
  backgroundColor: "#111820",
  loggingBehavior: "production",
  server: {
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
