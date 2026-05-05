import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const brand = {
  ink: "#111820",
  ink2: "#18232c",
  ink3: "#20313b",
  teal: "#5EEAD4",
  tealDeep: "#14B8A6",
  sky: "#38BDF8",
  cream: "#F8FAFC",
  gold: "#FBBF24",
};

const androidLauncherSizes = [
  ["mipmap-mdpi", 48, 108],
  ["mipmap-hdpi", 72, 162],
  ["mipmap-xhdpi", 96, 216],
  ["mipmap-xxhdpi", 144, 324],
  ["mipmap-xxxhdpi", 192, 432],
];

const androidSplashSizes = [
  ["drawable", "splash.png", 480, 320],
  ["drawable-port-mdpi", "splash.png", 320, 480],
  ["drawable-port-hdpi", "splash.png", 480, 800],
  ["drawable-port-xhdpi", "splash.png", 720, 1280],
  ["drawable-port-xxhdpi", "splash.png", 960, 1600],
  ["drawable-port-xxxhdpi", "splash.png", 1280, 1920],
  ["drawable-land-mdpi", "splash.png", 480, 320],
  ["drawable-land-hdpi", "splash.png", 800, 480],
  ["drawable-land-xhdpi", "splash.png", 1280, 720],
  ["drawable-land-xxhdpi", "splash.png", 1600, 960],
  ["drawable-land-xxxhdpi", "splash.png", 1920, 1280],
];

function resolveRoot(filePath) {
  return path.join(root, filePath);
}

async function ensureDir(filePath) {
  await mkdir(path.dirname(resolveRoot(filePath)), { recursive: true });
}

async function writeText(filePath, content) {
  await ensureDir(filePath);
  await writeFile(resolveRoot(filePath), content);
}

async function renderPng(filePath, svg, width, height, options = {}) {
  await ensureDir(filePath);
  let pipeline = sharp(Buffer.from(svg)).resize(width, height);

  if (options.flatten) {
    pipeline = pipeline.flatten({ background: brand.ink });
  }

  await pipeline
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: 10,
    })
    .toFile(resolveRoot(filePath));
}

function brandDefs() {
  return `
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${brand.ink3}"/>
        <stop offset="0.58" stop-color="${brand.ink}"/>
        <stop offset="1" stop-color="#090F14"/>
      </linearGradient>
      <linearGradient id="mark" x1="0.2" x2="0.9" y1="0.1" y2="0.95">
        <stop offset="0" stop-color="${brand.sky}"/>
        <stop offset="0.55" stop-color="${brand.teal}"/>
        <stop offset="1" stop-color="${brand.tealDeep}"/>
      </linearGradient>
      <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="28" stdDeviation="34" flood-color="#000000" flood-opacity="0.34"/>
      </filter>
    </defs>`;
}

function gymosMark({
  centerX,
  centerY,
  radius,
  strokeWidth,
  showBase = true,
  showNode = true,
}) {
  const barStart = centerX + radius * 0.08;
  const barEnd = centerX + radius * 0.78;
  const barY = centerY;
  const dotRadius = strokeWidth * 0.28;

  return `
    ${showBase
      ? `<rect x="${centerX - radius * 1.2}" y="${centerY - radius * 1.2}" width="${radius * 2.4}" height="${radius * 2.4}" rx="${radius * 0.54}" fill="#FFFFFF" opacity="0.055" stroke="#FFFFFF" stroke-opacity="0.13" stroke-width="${Math.max(2, strokeWidth * 0.05)}"/>`
      : ""}
    <g filter="url(#softShadow)">
      <path d="M ${centerX + radius * 0.72} ${centerY - radius * 0.66}
               A ${radius} ${radius} 0 1 0 ${centerX + radius * 0.72} ${centerY + radius * 0.66}"
            fill="none"
            stroke="url(#mark)"
            stroke-width="${strokeWidth}"
            stroke-linecap="round"/>
      <path d="M ${barStart} ${barY} H ${barEnd}"
            fill="none"
            stroke="${brand.cream}"
            stroke-width="${strokeWidth * 0.9}"
            stroke-linecap="round"/>
      ${showNode
        ? `<circle cx="${barEnd}" cy="${barY}" r="${dotRadius}" fill="${brand.gold}"/>`
        : ""}
    </g>`;
}

