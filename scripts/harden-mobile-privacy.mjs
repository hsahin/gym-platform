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

const cordovaConfig = `<?xml version='1.0' encoding='utf-8'?>
<widget version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
  <access origin="${mobileAppUrl.origin}" />
  <allow-navigation href="${mobileAppUrl.origin}/*" />
</widget>
`;

for (const filePath of [
  "android/app/src/main/res/xml/config.xml",
  "ios/App/App/config.xml",
]) {
  writeFileSync(filePath, cordovaConfig, "utf8");
}

console.log(`Hardened mobile Cordova access origins for ${mobileAppUrl.host}.`);
