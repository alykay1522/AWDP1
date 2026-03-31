import { pgTable, text, serial, decimal, boolean, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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

export const contactSubmissionsTable = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export const insertPartsIdSchema = createInsertSchema(partsIdRequestsTable).omit({ id: true, createdAt: true });
export const insertContactSchema = createInsertSchema(contactSubmissionsTable).omit({ id: true, createdAt: true });

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
export type InsertPartsId = z.infer<typeof insertPartsIdSchema>;
export type PartsIdRequest = typeof partsIdRequestsTable.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactSubmission = typeof contactSubmissionsTable.$inferSelect;
