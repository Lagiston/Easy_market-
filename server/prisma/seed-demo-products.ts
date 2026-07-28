import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

// One-off demo data script (not wired into `bun run seed`) — creates 50
// real-life grocery-store products spanning every category, plus a few
// variant groups (size/color) and reviews, so the storefront/admin features
// (variant picker, low-stock/out-of-stock, tags, agent assignment,
// localization, reviews + staff reply) all have something to show.

type Localized = Record<string, string>;

interface ProductSeed {
  name: Localized;
  description: Localized;
  price: number;
  stock: number;
  lowStockThreshold?: number;
  category: string;
  tags: string[];
  agent?: "agent1" | "agent2" | null;
  size?: string;
  color?: string;
  variantGroup?: string;
}

async function main() {
  const categories = await prisma.category.findMany({ where: { deletedAt: null } });
  const categoryIdByName = new Map(
    categories.map((c) => [(c.name as { en: string }).en, c.id]),
  );
  const agents = await prisma.user.findMany({
    where: { deletedAt: null, role: "AGENT" as never },
    orderBy: { createdAt: "asc" },
  });
  const agentIds = { agent1: agents[0]?.id, agent2: agents[1]?.id };

  const products: ProductSeed[] = [
    // ---- Beverages ----
    {
      name: { en: "Coca-Cola 330ml Can", ar: "كوكاكولا 330 مل" },
      description: { en: "Classic Coca-Cola in a single-serve 330ml can." },
      price: 80,
      stock: 240,
      category: "Beverages",
      tags: ["soda", "cold drink"],
      size: "330ml",
      variantGroup: "coke",
      agent: "agent1",
    },
    {
      name: { en: "Coca-Cola 500ml Bottle", ar: "كوكاكولا 500 مل" },
      description: { en: "Classic Coca-Cola in a 500ml bottle." },
      price: 120,
      stock: 180,
      category: "Beverages",
      tags: ["soda", "cold drink"],
      size: "500ml",
      variantGroup: "coke",
      agent: "agent1",
    },
    {
      name: { en: "Coca-Cola 1.5L Bottle", ar: "كوكاكولا 1.5 لتر" },
      description: { en: "Classic Coca-Cola, family-size 1.5L bottle." },
      price: 220,
      stock: 6,
      category: "Beverages",
      tags: ["soda", "cold drink"],
      size: "1.5L",
      variantGroup: "coke",
      agent: "agent1",
    },
    {
      name: { en: "Coca-Cola 2L Bottle", ar: "كوكاكولا 2 لتر" },
      description: { en: "Classic Coca-Cola, party-size 2L bottle." },
      price: 280,
      stock: 0,
      category: "Beverages",
      tags: ["soda", "cold drink"],
      size: "2L",
      variantGroup: "coke",
      agent: "agent1",
    },
    {
      name: { en: "Dasani Bottled Water 500ml", ar: "مياه داساني 500 مل" },
      description: { en: "Purified still water." },
      price: 50,
      stock: 300,
      category: "Beverages",
      tags: ["water"],
      size: "500ml",
      variantGroup: "dasani-water",
    },
    {
      name: { en: "Dasani Bottled Water 1L", ar: "مياه داساني 1 لتر" },
      description: { en: "Purified still water." },
      price: 90,
      stock: 150,
      category: "Beverages",
      tags: ["water"],
      size: "1L",
      variantGroup: "dasani-water",
    },
    {
      name: { en: "Dasani Bottled Water 5L", ar: "مياه داساني 5 لتر" },
      description: { en: "Purified still water, large jug for home use." },
      price: 300,
      stock: 4,
      lowStockThreshold: 15,
      category: "Beverages",
      tags: ["water"],
      size: "5L",
      variantGroup: "dasani-water",
    },
    {
      name: { en: "Minute Maid Orange Juice 1L", ar: "عصير مينت مايد بالبرتقال 1 لتر", fr: "Jus d'orange Minute Maid 1L" },
      description: { en: "100% orange juice from concentrate, no added sugar." },
      price: 180,
      stock: 45,
      category: "Beverages",
      tags: ["juice", "breakfast"],
      agent: "agent2",
    },
    {
      name: { en: "Lipton Yellow Label Tea Bags (100 pack)", ar: "شاي ليبتون العلامة الصفراء" },
      description: { en: "Classic black tea, 100 tea bags per box." },
      price: 350,
      stock: 60,
      category: "Beverages",
      tags: ["tea", "breakfast"],
    },
    {
      name: { en: "Nescafé Classic Instant Coffee 200g", ar: "نسكافيه كلاسيك قهوة سريعة التحضير 200 جرام" },
      description: { en: "Instant coffee granules, rich and smooth." },
      price: 650,
      stock: 22,
      category: "Beverages",
      tags: ["coffee", "breakfast"],
      agent: "agent2",
    },

    // ---- Frozen & Chilled Foods ----
    {
      name: { en: "Ben & Jerry's Vanilla Ice Cream 465ml" },
      description: { en: "Classic vanilla ice cream made with Fairtrade vanilla." },
      price: 950,
      stock: 18,
      category: "Frozen & Chilled Foods",
      tags: ["dessert", "frozen"],
    },
    {
      name: { en: "Debonairs Frozen Margherita Pizza 400g" },
      description: { en: "Oven-ready margherita pizza with mozzarella." },
      price: 480,
      stock: 30,
      category: "Frozen & Chilled Foods",
      tags: ["pizza", "frozen", "ready meal"],
    },
    {
      name: { en: "Fresh Chicken Breast Fillets 1kg" },
      description: { en: "Chilled boneless, skinless chicken breast." },
      price: 700,
      stock: 12,
      category: "Frozen & Chilled Foods",
      tags: ["meat", "chilled"],
      agent: "agent1",
    },
    {
      name: { en: "Brookside Fresh Milk 500ml" },
      description: { en: "Pasteurized whole milk." },
      price: 65,
      stock: 90,
      category: "Frozen & Chilled Foods",
      tags: ["dairy", "chilled"],
    },
    {
      name: { en: "Danone Fruit Yoghurt 4-Pack" },
      description: { en: "Strawberry, mango, peach and vanilla yoghurt cups." },
      price: 320,
      stock: 5,
      category: "Frozen & Chilled Foods",
      tags: ["dairy", "chilled", "snack"],
    },
    {
      name: { en: "President Cheddar Cheese Block 200g" },
      description: { en: "Aged cheddar cheese block." },
      price: 420,
      stock: 0,
      category: "Frozen & Chilled Foods",
      tags: ["dairy", "chilled"],
    },
    {
      name: { en: "Blue Band Salted Butter 250g" },
      description: { en: "Creamy salted butter for cooking and baking." },
      price: 260,
      stock: 40,
      category: "Frozen & Chilled Foods",
      tags: ["dairy", "chilled", "baking"],
    },

    // ---- Groceries ----
    {
      name: { en: "Pembe Jasmine Rice 5kg", ar: "أرز ياسمين بيمبي 5 كجم", sw: "Mchele wa Jasmine wa Pembe 5kg" },
      description: { en: "Long-grain fragrant jasmine rice." },
      price: 950,
      stock: 55,
      category: "Groceries",
      tags: ["rice", "staple"],
      agent: "agent2",
    },
    {
      name: { en: "Barilla Spaghetti Pasta 500g" },
      description: { en: "Classic durum wheat spaghetti." },
      price: 220,
      stock: 70,
      category: "Groceries",
      tags: ["pasta", "staple"],
    },
    {
      name: { en: "Exe All Purpose Wheat Flour 2kg", sw: "Unga wa ngano wa Exe 2kg" },
      description: { en: "All-purpose wheat flour for baking and cooking." },
      price: 260,
      stock: 8,
      category: "Groceries",
      tags: ["flour", "baking", "staple"],
    },
    {
      name: { en: "Kabras White Sugar 2kg", sw: "Sukari nyeupe ya Kabras 2kg" },
      description: { en: "Refined white granulated sugar." },
      price: 300,
      stock: 65,
      category: "Groceries",
      tags: ["sugar", "staple", "baking"],
    },
    {
      name: { en: "Golden Fry Cooking Oil 3L" },
      description: { en: "Pure sunflower cooking oil." },
      price: 780,
      stock: 3,
      lowStockThreshold: 8,
      category: "Groceries",
      tags: ["oil", "staple"],
      agent: "agent1",
    },
    {
      name: { en: "Del Monte Canned Tomatoes 400g" },
      description: { en: "Peeled whole tomatoes in tomato juice." },
      price: 140,
      stock: 100,
      category: "Groceries",
      tags: ["canned", "cooking"],
    },
    {
      name: { en: "Kellogg's Corn Flakes 500g" },
      description: { en: "Crunchy toasted corn flakes cereal." },
      price: 480,
      stock: 33,
      category: "Groceries",
      tags: ["cereal", "breakfast"],
    },
    {
      name: { en: "Quaker Rolled Oats 1kg" },
      description: { en: "100% whole grain rolled oats." },
      price: 340,
      stock: 27,
      category: "Groceries",
      tags: ["oats", "breakfast", "healthy"],
    },
    {
      name: { en: "Acacia Natural Honey 500g" },
      description: { en: "Pure, unfiltered natural honey." },
      price: 600,
      stock: 15,
      category: "Groceries",
      tags: ["honey", "natural"],
    },
    {
      name: { en: "Peanut Butter Creamy 400g" },
      description: { en: "Smooth creamy peanut butter, no added sugar." },
      price: 380,
      stock: 0,
      category: "Groceries",
      tags: ["spread", "breakfast"],
    },
    {
      name: { en: "Royco Mchuzi Mix Beef Cubes 200g", sw: "Royco Mchuzi Mix ladha ya nyama 200g" },
      description: { en: "Beef-flavour seasoning cubes for stews and sauces." },
      price: 150,
      stock: 120,
      category: "Groceries",
      tags: ["spices", "cooking"],
    },
    {
      name: { en: "Fresh Farm Eggs (Tray of 30)" },
      description: { en: "Farm-fresh whole eggs, tray of 30." },
      price: 480,
      stock: 20,
      category: "Groceries",
      tags: ["eggs", "staple"],
      agent: "agent2",
    },

    // ---- Household ----
    {
      name: { en: "Tide Detergent — Original Scent 1kg" },
      description: { en: "Powder laundry detergent, original fresh scent." },
      price: 420,
      stock: 40,
      category: "Household",
      tags: ["detergent", "laundry"],
      color: "Original",
      variantGroup: "tide-detergent",
    },
    {
      name: { en: "Tide Detergent — Lavender Scent 1kg" },
      description: { en: "Powder laundry detergent, lavender scent." },
      price: 420,
      stock: 25,
      category: "Household",
      tags: ["detergent", "laundry"],
      color: "Lavender",
      variantGroup: "tide-detergent",
    },
    {
      name: { en: "Tide Detergent — Mountain Spring Scent 1kg" },
      description: { en: "Powder laundry detergent, mountain spring scent." },
      price: 420,
      stock: 0,
      category: "Household",
      tags: ["detergent", "laundry"],
      color: "Mountain Spring",
      variantGroup: "tide-detergent",
    },
    {
      name: { en: "Airtight Storage Container 2L — Red" },
      description: { en: "BPA-free airtight plastic storage container, 2L." },
      price: 350,
      stock: 18,
      category: "Household",
      tags: ["storage", "kitchen"],
      color: "Red",
      variantGroup: "storage-container",
    },
    {
      name: { en: "Airtight Storage Container 2L — Blue" },
      description: { en: "BPA-free airtight plastic storage container, 2L." },
      price: 350,
      stock: 9,
      category: "Household",
      tags: ["storage", "kitchen"],
      color: "Blue",
      variantGroup: "storage-container",
    },
    {
      name: { en: "Airtight Storage Container 2L — Clear" },
      description: { en: "BPA-free airtight plastic storage container, 2L." },
      price: 350,
      stock: 22,
      category: "Household",
      tags: ["storage", "kitchen"],
      color: "Clear",
      variantGroup: "storage-container",
    },
    {
      name: { en: "Sunlight Dish Washing Liquid 750ml" },
      description: { en: "Grease-cutting dish washing liquid, lemon scent." },
      price: 220,
      stock: 55,
      category: "Household",
      tags: ["dish soap", "cleaning"],
    },
    {
      name: { en: "Heavy Duty Trash Bags (Roll of 30)" },
      description: { en: "Extra-strong black trash bags, 30-count roll." },
      price: 260,
      stock: 44,
      category: "Household",
      tags: ["trash bags", "cleaning"],
    },
    {
      name: { en: "Softex Toilet Paper (10 Rolls)" },
      description: { en: "Soft 2-ply toilet paper, pack of 10 rolls." },
      price: 480,
      stock: 60,
      category: "Household",
      tags: ["toilet paper", "essentials"],
      agent: "agent1",
    },
    {
      name: { en: "Duracell AA Batteries (8 Pack)" },
      description: { en: "Long-lasting alkaline AA batteries." },
      price: 380,
      stock: 50,
      category: "Household",
      tags: ["batteries", "electronics"],
    },

    // ---- Personal Care ----
    {
      name: { en: "Dove Moisturizing Shampoo 400ml" },
      description: { en: "Nourishing shampoo for dry hair." },
      price: 480,
      stock: 33,
      category: "Personal Care",
      tags: ["shampoo", "hair care"],
      agent: "agent2",
    },
    {
      name: { en: "Colgate Total Toothpaste 150g" },
      description: { en: "Whole-mouth protection toothpaste." },
      price: 220,
      stock: 90,
      category: "Personal Care",
      tags: ["toothpaste", "oral care"],
    },
    {
      name: { en: "Dettol Antibacterial Soap Bar (3 Pack)" },
      description: { en: "Antibacterial soap bars for hand and body." },
      price: 260,
      stock: 48,
      category: "Personal Care",
      tags: ["soap", "hygiene"],
    },
    {
      name: { en: "Nivea Roll-On Deodorant 50ml" },
      description: { en: "48-hour protection roll-on deodorant." },
      price: 300,
      stock: 4,
      lowStockThreshold: 12,
      category: "Personal Care",
      tags: ["deodorant", "hygiene"],
    },
    {
      name: { en: "Gillette Disposable Razors (4 Pack)" },
      description: { en: "Twin-blade disposable razors for a smooth shave." },
      price: 340,
      stock: 26,
      category: "Personal Care",
      tags: ["razor", "shaving"],
    },
    {
      name: { en: "Nivea Sun Sunscreen SPF 50 200ml" },
      description: { en: "Broad-spectrum sunscreen lotion, SPF 50." },
      price: 950,
      stock: 0,
      category: "Personal Care",
      tags: ["sunscreen", "skincare"],
    },

    // ---- Snacks ----
    {
      name: { en: "Lay's Classic Potato Chips 150g" },
      description: { en: "Crispy salted potato chips." },
      price: 200,
      stock: 80,
      category: "Snacks",
      tags: ["chips", "snack"],
      agent: "agent1",
    },
    {
      name: { en: "Cadbury Dairy Milk Chocolate Bar 100g" },
      description: { en: "Classic smooth milk chocolate bar." },
      price: 250,
      stock: 65,
      category: "Snacks",
      tags: ["chocolate", "snack", "sweet"],
    },
    {
      name: { en: "Digestive Oat Cookies 250g" },
      description: { en: "Wholesome oat digestive biscuits." },
      price: 180,
      stock: 6,
      category: "Snacks",
      tags: ["cookies", "snack"],
    },
    {
      name: { en: "Butter Popcorn Microwave Bags (3 Pack)" },
      description: { en: "Ready-to-microwave butter popcorn, pack of 3." },
      price: 300,
      stock: 40,
      category: "Snacks",
      tags: ["popcorn", "snack"],
    },
    {
      name: { en: "Roasted Mixed Nuts 200g" },
      description: { en: "Salted roasted cashews, almonds and peanuts." },
      price: 420,
      stock: 19,
      category: "Snacks",
      tags: ["nuts", "snack", "healthy"],
    },
  ];

  if (products.length !== 50) {
    throw new Error(`Expected 50 products, got ${products.length}`);
  }

  const variantGroupIds = new Map<string, string>();
  const createdIds: { id: string; name: string }[] = [];

  for (const p of products) {
    const categoryId = categoryIdByName.get(p.category);
    if (!categoryId) throw new Error(`Unknown category: ${p.category}`);

    let variantGroupId: string | undefined;
    if (p.variantGroup) {
      variantGroupId = variantGroupIds.get(p.variantGroup);
      if (!variantGroupId) {
        variantGroupId = randomUUID();
        variantGroupIds.set(p.variantGroup, variantGroupId);
      }
    }

    const id = randomUUID();
    await prisma.product.create({
      data: {
        id,
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold ?? 10,
        tags: p.tags,
        size: p.size ?? null,
        color: p.color ?? null,
        variantGroupId: variantGroupId ?? null,
        categoryId,
        assignedAgentId: p.agent ? agentIds[p.agent] ?? null : null,
      },
    });
    createdIds.push({ id, name: p.name.en });
  }

  console.log(`Created ${createdIds.length} products`);

  // A handful of reviews so the review feature (rating distribution, verified
  // purchase, staff reply) has real data to show.
  const reviewSeeds: { productName: string; authorName: string; rating: number; comment?: string; verified?: boolean; staffReply?: string }[] = [
    { productName: "Coca-Cola 330ml Can", authorName: "Amina", rating: 5, comment: "Always ice cold and fresh, my go-to drink.", verified: true },
    { productName: "Ben & Jerry's Vanilla Ice Cream 465ml", authorName: "James K.", rating: 4, comment: "Delicious but a bit pricey.", verified: true, staffReply: "Thanks for the feedback, James! We try to keep prices as fair as possible for premium imports." },
    { productName: "President Cheddar Cheese Block 200g", authorName: "Grace W.", rating: 2, comment: "Arrived out of stock twice before I could get it.", verified: false, staffReply: "Sorry about that, Grace — we've restocked and it should be more reliably available now." },
    { productName: "Nivea Roll-On Deodorant 50ml", authorName: "Peter M.", rating: 5, comment: "Lasts all day, great scent.", verified: true },
    { productName: "Golden Fry Cooking Oil 3L", authorName: "Fatuma", rating: 3, comment: "Good quality but often low in stock." },
    { productName: "Lay's Classic Potato Chips 150g", authorName: "Brian O.", rating: 5, comment: "Kids love these, always crunchy and fresh.", verified: true },
    { productName: "Softex Toilet Paper (10 Rolls)", authorName: "Susan N.", rating: 4, comment: "Soft and good value for the pack size." },
    { productName: "Peanut Butter Creamy 400g", authorName: "Daniel K.", rating: 1, comment: "Was out of stock for weeks, please restock!" },
  ];

  for (const r of reviewSeeds) {
    const product = createdIds.find((p) => p.name === r.productName);
    if (!product) continue;
    await prisma.review.create({
      data: {
        id: randomUUID(),
        productId: product.id,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment ?? null,
        verifiedPurchase: r.verified ?? false,
        staffReply: r.staffReply ?? null,
        staffReplyAt: r.staffReply ? new Date() : null,
      },
    });
  }
  console.log(`Created ${reviewSeeds.length} reviews`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
