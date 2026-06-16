import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// ------------------------------
// PARTS ID REQUESTS TABLE
// ------------------------------
export const partsIdRequestsTable = pgTable("parts_id_requests", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  description: text("description").notNull(),
  windowDoorBrand: text("window_door_brand"),
  windowDoorAge: text("window_door_age"),

  // ⭐ REQUIRED FOR IMAGE SUPPORT
  imageUrl: text("image_url"),

  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ------------------------------
// CONTACT SUBMISSIONS TABLE
// ------------------------------
export const contactSubmissionsTable = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
