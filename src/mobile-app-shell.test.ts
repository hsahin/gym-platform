import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRootFile(filePath: string) {
  return readFileSync(path.join(process.cwd(), filePath), "utf8");
}

describe("native member app shell", () => {
  it("ships a local Capacitor app instead of opening the production website as server.url", () => {
    const source = readRootFile("capacitor.config.ts");

    expect(source).not.toContain("CAPACITOR_SERVER_URL");
    expect(source).not.toContain("gym-platform-vc9yk.ondigitalocean.app");
    expect(source).not.toMatch(/\bserver\s*:\s*\{[\s\S]*\burl\s*:/);
    expect(source).toContain('webDir: "mobile-shell"');
    expect(source).toContain('loggingBehavior: "production"');
    expect(source).toContain("GYMOS_MOBILE_APP_ORIGIN");
  });

  it("keeps the packaged mobile shell as an app-like member experience, not a single website link", () => {
    const source = readRootFile("mobile-shell/index.html");

    expect(source).toContain('data-screen="today"');
    expect(source).toContain('data-screen="classes"');
    expect(source).toContain('data-screen="pass"');
    expect(source).toContain('data-screen="service"');
    expect(source).toContain('data-screen="account"');
    expect(source).toContain("Volgende training");
    expect(source).toContain("Mijn planning");
    expect(source).toContain("Ledenservice");
    expect(source).toContain("Open ledenapp");
    expect(source).toContain("Account verwijderen");
    expect(source).toContain('data-qa-flow="login"');
    expect(source).toContain('data-qa-flow="reserve"');
    expect(source).toContain('data-qa-flow="cancel-reservation"');
    expect(source).toContain('data-qa-flow="payments"');
    expect(source).toContain('data-qa-flow="pause-request"');
    expect(source).toContain('data-qa-flow="account-delete"');
    expect(source).toContain('data-native-action="open-member-session"');
    expect(source).toContain('data-native-action="manage-reservations"');
    expect(source).toContain('data-native-action="open-roster"');
    expect(source).toContain('data-native-action="service-request"');
    expect(source).toContain('data-native-action="payment-center"');
    expect(source).toContain('data-native-action="native-login"');
    expect(source).toContain('data-native-action="delete-account"');
    expect(source).toContain('data-native-panel="reservation-manager"');
    expect(source).toContain('data-native-panel="service-request"');
    expect(source).toContain('data-native-panel="payment-center"');
    expect(source).toContain('data-native-panel="native-login"');
    expect(source).toContain('data-native-panel="account-delete"');
    expect(source).toContain("function runNativeMemberAction");
    expect(source).toContain("window.GymOSNativeActions");
    expect(source).not.toContain("data-open-portal=");
    expect(source).not.toContain("async function openPortal");
    expect(source).toContain("Je login direct uitzetten");
    expect(source).toContain("navigator.onLine");
    expect(source).toContain("SecureStorage");
    expect(source).toContain("Preferences");
    expect(source).toContain("window.GymOSNativePayments");
    expect(source).toContain("mobile-config.js");
    expect(source).toContain("window.GymOSMobileConfig");
    expect(source).toContain("new URL(configuredPortalOrigin).origin");
    expect(source).not.toContain("gym-platform-vc9yk.ondigitalocean.app");
    expect(source).toContain("handleAppResume");
    expect(source).toContain("verifyPaymentReturnWithBackend");
    expect(source).toContain("paymentReturnVerification");
    expect(source).toContain("Betaling wordt veilig gecontroleerd");
    expect(source).not.toContain("Betaling onderbroken of bankapp gesloten");
    expect(source).not.toContain(">Open ledenapp<");
  });

  it("keeps QA hooks out of the production mobile shell bundle", () => {
    const shellPaths = [
      "mobile-shell/index.html",
      "android/app/src/main/assets/public/index.html",
      "ios/App/App/public/index.html",
    ].filter((filePath) => existsSync(path.join(process.cwd(), filePath)));

    expect(shellPaths).toContain("mobile-shell/index.html");

    for (const shellPath of shellPaths) {
      const source = readRootFile(shellPath);

      expect(source, shellPath).not.toContain("GymOSNativeTestHooks");
      expect(source, shellPath).not.toContain("nativeQa");
      expect(source, shellPath).not.toContain("simulateNetworkForQa");
      expect(source, shellPath).not.toContain("qaNetworkStatus");
    }
  });
});
