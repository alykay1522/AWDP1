import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable, categoriesTable, partsIdRequestsTable, contactSubmissionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  // Business info
  businessName: "All Window Door Parts",
  phone: "785-533-0244",
  email: "Info@allwindowdoorparts.com",
  address: "",
  orderMinimum: "50",
  bannerEnabled: "false",
  bannerText: "",
  metaDescription: "All Window Door Parts — veteran-owned supplier with 40+ years experience. Shop 4,000+ in-stock window and door parts.",
  freeShippingThreshold: "0",
  taxRate: "0",
  // Homepage content
  heroHeadline: "America's Most Trusted Window & Door Parts Supplier",
  heroSubheadline: "From obsolete casement operators to hard-to-find sash balances — we've stocked and shipped the parts big-box stores can't. Veteran-owned, 40+ years experience.",
  heroBadge: "Veteran Owned & Operated",
  heroCtaShop: "Shop All Parts Now",
  heroCtaPartsId: "Free Parts ID Service",
  // About page content
  aboutHeroTitle: "40+ Years of Hardware Expertise",
  aboutHeroSubtitle: "We are America's trusted source for replacement window and door parts. We don't just sell hardware; we solve problems.",
  aboutStoryP1: "Our AllWindowDoorParts GROUP USA was built by industry veterans—not executives in a boardroom. With over 40 years of hands-on experience in construction, remodeling and fenestration, we've dealt with every kind of window and door hardware challenge.",
  aboutStoryP2: "We have helped D.I.Y. homeowners, contractors big and small wasting precious time searching for parts that were discontinued, redesigned, or impossible to find in hardware stores and big box stores. So, we created a company dedicated to solving that problem.",
  aboutStoryP3: "If a part exists, we can get it. If it doesn't, we know the right modern replacement—or can confirm and save you time wasted when something is truly no longer available.",
  aboutExpertiseTitle: "Unmatched Expertise",
  aboutExpertiseText: "Our team has over 40 years of hands-on experience. We know Casement, Awning, Single/Double Hung and slider windows inside and out.",
  aboutVeteranTitle: "Veteran Owned",
  aboutVeteranText: "Operated with the same integrity, precision, and dedication to service that we learned in the military.",
  aboutInventoryTitle: "Massive Inventory",
  aboutInventoryText: "We stock thousands of parts from hundreds of manufacturers, including rare and hard-to-find components.",
  aboutCtaTitle: "Ready to fix that window or door?",
  aboutCtaText: "Browse our catalog or let our experts find the exact part you need for free.",
  // Policies
  policyShippingMain: "Shipping costs are calculated automatically during checkout based on your delivery address, package weight, and dimensions. There is no guarantee that orders will ship immediately — some items may need to be sourced from our distributors first. We will contact you if additional lead time is required.",
  policyShippingObsolete: "We specialize in hard-to-find and obsolete window and door parts. Shipping times for these items may vary and could take longer than standard estimates. We will contact you if your order requires additional lead time.",
  policyShippingNote: "We ship via UPS, FedEx, and/or USPS. You do not need to complete a purchase to view shipping charges — they are shown before you pay.",
  policyReturnsWarning: "Most items are special order and cannot be returned.",
  policyReturnsBody: "Special order items — which include most items shown and offered on our sites — are sourced specifically for your order through our national distribution network and are non-returnable and non-exchangeable.\n\nCustom-cut weatherstripping and any items cut-to-length are also non-returnable.\n\nIf you are unsure whether an item is a special order, please contact us before purchasing. Our experts will confirm compatibility and let you know the ordering terms.",
  policySecurity: "Security is a very important part of having a safe and enjoyable online experience. We use the latest technology to protect all of the information you send and receive during the checkout process. The connection between your browser and our server is encrypted with industry leading SSL technology. SSL encrypts all of your personal information, including credit card number, name, and address, so it cannot be read as the information travels over the internet. Your browser must support SSL.\n\nOur Secure Shopping Guarantee protects you every time you shop with us so that you never have to worry about the safety of your credit card information. We use the industry standard encryption protocol known as Secure Socket Layer (SSL), to keep your order information secure. We guarantee that every transaction you make here will be safe and secure. You pay nothing if unauthorized charges are made to your card as a result of shopping online with us.",
  policyGuarantee: "Under the Fair Credit Billing Act, your bank cannot hold you liable for more than $50 of fraudulent charges. If your bank does hold you liable for any of this $50, we will cover the entire liability for you, up to the full $50. We will cover this liability only if the unauthorized use of your credit card resulted through no fault of your own from purchases made on our site while using our secure servers. Should any unauthorized charges appear on your credit card as a result of shopping here you must notify your credit card provider in accordance with its reporting rules and procedures.",
};

