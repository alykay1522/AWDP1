import { pgTable, text, serial, decimal, boolean, timestamp, integer, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  supplier: text("supplier").notNull(),
  inStock: boolean("in_stock").notNull().default(true),
  imageUrl: text("image_url"),
  tags: json("tags").$type<string[]>().default([]),
  specifications: json("specifications").$type<Record<string, string>>().default({}),
  compatibleBrands: json("compatible_brands").$type<string[]>().default([]),
  variantGroupId: text("variant_group_id"),  // shared identifier linking sibling variants
  variantLabel: text("variant_label"),        // display label within the group, e.g. "Left Hand", "White"
  attributes: json("attributes").$type<Record<string, string[]>>(),  // AWDP structured attrs, e.g. {length:["28\""], weight_code:["2830"]}
  soldAs: text("sold_as"),                    // "Pair" | "Each" | "Set"
  createdAt: timestamp("created_at").defaultNow(),
});

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").default(""),
  imageUrl: text("image_url"),
});

export const partsIdRequestsTable = pgTable("parts_id_requests", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  description: text("description").notNull(),
  windowDoorBrand: text("window_door_brand"),
  windowDoorAge: text("window_door_age"),
  imageFileName: text("image_file_name"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  shippingAddress: json("shipping_address").$type<{
    line1: string; line2?: string; city: string; state: string; postal_code: string; country: string;
  }>(),
  lineItems: json("line_items").$type<Array<{
    sku: string; name: string; price: number; quantity: number; imageUrl?: string;
  }>>().notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contactSubmissionsTable = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Distributor Price Tracking ───────────────────────────────────────────────
export const distributorPricesTable = pgTable("distributor_prices", {
  id: serial("id").primaryKey(),
  productSku: text("product_sku").notNull(),          // our AWDP SKU
  distributor: text("distributor").notNull(),          // 'Alcosupply' | 'Strybuc'
  distributorSku: text("distributor_sku"),             // their part number
  distributorUrl: text("distributor_url"),             // link to their product page
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),   // their listed price
  ourPrice: decimal("our_price", { precision: 10, scale: 2 }).notNull(),  // our sell price at check time
  markupRatio: decimal("markup_ratio", { precision: 10, scale: 4 }),       // ourPrice / costPrice
  targetMarkup: decimal("target_markup", { precision: 10, scale: 4 }).notNull().default("2.50"),
  // 'ok' | 'needs_update' | 'cost_up' | 'cost_down' | 'no_price' | 'manual'
  status: text("status").notNull().default("ok"),
  notes: text("notes"),
  checkedAt: timestamp("checked_at").defaultNow(),
}, (t) => [
  index("distributor_prices_sku_idx").on(t.productSku),
  index("distributor_prices_distributor_idx").on(t.distributor),
  index("distributor_prices_checked_idx").on(t.checkedAt),
]);

export type DistributorPrice = typeof distributorPricesTable.$inferSelect;
export type InsertDistributorPrice = typeof distributorPricesTable.$inferInsert;

// ─── PDF Resources ─────────────────────────────────────────────────────────────
export const pdfResourcesTable = pgTable("pdf_resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  brand: text("brand").notNull().default(""),
  category: text("category").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PdfResource = typeof pdfResourcesTable.$inferSelect;
export type InsertPdfResource = typeof pdfResourcesTable.$inferInsert;

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export const insertPartsIdSchema = createInsertSchema(partsIdRequestsTable).omit({ id: true, createdAt: true });
export const insertContactSchema = createInsertSchema(contactSubmissionsTable).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
export type InsertPartsId = z.infer<typeof insertPartsIdSchema>;
export type PartsIdRequest = typeof partsIdRequestsTable.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactSubmission = typeof contactSubmissionsTable.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const siteSettingsTable = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productImagesTable = pgTable("product_images", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  objectName: text("object_name").notNull(),
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});
