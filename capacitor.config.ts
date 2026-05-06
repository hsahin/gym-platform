import type { CapacitorConfig } from "@capacitor/cli";

const DEFAULT_MOBILE_APP_ORIGIN = "https://gymos.example";

function resolveMobileAppUrl() {
  const configuredOrigin =
    process.env.GYMOS_MOBILE_APP_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_BASE_URL ??
    DEFAULT_MOBILE_APP_ORIGIN;
  const normalizedOrigin = configuredOrigin.includes("://")
    ? configuredOrigin
    : `https://${configuredOrigin}`;

  return new URL(normalizedOrigin);
}

const mobileAppUrl = resolveMobileAppUrl();

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
    allowNavigation: [mobileAppUrl.host],
  },
};

export default config;