// GET /api/settings — public, returns only public content keys (not admin config)
const PUBLIC_KEYS = new Set([
  "heroHeadline", "heroSubheadline", "heroBadge", "heroCtaShop", "heroCtaPartsId",
  "aboutHeroTitle", "aboutHeroSubtitle",
  "aboutStoryP1", "aboutStoryP2", "aboutStoryP3",
  "aboutExpertiseTitle", "aboutExpertiseText",
  "aboutVeteranTitle", "aboutVeteranText",
  "aboutInventoryTitle", "aboutInventoryText",
  "aboutCtaTitle", "aboutCtaText",
  "policyShippingMain", "policyShippingObsolete", "policyShippingNote",
  "policyReturnsWarning", "policyReturnsBody",
  "policySecurity", "policyGuarantee",
  "businessName", "phone", "email",
  "bannerEnabled", "bannerText",
  "metaDescription",
]);

router.get("/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const all: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) all[row.key] = row.value;
    const settings: Record<string, string> = {};
    for (const key of PUBLIC_KEYS) settings[key] = all[key] ?? "";
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/settings
router.get("/admin/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/settings  — upsert multiple key-value pairs
router.put("/admin/settings", async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Body must be a key-value object" });
    }

    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(siteSettingsTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }

    const rows = await db.select().from(siteSettingsTable);
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) settings[row.key] = row.value;

    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Categories ────────────────────────────────────────────────────────────────

// GET /api/admin/categories
router.get("/admin/categories", async (_req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json({ categories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/categories
router.post("/admin/categories", async (req, res) => {
  try {
    const { name, slug, description, imageUrl } = req.body as {
      name: string; slug: string; description?: string; imageUrl?: string;
    };
    if (!name || !slug) return res.status(400).json({ error: "name and slug are required" });

    const [cat] = await db
      .insert(categoriesTable)
      .values({ name, slug, description: description ?? "", imageUrl: imageUrl ?? null })
      .returning();
    res.status(201).json({ category: cat });
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "A category with that slug already exists" });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/categories/:id
router.patch("/admin/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, slug, description, imageUrl } = req.body as Partial<{
      name: string; slug: string; description: string; imageUrl: string;
    }>;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;

    const [cat] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, id)).returning();
    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json({ category: cat });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/categories/:id
router.delete("/admin/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(categoriesTable).where(eq(categoriesTable.id, id)).returning({ id: categoriesTable.id });
    if (!deleted) return res.status(404).json({ error: "Category not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parts ID Requests ──────────────────────────────────────────────────────────

router.get("/admin/parts-id", async (_req, res) => {
  try {
    const requests = await db
      .select()
      .from(partsIdRequestsTable)
      .orderBy(desc(partsIdRequestsTable.createdAt));
    res.json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/parts-id/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status: string };
    const [updated] = await db
      .update(partsIdRequestsTable)
      .set({ status })
      .where(eq(partsIdRequestsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Request not found" });
    res.json({ request: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Contact Submissions ────────────────────────────────────────────────────────

router.get("/admin/contacts", async (_req, res) => {
  try {
    const submissions = await db
      .select()
      .from(contactSubmissionsTable)
      .orderBy(desc(contactSubmissionsTable.createdAt));
    res.json({ submissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
