import sharp from './node_modules/sharp/lib/index.js';
import { mkdirSync } from 'fs';

const SRC = 'logo-condofy.png.png';
const BLUE = { r: 26, g: 58, b: 92, alpha: 255 }; // #1A3A5C
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function removeWhiteBg(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] > 245 && px[i + 1] > 245 && px[i + 2] > 245) {
      px[i + 3] = 0;
    }
  }
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Remove white bg AND turn dark pixels white — for placing logo on dark background
async function makeWhiteTransparent(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] > 245 && px[i + 1] > 245 && px[i + 2] > 245) {
      px[i + 3] = 0; // white → transparent
    } else {
      px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; // dark → white
    }
  }
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
  mkdirSync('apps/web/public', { recursive: true });
  mkdirSync('apps/mobile-native/assets', { recursive: true });

  const { width: srcW, height: srcH } = await sharp(SRC).metadata();
  console.log(`Source: ${srcW}x${srcH}`);

  // Trim white borders
  const trimBuf = await sharp(SRC).trim({ background: '#FFFFFF', threshold: 15 }).toBuffer();
  const { width: tW, height: tH } = await sharp(trimBuf).metadata();
  console.log(`Trimmed: ${tW}x${tH}`);

  // Crop building icon: left ~22% of trimmed width (just the building + circuit arm)
  const iconW = Math.round(tW * 0.22);
  const iconBuf = await sharp(trimBuf)
    .extract({ left: 0, top: 0, width: iconW, height: tH })
    .toBuffer();

  // --- WEB ---

  // 1. logo.png (transparent, fits 400x120)
  const logoAlpha = await removeWhiteBg(trimBuf);
  await sharp(logoAlpha)
    .resize(400, 120, { fit: 'inside', background: TRANSPARENT })
    .png()
    .toFile('apps/web/public/logo.png');
  console.log('✓  apps/web/public/logo.png');

  // 2. favicon.png (32x32, building icon only, transparent)
  const iconAlpha = await removeWhiteBg(iconBuf);
  await sharp(iconAlpha)
    .resize(32, 32, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toFile('apps/web/public/favicon.png');
  console.log('✓  apps/web/public/favicon.png');

  // --- MOBILE ---

  // White version of icon for placement on dark blue background
  const iconWhite = await makeWhiteTransparent(iconBuf);
  const iconMobile = await sharp(iconWhite)
    .resize(620, 620, { fit: 'contain', background: TRANSPARENT })
    .toBuffer();

  for (const dest of [
    'apps/mobile-native/assets/icon.png',
    'apps/mobile-native/assets/adaptive-icon.png'
  ]) {
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BLUE } })
      .composite([{ input: iconMobile, gravity: 'centre' }])
      .png()
      .toFile(dest);
    console.log(`✓  ${dest}`);
  }

  // splash.png (1284x2778, full white logo on blue, fits within 960px wide)
  const logoWhite = await makeWhiteTransparent(trimBuf);
  const splashLogo = await sharp(logoWhite)
    .resize(960, 300, { fit: 'inside', background: TRANSPARENT })
    .toBuffer();

  await sharp({ create: { width: 1284, height: 2778, channels: 4, background: BLUE } })
    .composite([{ input: splashLogo, gravity: 'centre' }])
    .png()
    .toFile('apps/mobile-native/assets/splash.png');
  console.log('✓  apps/mobile-native/assets/splash.png');

  console.log('\nTodos os assets gerados com sucesso!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
