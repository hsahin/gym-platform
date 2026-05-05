import { writeFileSync } from "node:fs";

const cordovaConfig = `<?xml version='1.0' encoding='utf-8'?>
<widget version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
  <access origin="https://gym-platform-vc9yk.ondigitalocean.app" />
  <allow-navigation href="https://gym-platform-vc9yk.ondigitalocean.app/*" />
</widget>
`;

for (const filePath of [
  "android/app/src/main/res/xml/config.xml",
  "ios/App/App/config.xml",
]) {
  writeFileSync(filePath, cordovaConfig, "utf8");
}

console.log("Hardened mobile Cordova access origins.");