function appIconSvg(size = 1024, { round = false, foregroundOnly = false } = {}) {
  const clipId = round ? "roundClip" : "squircleClip";
  const clip = `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>`;

  if (foregroundOnly) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${brandDefs()}
      ${gymosMark({
        centerX: size / 2,
        centerY: size / 2,
        radius: size * 0.245,
        strokeWidth: size * 0.09,
        showBase: false,
      })}
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${brandDefs()}
    ${round ? `<clipPath id="${clipId}">${clip}</clipPath>` : ""}
    <g${round ? ` clip-path="url(#${clipId})"` : ""}>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <path d="M ${size * -0.1} ${size * 0.18} C ${size * 0.18} ${size * 0.06}, ${size * 0.42} ${size * 0.02}, ${size * 1.08} ${size * -0.03}" fill="none" stroke="${brand.teal}" stroke-opacity="0.24" stroke-width="${size * 0.018}"/>
      <path d="M ${size * -0.12} ${size * 0.78} C ${size * 0.26} ${size * 0.68}, ${size * 0.58} ${size * 0.78}, ${size * 1.1} ${size * 0.55}" fill="none" stroke="${brand.sky}" stroke-opacity="0.18" stroke-width="${size * 0.012}"/>
      <path d="M ${size * 0.74} ${size * 0.12} L ${size * 1.1} ${size * 0.28} L ${size * 1.1} ${size * 0.92} L ${size * 0.58} ${size * 0.72} Z" fill="#FFFFFF" opacity="0.045"/>
      ${gymosMark({
        centerX: size / 2,
        centerY: size / 2,
        radius: size * 0.255,
        strokeWidth: size * 0.095,
      })}
    </g>
  </svg>`;
}

function splashSvg(width, height) {
  const min = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2 - min * 0.06;
  const radius = min * 0.115;
  const logoBox = radius * 2.75;
  const titleSize = Math.max(26, min * 0.052);
  const subtitleSize = Math.max(14, min * 0.022);
  const titleY = centerY + logoBox * 0.84;
  const subtitleY = titleY + titleSize * 0.92;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${brandDefs()}
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <path d="M ${-width * 0.08} ${height * 0.18} C ${width * 0.24} ${height * 0.04}, ${width * 0.54} ${height * 0.08}, ${width * 1.08} ${height * -0.02}" fill="none" stroke="${brand.teal}" stroke-opacity="0.22" stroke-width="${Math.max(5, min * 0.01)}"/>
    <path d="M ${-width * 0.12} ${height * 0.78} C ${width * 0.22} ${height * 0.68}, ${width * 0.58} ${height * 0.74}, ${width * 1.12} ${height * 0.56}" fill="none" stroke="${brand.sky}" stroke-opacity="0.14" stroke-width="${Math.max(4, min * 0.007)}"/>
    <path d="M ${width * 0.68} ${height * 0.09} L ${width * 1.06} ${height * 0.2} L ${width * 1.06} ${height * 0.86} L ${width * 0.56} ${height * 0.7} Z" fill="#FFFFFF" opacity="0.035"/>
    <rect x="${centerX - logoBox / 2}" y="${centerY - logoBox / 2}" width="${logoBox}" height="${logoBox}" rx="${logoBox * 0.28}" fill="#FFFFFF" opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="${Math.max(1, min * 0.002)}"/>
    ${gymosMark({
      centerX,
      centerY,
      radius,
      strokeWidth: radius * 0.38,
      showBase: false,
    })}
    <text x="${centerX}" y="${titleY}" text-anchor="middle" fill="${brand.cream}" font-family="Inter, Arial, sans-serif" font-size="${titleSize}" font-weight="760" letter-spacing="0">GymOS Leden</text>
    <text x="${centerX}" y="${subtitleY}" text-anchor="middle" fill="#AEC2CB" font-family="Inter, Arial, sans-serif" font-size="${subtitleSize}" font-weight="560" letter-spacing="0">Boek. Train. Groei.</text>
  </svg>`;
}

function androidForegroundVectorXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- GymOS member app icon foreground. Regenerate with npm run mobile:assets. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#00000000"
        android:pathData="M76,36 C65,24 44,23 32,34 C18,47 18,69 32,82 C46,96 70,92 80,76"
        android:strokeColor="${brand.teal}"
        android:strokeLineCap="round"
        android:strokeWidth="9" />
    <path
        android:fillColor="#00000000"
        android:pathData="M56,54 L79,54"
        android:strokeColor="${brand.cream}"
        android:strokeLineCap="round"
        android:strokeWidth="8" />
    <path
        android:fillColor="${brand.gold}"
        android:pathData="M80,49 a5,5 0,1 0 0.1,0 z" />
