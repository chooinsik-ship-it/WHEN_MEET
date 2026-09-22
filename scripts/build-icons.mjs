/**
 * 아이콘 생성 (PWA 홈 화면 + 브라우저 탭)
 * 실행: npm run build:icons
 *
 * 원본: public/WHENMEET_logo_new_clean.png (현재 로고)
 * maskable 아이콘은 안드로이드가 원형/사각으로 잘라내므로 여백(safe zone)을 넣어 생성한다.
 * 브라우저 탭용으로 app/icon.png 와 public/favicon.ico 도 같이 만든다.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'public', 'WHENMEET_logo_new_clean.png');
const OUT = join(here, '..', 'public', 'icons');

/** 브랜드 배경색 (투명 배경을 채워 iOS에서 검게 보이지 않도록) */
const BG = { r: 244, g: 246, b: 251, alpha: 1 };

async function main() {
  mkdirSync(OUT, { recursive: true });

  const targets = [
    { name: 'icon-192.png', size: 192, padding: 0 },
    { name: 'icon-512.png', size: 512, padding: 0 },
    { name: 'apple-touch-icon.png', size: 180, padding: 0 },
    // maskable: 가장자리가 잘려도 로고가 살아남도록 20% 여백
    { name: 'icon-maskable-512.png', size: 512, padding: 0.2 },
  ];

  /** 정사각 아이콘 1장 생성 */
  async function render(size, padding) {
    const inner = Math.round(size * (1 - padding * 2));
    const offset = Math.round((size - inner) / 2);

    const resized = await sharp(SRC)
      .resize(inner, inner, { fit: 'contain', background: BG })
      .toBuffer();

    return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: resized, top: offset, left: offset }])
      .png()
      .toBuffer();
  }

  for (const { name, size, padding } of targets) {
    writeFileSync(join(OUT, name), await render(size, padding));
    console.log(`생성: public/icons/${name} (${size}x${size}${padding ? `, 여백 ${padding * 100}%` : ''})`);
  }

  // --- 브라우저 탭 아이콘 ---
  const appIcon = join(here, '..', 'app', 'icon.png');
  writeFileSync(appIcon, await render(256, 0));
  console.log('생성: app/icon.png (256x256)');

  // ICO 는 PNG 를 그대로 담을 수 있다 (모든 최신 브라우저 지원)
  const icoSizes = [32, 48];
  const images = await Promise.all(icoSizes.map((s) => render(s, 0)));

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);                 // reserved
  header.writeUInt16LE(1, 2);                 // type: icon
  header.writeUInt16LE(images.length, 4);     // count

  let offset = 6 + 16 * images.length;
  const entries = images.map((png, i) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(icoSizes[i] === 256 ? 0 : icoSizes[i], 0); // width
    entry.writeUInt8(icoSizes[i] === 256 ? 0 : icoSizes[i], 1); // height
    entry.writeUInt8(0, 2);                   // 팔레트 없음
    entry.writeUInt8(0, 3);                   // reserved
    entry.writeUInt16LE(1, 4);                // color planes
    entry.writeUInt16LE(32, 6);               // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  writeFileSync(
    join(here, '..', 'public', 'favicon.ico'),
    Buffer.concat([header, ...entries, ...images])
  );
  console.log(`생성: public/favicon.ico (${icoSizes.join(', ')}px)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
