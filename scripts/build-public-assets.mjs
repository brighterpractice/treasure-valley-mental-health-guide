import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { transform } from 'esbuild';

const root = process.cwd();
const dist = path.join(root, 'dist');
const assetsDir = path.join(dist, 'assets');

const sourceImage = path.join(assetsDir, 'river-path.webp');
const imageVariants = [
  { name: 'river-path-480w.webp', width: 480, height: 400, quality: 80 },
  { name: 'river-path-800w.webp', width: 800, height: 667, quality: 82 },
  { name: 'river-path-1200w.webp', width: 1200, height: 1000, quality: 84 }
];

const cssSources = [
  path.join(dist, 'styles.css'),
  path.join(dist, 'align-theme.css'),
  path.join(dist, 'warm-theme.css')
];
const cssOutput = path.join(dist, 'site.min.css');

async function ensureFile(file) {
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error();
  } catch {
    throw new Error(`Required build input not found: ${path.relative(root, file)}`);
  }
}

async function buildImages() {
  await ensureFile(sourceImage);
  await mkdir(assetsDir, { recursive: true });

  const metadata = await sharp(sourceImage).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read hero image dimensions.');
  }

  console.log(`Hero source: ${metadata.width}x${metadata.height}`);

  for (const variant of imageVariants) {
    const output = path.join(assetsDir, variant.name);

    await sharp(sourceImage)
      .resize({
        width: variant.width,
        height: variant.height,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true
      })
      .webp({
        quality: variant.quality,
        effort: 5,
        smartSubsample: true
      })
      .toFile(output);

    const info = await stat(output);
    console.log(`Generated ${variant.name} (${Math.round(info.size / 1024)} KB)`);
  }
}

async function buildCss() {
  const parts = [];

  for (const file of cssSources) {
    await ensureFile(file);
    const css = await readFile(file, 'utf8');

    if (/^\s*@import\b/m.test(css)) {
      throw new Error(
        `CSS @import found in ${path.relative(root, file)}. Move imported styles into the bundle before production.`
      );
    }

    parts.push(`/* ${path.basename(file)} */\n${css}`);
  }

  const combined = parts.join('\n\n');
  const result = await transform(combined, {
    loader: 'css',
    minify: true,
    legalComments: 'none',
    target: ['es2020']
  });

  await writeFile(cssOutput, result.code, 'utf8');
  const info = await stat(cssOutput);
  console.log(`Generated site.min.css (${Math.round(info.size / 1024)} KB)`);
}

async function main() {
  await Promise.all([buildImages(), buildCss()]);
  console.log('Public asset build complete.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
