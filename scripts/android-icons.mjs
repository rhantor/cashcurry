// `npm run android:icons` — the staff app's launcher icons and splash screens
// (roadmap 4.6), drawn from the logo in public/icons/icon.svg. Writes into
// android/app/src/main/res; run again whenever the logo changes.
//
// Android 8+ uses the adaptive icon (two vector layers in drawable/, sharp at
// any size); the PNGs are for older phones and the splash.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RES = path.join(ROOT, "android/app/src/main/res");
const DARK = "#0b4d40";
const LIGHT = "#22a082";
const SPLASH_BG = "#f6f8f7"; // the app's light background
const C_PATH = `<path d="M54 26A20 20 0 1 0 54 54" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`;

const logo = fs.readFileSync(path.join(ROOT, "public/icons/icon.svg"));
const round = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><clipPath id="c"><circle cx="40" cy="40" r="40"/></clipPath>` +
    `<g clip-path="url(#c)"><rect width="80" height="80" fill="${DARK}"/><path d="M80 0V80H0Z" fill="${LIGHT}"/></g>${C_PATH}</svg>`
);
// The C alone on a 108-unit canvas, inside the adaptive icon's safe zone
const foreground = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(18 18) scale(0.9)">${C_PATH}</g></svg>`
);

const write = (rel, text) => fs.writeFileSync(path.join(RES, rel), text);
const png = (input, size, rel) => sharp(input, { density: 600 }).resize(size, size).png().toFile(path.join(RES, rel));

// Adaptive icon: background and foreground as vectors
write(
  "drawable/ic_launcher_background.xml",
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="${DARK}" android:pathData="M0,0h108v108h-108z"/>
    <path android:fillColor="${LIGHT}" android:pathData="M108,0L108,108L0,108Z"/>
</vector>
`
);
write(
  "drawable-v24/ic_launcher_foreground.xml",
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <group android:translateX="18" android:translateY="18" android:scaleX="0.9" android:scaleY="0.9">
        <path android:pathData="M54,26A20,20 0,1 0,54,54" android:strokeColor="#FFFFFF"
            android:strokeWidth="9" android:strokeLineCap="round"/>
    </group>
</vector>
`
);
for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  write(
    `mipmap-anydpi-v26/${name}`,
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`
  );
}
write(
  "values/ic_launcher_background.xml",
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${DARK}</color>
</resources>
`
);

// PNGs for phones before Android 8
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITY)) {
  await png(logo, 48 * k, `mipmap-${d}/ic_launcher.png`);
  await png(round, 48 * k, `mipmap-${d}/ic_launcher_round.png`);
  await png(foreground, 108 * k, `mipmap-${d}/ic_launcher_foreground.png`);
}

// Splash: the logo in the middle of the app's light background, every size Capacitor made
const splashes = fs
  .readdirSync(RES)
  .filter((dir) => dir.startsWith("drawable") && fs.existsSync(path.join(RES, dir, "splash.png")))
  .map((dir) => path.join(RES, dir, "splash.png"));
for (const file of splashes) {
  const { width, height } = await sharp(file).metadata();
  const size = Math.round(Math.min(width, height) * 0.28);
  const mark = await sharp(logo, { density: 600 }).resize(size, size).png().toBuffer();
  const out = await sharp({ create: { width, height, channels: 4, background: SPLASH_BG } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
  fs.writeFileSync(file, out);
}
console.log(`Android icons written (${Object.keys(DENSITY).length} densities) and ${splashes.length} splash screens.`);
