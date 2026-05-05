import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function rootFile(filePath: string) {
  return readFileSync(path.join(process.cwd(), filePath), "utf8");
}

function rootJson<T>(filePath: string): T {
  return JSON.parse(rootFile(filePath)) as T;
}

describe("native member app capabilities", () => {
  it("declares native Capacitor plugins for member app features", () => {
    const packageJson = rootJson<{
      dependencies: Record<string, string>;
    }>("package.json");
    const dependencies = packageJson.dependencies;
    const config = rootFile("capacitor.config.ts");

    expect(dependencies["@capacitor/push-notifications"]).toBeTruthy();
    expect(dependencies["@capacitor/local-notifications"]).toBeTruthy();
    expect(dependencies["@capacitor/app"]).toBeTruthy();
    expect(dependencies["@capacitor/browser"]).toBeTruthy();
    expect(dependencies["@capacitor/filesystem"]).toBeTruthy();
    expect(dependencies["@capacitor/preferences"]).toBeTruthy();
    expect(dependencies["@capacitor/share"]).toBeTruthy();
    expect(dependencies["@capacitor/haptics"]).toBeTruthy();
    expect(dependencies["@aparajita/capacitor-secure-storage"]).toBeTruthy();
    expect(dependencies["@aparajita/capacitor-biometric-auth"]).toBeTruthy();
    expect(config).toContain("PushNotifications");
    expect(config).toContain("LocalNotifications");
    expect(config).toContain("presentationOptions");
  });

  it("keeps native feature entry points visible in the packaged member shell", () => {
    const shell = rootFile("mobile-shell/index.html");

    for (const copy of [
      "Pushmeldingen",
      "Check-in pas",
      "Walletpas",
      "Agenda toevoegen",
      "Biometrisch inloggen",
      "Veilige opslag",
      "Offline klaar",
      "Deep link actief",
    ]) {
      expect(shell).toContain(copy);
    }

    for (const plugin of [
      "PushNotifications",
      "LocalNotifications",
      "SecureStorage",
      "BiometricAuthNative",
      "Filesystem",
      "Preferences",
      "Share",
      "Haptics",
      "App",
      "Browser",
    ]) {
      expect(shell).toContain(plugin);
    }

    expect(shell).toContain("checkin-qr.svg");
    expect(shell).toContain("next-training.ics");
    expect(shell).not.toContain("localStorage.setItem");
  });

  it("uses native-safe storage and a generated calendar file for member reminders", () => {
    const shell = rootFile("mobile-shell/index.html");

    expect(shell).toContain("await SecureStorage.set(secureSessionKey, payload)");
    expect(shell).not.toContain("SecureStorage.set(secureSessionKey, {");
    expect(shell).toContain("function buildCalendarEvent");
    expect(shell).toContain("Filesystem.writeFile");
    expect(shell).toContain("Share.share");
    expect(shell).toContain("files: [writeResult.uri]");
  });

  it("keeps Mollie payments out of the WebView and handles native payment returns", () => {
    const config = rootFile("capacitor.config.ts");
    const shell = rootFile("mobile-shell/index.html");

    expect(config).not.toContain("mollie.com");
    expect(shell).toContain("function isMolliePaymentUrl");
    expect(shell).toContain("async function openPaymentCheckout");
    expect(shell).toContain("Browser.open({ url, presentationStyle: \"fullscreen\" })");
    expect(shell).toContain("browserFinished");
    expect(shell).toContain("payment-return");
    expect(shell).toContain("Betaling veilig geopend");
    expect(shell).toContain("Betaling teruggekeerd");
    expect(shell).toContain("Betaling kon niet worden geopend");
  });

  it("configures Android permissions and app links for member actions", () => {
    const manifest = rootFile("android/app/src/main/AndroidManifest.xml");

    expect(manifest).toContain("android.permission.POST_NOTIFICATIONS");
    expect(manifest).toContain('android:scheme="gymos"');
    expect(manifest).toContain('android:host="member"');
    expect(manifest).toContain('android:autoVerify="true"');
    expect(manifest).toContain('android:host="gym-platform-vc9yk.ondigitalocean.app"');
    expect(manifest).toContain('android:pathPrefix="/reserve"');
    expect(manifest).toContain('android:pathPrefix="/join"');
    expect(manifest).toContain('android:pathPrefix="/login"');
  });

  it("configures iOS URL schemes, universal links, biometrics and push entitlements", () => {
    const plist = rootFile("ios/App/App/Info.plist");
    const entitlements = rootFile("ios/App/App/App.entitlements");
    const project = rootFile("ios/App/App.xcodeproj/project.pbxproj");

    expect(plist).toContain("NSFaceIDUsageDescription");
    expect(plist).toContain("CFBundleURLSchemes");
    expect(plist).toContain("<string>gymos</string>");
    expect(entitlements).toContain("applinks:gym-platform-vc9yk.ondigitalocean.app");
    expect(entitlements).toContain("aps-environment");
    expect(project).toContain("CODE_SIGN_ENTITLEMENTS = App/App.entitlements");
  });

  it("serves association files needed by universal links and Android app links", () => {
    const apple = rootFile("src/app/.well-known/apple-app-site-association/route.ts");
    const android = rootFile("src/app/.well-known/assetlinks.json/route.ts");

    expect(apple).toContain("applinks");
    expect(apple).toContain("nl.gymos.members");
    expect(android).toContain("delegate_permission/common.handle_all_urls");
    expect(android).toContain("nl.gymos.members");
    expect(android).toContain("ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS");
  });
});
