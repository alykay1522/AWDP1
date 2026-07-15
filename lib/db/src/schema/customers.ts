import { pgTable, text, serial, timestamp, json } from "drizzle-orm/pg-core";

/**
 * Customer accounts — email + password login.
 * Passwords are stored as scrypt hashes (see api-server/src/lib/passwords.ts).
 */
export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  phone: text("phone"),
  shippingAddress: json("shipping_address").$type<{
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
