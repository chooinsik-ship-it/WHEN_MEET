/**
 * PWA 아이콘 생성
 * 실행: npm run build:icons
 *
 * public/logo.png (1024x1024) 에서 홈 화면 추가용 아이콘들을 만든다.
 * maskable 아이콘은 안드로이드가 원형/사각으로 잘라내므로 여백(safe zone)을 넣어 생성한다.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'public', 'logo.png');
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

  for (const { name, size, padding } of targets) {
    const inner = Math.round(size * (1 - padding * 2));
    const offset = Math.round((size - inner) / 2);

    const resized = await sharp(SRC)
      .resize(inner, inner, { fit: 'contain', background: BG })
      .toBuffer();

    await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: resized, top: offset, left: offset }])
      .png()
      .toFile(join(OUT, name));

    console.log(`생성: public/icons/${name} (${size}x${size}${padding ? `, 여백 ${padding * 100}%` : ''})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
