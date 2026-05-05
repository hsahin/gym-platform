import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "nl.gymos.members",
  appName: "GymOS Leden",
  webDir: "mobile-shell",
  backgroundColor: "#111820",
  loggingBehavior: "production",
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "splash_icon",
      iconColor: "#5EEAD4",
    },
    App: {
      disableBackButtonHandler: false,
    },
  },
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
