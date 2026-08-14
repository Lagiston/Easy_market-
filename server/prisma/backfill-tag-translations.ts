import { prisma } from "../src/lib/prisma";

// One-off script: creates an English-only Tag row for every distinct tag
// value already used by a non-deleted product, so existing tags render (in
// English, falling back like any other untranslated tag) instead of simply
// having no Tag row at all. Skips any value that already has one — safe to
// re-run after new products/tags are added.
async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { tags: true },
  });
  const values = [...new Set(products.flatMap((product) => product.tags))];

  const existing = await prisma.tag.findMany({ where: { value: { in: values } } });
  const existingValues = new Set(existing.map((tag) => tag.value));
  const missing = values.filter((value) => !existingValues.has(value));

  if (missing.length === 0) {
    console.log("No untranslated tags found.");
    return;
  }

  await prisma.tag.createMany({
    data: missing.map((value) => ({ value, name: { en: value } })),
  });
  console.log(`Created ${missing.length} Tag row(s): ${missing.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
