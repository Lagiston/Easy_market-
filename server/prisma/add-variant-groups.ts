import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

// One-off script: turns 8 of the existing standalone demo products into
// size-variant groups (adds 2 sibling Product rows each, sharing a new
// variantGroupId with the original) so the storefront's size/color picker
// (ProductVariantPicker) has more real examples to show, beyond the 4
// groups seed-demo-products.ts already created.

interface SiblingSpec {
  size: string;
  price: number;
  stock: number;
}

interface GroupSpec {
  productName: string;
  // Size to set on the *existing* product (it currently has none).
  baseSize: string;
  siblings: SiblingSpec[];
}

const GROUPS: GroupSpec[] = [
  {
    productName: "Nescafé Classic Instant Coffee 200g",
    baseSize: "200g",
    siblings: [
      { size: "100g", price: 380, stock: 40 },
      { size: "500g", price: 1450, stock: 0 },
    ],
  },
  {
    productName: "Pembe Jasmine Rice 5kg",
    baseSize: "5kg",
    siblings: [
      { size: "2kg", price: 420, stock: 70 },
      { size: "10kg", price: 1800, stock: 9 },
    ],
  },
  {
    productName: "Kabras White Sugar 2kg",
    baseSize: "2kg",
    siblings: [
      { size: "1kg", price: 160, stock: 90 },
      { size: "5kg", price: 700, stock: 5 },
    ],
  },
  {
    productName: "Dove Moisturizing Shampoo 400ml",
    baseSize: "400ml",
    siblings: [
      { size: "200ml", price: 280, stock: 45 },
      { size: "700ml", price: 780, stock: 0 },
    ],
  },
  {
    productName: "Colgate Total Toothpaste 150g",
    baseSize: "150g",
    siblings: [
      { size: "75g", price: 130, stock: 60 },
      { size: "225g", price: 320, stock: 12 },
    ],
  },
  {
    productName: "Lay's Classic Potato Chips 150g",
    baseSize: "150g",
    siblings: [
      { size: "70g", price: 100, stock: 100 },
      { size: "300g", price: 380, stock: 3 },
    ],
  },
  {
    productName: "Cadbury Dairy Milk Chocolate Bar 100g",
    baseSize: "100g",
    siblings: [
      { size: "45g", price: 120, stock: 80 },
      { size: "200g", price: 460, stock: 0 },
    ],
  },
  {
    productName: "Heavy Duty Trash Bags (Roll of 30)",
    baseSize: "Roll of 30",
    siblings: [
      { size: "Roll of 15", price: 150, stock: 55 },
      { size: "Roll of 50", price: 400, stock: 20 },
    ],
  },
];

async function main() {
  let groupsCreated = 0;
  let siblingsCreated = 0;

  for (const group of GROUPS) {
    const base = await prisma.product.findFirst({
      where: { deletedAt: null, name: { path: ["en"], equals: group.productName } },
    });
    if (!base) {
      console.warn(`Skipping "${group.productName}" — not found`);
      continue;
    }
    if (base.variantGroupId) {
      console.warn(`Skipping "${group.productName}" — already in a variant group`);
      continue;
    }

    const variantGroupId = randomUUID();
    await prisma.product.update({
      where: { id: base.id },
      data: { size: group.baseSize, variantGroupId },
    });

    for (const sibling of group.siblings) {
      // The base product's own name has its size baked into the text (e.g.
      // "Nescafé Classic Instant Coffee 200g") — copying it verbatim onto
      // every sibling row left each variant's displayed name/title
      // contradicting its own `size` field (a "500g" product still titled
      // "...200g"). Substitute the base size for the sibling's own size in
      // every language the name has, falling back to the unedited text if a
      // given translation doesn't literally contain the base size string.
      const siblingName = Object.fromEntries(
        Object.entries(base.name as Record<string, string>).map(([lang, text]) => [
          lang,
          text.includes(group.baseSize) ? text.replace(group.baseSize, sibling.size) : text,
        ]),
      );
      await prisma.product.create({
        data: {
          id: randomUUID(),
          name: siblingName,
          description: base.description as object | null,
          price: sibling.price,
          stock: sibling.stock,
          lowStockThreshold: base.lowStockThreshold,
          tags: base.tags,
          size: sibling.size,
          color: null,
          variantGroupId,
          categoryId: base.categoryId,
          assignedAgentId: base.assignedAgentId,
        },
      });
      siblingsCreated++;
    }
    groupsCreated++;
  }

  console.log(`Created ${groupsCreated} new variant groups (${siblingsCreated} sibling products)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