</vector>
`;
}

function androidSplashIconXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- GymOS member app splash icon. Regenerate with npm run mobile:assets. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#21313A"
        android:pathData="M20,18 h68 a16,16 0,0 1 16,16 v40 a16,16 0,0 1 -16,16 h-68 a16,16 0,0 1 -16,-16 v-40 a16,16 0,0 1 16,-16 z" />
    <path
        android:fillColor="#00000000"
        android:pathData="M75,36 C64,24 44,24 32,34 C18,47 18,69 32,82 C46,96 70,92 80,76"
        android:strokeColor="${brand.teal}"
        android:strokeLineCap="round"
        android:strokeWidth="8" />
    <path
        android:fillColor="#00000000"
        android:pathData="M56,54 L78,54"
        android:strokeColor="${brand.cream}"
        android:strokeLineCap="round"
        android:strokeWidth="7" />
    <path
        android:fillColor="${brand.gold}"
        android:pathData="M79,50 a4,4 0,1 0 0.1,0 z" />
</vector>
`;
}

function androidColorsXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${brand.tealDeep}</color>
    <color name="colorPrimaryDark">${brand.ink}</color>
    <color name="colorAccent">${brand.gold}</color>
    <color name="gymos_splash_background">${brand.ink}</color>
    <color name="gymos_splash_icon_background">${brand.ink2}</color>
</resources>
`;
}

function launcherBackgroundXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${brand.ink}</color>
</resources>
`;
}

function drawableLauncherBackgroundXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="${brand.ink}"
        android:pathData="M0,0h108v108h-108z" />
    <path
        android:fillColor="#18232C"
        android:fillAlpha="0.72"
        android:pathData="M72,8 L112,24 L112,100 L56,76 Z" />
    <path
        android:fillColor="#00000000"
        android:pathData="M-10,23 C24,8 55,9 118,-4"
        android:strokeColor="${brand.teal}"
        android:strokeAlpha="0.25"
        android:strokeWidth="2" />
</vector>
`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>

    <!-- Base application theme. -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/gymos_splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="windowSplashScreenIconBackgroundColor">@color/gymos_splash_icon_background</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:windowBackground">@drawable/splash</item>
        <item name="android:background">@drawable/splash</item>
    </style>
</resources>
`;
}

async function writeAndroidAssets() {
  await writeText(
    "android/app/src/main/res/values/ic_launcher_background.xml",
    launcherBackgroundXml(),
  );
  await writeText(
    "android/app/src/main/res/drawable/ic_launcher_background.xml",
    drawableLauncherBackgroundXml(),
  );
  await writeText(
    "android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml",
    androidForegroundVectorXml(),
  );
  await writeText("android/app/src/main/res/drawable/splash_icon.xml", androidSplashIconXml());
  await writeText("android/app/src/main/res/values/colors.xml", androidColorsXml());
  await writeText("android/app/src/main/res/values/styles.xml", stylesXml());

  for (const [directory, iconSize, foregroundSize] of androidLauncherSizes) {
    await renderPng(
      `android/app/src/main/res/${directory}/ic_launcher.png`,
      appIconSvg(iconSize),
      iconSize,
      iconSize,
      { flatten: true },
    );
    await renderPng(
      `android/app/src/main/res/${directory}/ic_launcher_round.png`,
      appIconSvg(iconSize, { round: true }),
      iconSize,
      iconSize,
    );
    await renderPng(
      `android/app/src/main/res/${directory}/ic_launcher_foreground.png`,
      appIconSvg(foregroundSize, { foregroundOnly: true }),
      foregroundSize,
      foregroundSize,
    );
  }

  for (const [directory, filename, width, height] of androidSplashSizes) {
    await renderPng(
      `android/app/src/main/res/${directory}/${filename}`,
      splashSvg(width, height),
      width,
      height,
    );
  }
}

async function writeIosAssets() {
  await renderPng(
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    appIconSvg(1024),
    1024,
    1024,
    { flatten: true },
  );

  for (const filename of [
    "splash-2732x2732.png",
    "splash-2732x2732-1.png",
    "splash-2732x2732-2.png",
  ]) {
    await renderPng(
      `ios/App/App/Assets.xcassets/Splash.imageset/${filename}`,
      splashSvg(2732, 2732),
      2732,
      2732,
    );
  }
}

await writeAndroidAssets();
await writeIosAssets();

console.log("Generated GymOS mobile icon and splash assets.");
