import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { productImagesDir } from "../src/lib/uploads";
import { prisma } from "../src/lib/prisma";
import { encodePng, type RGB } from "./lib/simple-png";

// One-off script: generates simple geometric placeholder PNGs (no external
// image libs available) for every visible product with no images yet, and
// writes them to disk the same way the real upload route does, so
// GET /api/uploads/products/<file> serves them identically.

const SIZE = 480;

const CATEGORY_COLORS: Record<string, RGB> = {
  Beverages: [37, 99, 235],
  "Frozen & Chilled Foods": [14, 165, 233],
  Groceries: [217, 119, 6],
  Household: [5, 122, 85],
  "Personal Care": [219, 39, 119],
  Snacks: [220, 38, 38],
};

function lighten([r, g, b]: RGB, amount: number): RGB {
  return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount].map((v) =>
    Math.round(Math.min(255, v)),
  ) as RGB;
}

function isInRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
): boolean {
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  if ((x < left + radius || x > right - radius) && (y < top + radius || y > bottom - radius)) {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  }
  return true;
}

function hashSeed(input: string): number {
  const digest = createHash("sha1").update(input).digest();
  return digest.readUInt32BE(0);
}

function generatePlaceholder(categoryColor: RGB, seedInput: string): Buffer {
  const seed = hashSeed(seedInput);
  const accent = lighten(categoryColor, 0.35 + ((seed % 20) / 100));
  const inner = lighten(categoryColor, 0.85);
  const margin = 36;
  const cardRadius = 28;
  const centerX = SIZE / 2 + (((seed >> 8) % 21) - 10);
  const centerY = SIZE / 2 + (((seed >> 16) % 21) - 10);
  const circleRadius = 90 + ((seed >> 24) % 40);

  return encodePng(SIZE, SIZE, (x, y) => {
    if (!isInRoundedRect(x, y, margin, margin, SIZE - margin, SIZE - margin, cardRadius)) {
      return categoryColor;
    }
    const dx = x - centerX;
    const dy = y - centerY;
    if (dx * dx + dy * dy <= circleRadius * circleRadius) {
      return accent;
    }
    return inner;
  });
}

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null, images: { isEmpty: true } },
    select: { id: true, name: true, categoryId: true, category: { select: { name: true } } },
  });

  let count = 0;
  for (const product of products) {
    const categoryName = (product.category.name as { en: string }).en;
    const color = CATEGORY_COLORS[categoryName] ?? [100, 116, 139];

    // Give the Coca-Cola variant group a small multi-image gallery to
    // demonstrate the thumbnail-strip UI; everything else gets one image.
    const productName = (product.name as { en: string }).en;
    const imageCount = productName.startsWith("Coca-Cola") ? 3 : 1;

    const urls: string[] = [];
    for (let i = 0; i < imageCount; i++) {
      const buffer = generatePlaceholder(color, `${product.id}:${i}`);
      const filename = `${randomUUID()}.png`;
      writeFileSync(path.join(productImagesDir, filename), buffer);
      urls.push(`/api/uploads/products/${filename}`);
    }

    await prisma.product.update({ where: { id: product.id }, data: { images: urls } });
    count++;
  }

  console.log(`Generated placeholder images for ${count} products`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
