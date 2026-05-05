import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

function rootPath(filePath: string) {
  return path.join(process.cwd(), filePath);
}

function readRootFile(filePath: string) {
  return readFileSync(rootPath(filePath), "utf8");
}

function readPngSize(filePath: string) {
  const buffer = readFileSync(rootPath(filePath));

  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function readAverageRgb(filePath: string) {
  const stats = await sharp(rootPath(filePath)).stats();

  return stats.channels.slice(0, 3).map((channel) => Math.round(channel.mean));
}

async function readPngMetadata(filePath: string) {
  return sharp(rootPath(filePath)).metadata();
}

describe("native mobile branding assets", () => {
  it("uses GymOS branded launcher artwork instead of the default Capacitor icon", async () => {
    const androidBackground = readRootFile(
      "android/app/src/main/res/values/ic_launcher_background.xml",
    );
    const androidForeground = readRootFile(
      "android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml",
    );
    const iosIconSize = readPngSize(
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    );
    const [red, green, blue] = await readAverageRgb(
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    );
    const iosIconMetadata = await readPngMetadata(
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    );

    expect(androidBackground).toContain("#111820");
    expect(androidForeground).toContain("GymOS member app icon foreground");
    expect(androidForeground).toContain("#5EEAD4");
    expect(iosIconSize).toEqual({ width: 1024, height: 1024 });
    expect(iosIconMetadata.hasAlpha).toBe(false);
    expect(red).toBeLessThan(90);
    expect(green).toBeLessThan(120);
    expect(blue).toBeLessThan(130);
  });

  it("ships branded splash screens and Android 12 splash theme values", async () => {
    const styles = readRootFile("android/app/src/main/res/values/styles.xml");
    const androidSplashSize = readPngSize("android/app/src/main/res/drawable/splash.png");
    const iosSplashSize = readPngSize(
      "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
    );
    const [red, green, blue] = await readAverageRgb(
      "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
    );

    expect(styles).toContain("windowSplashScreenAnimatedIcon");
    expect(styles).toContain("@drawable/splash_icon");
    expect(styles).toContain("@color/gymos_splash_background");
    expect(androidSplashSize).toEqual({ width: 480, height: 320 });
    expect(iosSplashSize).toEqual({ width: 2732, height: 2732 });
    expect(red).toBeLessThan(50);
    expect(green).toBeLessThan(75);
    expect(blue).toBeLessThan(85);
  });
});
