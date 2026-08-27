import { prisma } from "../src/lib/prisma";

// One-off dev script: this dev DB only has one product with a real Cloudinary
// image (everything else was seeded with images: []), which left the new
// mobile home screen's hero carousel and "New Popular Item" grid unable to
// show more than a single item locally. Reuses that one real image URL
// across a handful more of the newest products, purely so those multi-item
// states are visible in a local dev browser — not meant for production data.
const REUSE_COUNT = 7;

async function main() {
  const source = await prisma.product.findFirst({
    where: { deletedAt: null, images: { isEmpty: false } },
    select: { images: true },
  });
  if (!source) {
    console.error("No product with an existing image found — nothing to reuse.");
    process.exitCode = 1;
    return;
  }

  const targets = await prisma.product.findMany({
    where: { deletedAt: null, images: { isEmpty: true } },
    orderBy: { createdAt: "desc" },
    take: REUSE_COUNT,
    select: { id: true, name: true },
  });

  for (const product of targets) {
    await prisma.product.update({ where: { id: product.id }, data: { images: source.images } });
  }

  console.log(`Assigned a preview image to ${targets.length} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
