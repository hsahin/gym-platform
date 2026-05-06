import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function rootFile(filePath: string) {
  return readFileSync(path.join(process.cwd(), filePath), "utf8");
}

function rootJson<T>(filePath: string): T {
  return JSON.parse(rootFile(filePath)) as T;
}

const legacyLiveDomain = "gym-platform-vc9yk.ondigitalocean.app";

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
    expect(shell).not.toContain("next-training.ics");
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

  it("drives pass, agenda, wallet and push features from member backend data", () => {
    const shell = rootFile("mobile-shell/index.html");

    expect(shell).not.toContain("GYMOS-HOMEGYM");
    expect(shell).not.toContain("Vandaag 18:00 · Strength & Conditioning · Homegym");
    expect(shell).not.toContain('"LOCATION:Homegym"');
    expect(shell).not.toContain("assets/next-training.ics");
    expect(shell).toContain("async function fetchMemberAppSnapshot");
    expect(shell).toContain("memberAppSnapshotEndpoint");
    expect(shell).toContain("/api/member/mobile-self-service");
    expect(shell).toContain("checkInPass.qrDataUrl");
    expect(shell).toContain("data-checkin-qr");
    expect(shell).toContain("data-checkin-code");
    expect(shell).toContain("memberAppSnapshot.nextTraining");
    expect(shell).toContain("walletPassUrl");
    expect(shell).toContain("async function syncPushTokenWithBackend");
    expect(shell).toContain('operation: "register_push_token"');
    expect(shell).toContain("buildApiMutationHeaders");
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
    expect(shell).toContain("async function verifyPaymentReturnWithBackend");
    expect(shell).toContain("function extractPaymentReturnContext");
    expect(shell).toContain("paymentReturnEndpoint");
    expect(shell).toContain("paymentReturnVerification");
    expect(shell).toContain("paymentReturn");
    expect(shell).toContain("invoiceId");
    expect(shell).toContain("tenantSlug");
    expect(shell).toContain("await verifyPaymentReturnWithBackend(url");
    expect(shell).toContain("await verifyPaymentReturnWithBackend(memoryState.pendingPaymentUrl");
    expect(shell).toContain("Betaling bevestigd");
    expect(shell).toContain("Betaling kon niet worden geopend");
    expect(shell).not.toContain(
      "Betaling onderbroken of bankapp gesloten. Open de ledenomgeving om de status te controleren.",
    );
    expect(shell).not.toContain(
      "Betaalvenster gesloten. Controleer in je ledenomgeving of de betaling is gelukt.",
    );
  });

  it("hardens native privacy and backup defaults for member data", () => {
    const config = rootFile("capacitor.config.ts");
    const packageJson = rootJson<{
      scripts: Record<string, string>;
    }>("package.json");
    const manifest = rootFile("android/app/src/main/AndroidManifest.xml");
    const backupRules = rootFile("android/app/src/main/res/xml/backup_rules.xml");
    const dataExtractionRules = rootFile("android/app/src/main/res/xml/data_extraction_rules.xml");
    const cordovaHardeningScript = rootFile("scripts/harden-mobile-privacy.mjs");
    const iosPrivacyManifest = rootFile("ios/App/App/PrivacyInfo.xcprivacy");
    const iosProject = rootFile("ios/App/App.xcodeproj/project.pbxproj");

    expect(config).toContain('loggingBehavior: "production"');
    expect(config).not.toContain('loggingBehavior: "debug"');
    expect(packageJson.scripts["mobile:sync"]).toContain("mobile:privacy");
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(backupRules).toContain('<exclude domain="sharedpref" path="."');
    expect(backupRules).toContain('<exclude domain="database" path="."');
    expect(dataExtractionRules).toContain("<cloud-backup");
    expect(dataExtractionRules).toContain("<device-transfer>");
    expect(cordovaHardeningScript).not.toContain('<access origin="*"');
    expect(cordovaHardeningScript).toContain("GYMOS_MOBILE_APP_ORIGIN");
    expect(cordovaHardeningScript).toContain("NEXT_PUBLIC_APP_URL");
    expect(cordovaHardeningScript).toContain("APP_BASE_URL");
    expect(cordovaHardeningScript).not.toContain(legacyLiveDomain);
    expect(cordovaHardeningScript).toContain("android/app/src/main/res/xml/config.xml");
    expect(cordovaHardeningScript).toContain("ios/App/App/config.xml");
    expect(iosPrivacyManifest).toContain("NSPrivacyTracking");
    expect(iosPrivacyManifest).toContain("NSPrivacyCollectedDataTypes");
    expect(iosPrivacyManifest).toContain("NSPrivacyAccessedAPICategoryUserDefaults");
    expect(iosPrivacyManifest).toContain("NSPrivacyAccessedAPICategoryFileTimestamp");
    expect(iosProject).toContain("PrivacyInfo.xcprivacy in Resources");
  });

  it("configures Android permissions and app links for member actions", () => {
    const manifest = rootFile("android/app/src/main/AndroidManifest.xml");
    const buildGradle = rootFile("android/app/build.gradle");

    expect(manifest).toContain("android.permission.POST_NOTIFICATIONS");
    expect(manifest).toContain('android:scheme="gymos"');
    expect(manifest).toContain('android:host="member"');
    expect(manifest).toContain('android:autoVerify="true"');
    expect(manifest).toContain('android:host="${gymosWebHost}"');
    expect(manifest).toContain('android:scheme="${gymosWebScheme}"');
    expect(manifest).toContain('android:pathPrefix="/reserve"');
    expect(manifest).toContain('android:pathPrefix="/join"');
    expect(manifest).toContain('android:pathPrefix="/login"');
    expect(buildGradle).toContain("manifestPlaceholders");
    expect(buildGradle).toContain("gymosWebHost");
    expect(buildGradle).toContain("GYMOS_MOBILE_APP_ORIGIN");
  });

  it("configures iOS URL schemes, universal links, biometrics and push entitlements", () => {
    const plist = rootFile("ios/App/App/Info.plist");
    const entitlements = rootFile("ios/App/App/App.entitlements");
    const project = rootFile("ios/App/App.xcodeproj/project.pbxproj");

    expect(plist).toContain("NSFaceIDUsageDescription");
    expect(plist).toContain("CFBundleURLSchemes");
    expect(plist).toContain("<string>gymos</string>");
    expect(entitlements).toContain("applinks:$(GYMOS_ASSOCIATED_DOMAIN)");
    expect(entitlements).toContain("aps-environment");
    expect(project).toContain("CODE_SIGN_ENTITLEMENTS = App/App.entitlements");
    expect(project).toContain("GYMOS_ASSOCIATED_DOMAIN = gymos.example;");
  });

  it("uses release-ready native build settings", () => {
    const entitlements = rootFile("ios/App/App/App.entitlements");
    const iosProject = rootFile("ios/App/App.xcodeproj/project.pbxproj");
    const buildGradle = rootFile("android/app/build.gradle");

    expect(entitlements).toContain("<string>production</string>");
    expect(entitlements).not.toContain("<string>development</string>");
    expect(iosProject).toContain("GYMOS_IOS_BUILD_NUMBER");
    expect(iosProject).toContain("GYMOS_IOS_VERSION");
    expect(iosProject).toContain('CURRENT_PROJECT_VERSION = "$(GYMOS_IOS_BUILD_NUMBER)";');
    expect(iosProject).toContain('MARKETING_VERSION = "$(GYMOS_IOS_VERSION)";');
    expect(iosProject).not.toContain("CURRENT_PROJECT_VERSION = 1;");
    expect(iosProject).not.toContain("MARKETING_VERSION = 1.0;");
    expect(buildGradle).toContain("GYMOS_ANDROID_VERSION_CODE");
    expect(buildGradle).toContain("GYMOS_ANDROID_VERSION_NAME");
    expect(buildGradle).not.toContain("versionCode 1");
    expect(buildGradle).not.toContain('versionName "1.0"');
    expect(buildGradle).toContain("minifyEnabled true");
    expect(buildGradle).toContain("shrinkResources true");
  });

  it("keeps mobile web domains environment-driven instead of hardcoded to one live host", () => {
    const domainSensitiveFiles = [
      "capacitor.config.ts",
      "android/app/src/main/AndroidManifest.xml",
      "android/app/build.gradle",
      "ios/App/App/App.entitlements",
      "ios/App/App.xcodeproj/project.pbxproj",
      "scripts/harden-mobile-privacy.mjs",
      "mobile-shell/index.html",
      "mobile-shell/mobile-config.js",
      "android/app/src/androidTest/java/nl/gymos/members/MemberAppNativeFlowInstrumentedTest.java",
    ];

    for (const filePath of domainSensitiveFiles) {
      expect(rootFile(filePath), filePath).not.toContain(legacyLiveDomain);
    }

    const capacitorConfig = rootFile("capacitor.config.ts");
    const mobileShell = rootFile("mobile-shell/index.html");
    const packageJson = rootJson<{
      scripts: Record<string, string>;
    }>("package.json");

    expect(capacitorConfig).toContain("GYMOS_MOBILE_APP_ORIGIN");
    expect(capacitorConfig).toContain("NEXT_PUBLIC_APP_URL");
    expect(capacitorConfig).toContain("APP_BASE_URL");
    expect(capacitorConfig).toContain("mobileAppUrl.host");
    expect(mobileShell).toContain("mobile-config.js");
    expect(mobileShell).toContain("window.GymOSMobileConfig");
    expect(mobileShell).toContain("new URL(configuredPortalOrigin).origin");
    expect(packageJson.scripts["mobile:sync"]).toContain("mobile:config");
  });

  it("serves association files needed by universal links and Android app links", () => {
    const apple = rootFile("src/app/.well-known/apple-app-site-association/route.ts");
    const android = rootFile("src/app/.well-known/assetlinks.json/route.ts");

    expect(apple).toContain("applinks");
    expect(apple).toContain("nl.gymos.members");
    expect(apple).toContain("APPLE_TEAM_ID");
    expect(apple).toContain("status: 503");
    expect(apple).not.toContain("TEAMID");
    expect(android).toContain("delegate_permission/common.handle_all_urls");
    expect(android).toContain("nl.gymos.members");
    expect(android).toContain("ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS");
    expect(android).toContain("status: 503");
    expect(android).not.toContain("REPLACE_WITH");
  });
});
