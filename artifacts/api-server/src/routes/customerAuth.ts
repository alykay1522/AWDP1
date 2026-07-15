/**
 * Customer accounts: register, login, logout, profile, and order history.
 *
 * Sessions reuse the app-wide express-session middleware (PostgreSQL-backed).
 * A logged-in customer has req.session.customerId set. CSRF exposure is limited
 * by the sameSite=lax session cookie plus the same-origin CORS policy in app.ts.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { z } from "zod";
import { eq, or, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { customersTable, ordersTable } from "@workspace/db/schema";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { logger } from "../lib/logger";

const router = Router();

const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: (used) => (used - 3) * 500,
  maxDelayMs: 5000,
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  statusCode: 429,
});

const AddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postal_code: z.string().trim().min(1).max(20),
  country: z.string().trim().min(2).max(2).default("US"),
});

const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
});

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

const UpdateProfileSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  shippingAddress: AddressSchema.nullable().optional(),
  // Password change: requires currentPassword
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

function getCustomerId(req: Request): number | null {
  const id = (req.session as any)?.customerId;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  if (getCustomerId(req) === null) {
    return res.status(401).json({ error: "Not signed in" });
  }
  next();
}

function publicCustomer(c: {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  shippingAddress: unknown;
}) {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    shippingAddress: c.shippingAddress ?? null,
  };
}

// POST /api/auth/register
router.post("/auth/register", authRateLimiter, async (req, res) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({ error: issue?.message || "Invalid registration data" });
    }
    const { email, password, name, phone } = parsed.data;

    const [existing] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.email, email))
      .limit(1);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists. Try signing in." });
    }

    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(customersTable)
      .values({ email, passwordHash, name: name || null, phone: phone || null })
      .returning();

    req.session.regenerate((err) => {
      if (err) {
        logger.error({ err }, "[customer] session regenerate error");
        return res.status(500).json({ error: "Session error" });
      }
      (req.session as any).customerId = created.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error({ saveErr }, "[customer] session save error");
          return res.status(500).json({ error: "Session error" });
        }
        return res.status(201).json({ customer: publicCustomer(created) });
      });
    });
  } catch (error) {
    logger.error({ error }, "[customer] register error");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// POST /api/auth/login
router.post("/auth/login", loginSlowDown, authRateLimiter, async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const { email, password } = parsed.data;

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.email, email))
      .limit(1);

    // Always verify against something to keep timing consistent
    const ok = customer ? await verifyPassword(password, customer.passwordHash) : (await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), false);

    if (!customer || !ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    req.session.regenerate((err) => {
      if (err) {
        logger.error({ err }, "[customer] session regenerate error");
        return res.status(500).json({ error: "Session error" });
      }
      (req.session as any).customerId = customer.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error({ saveErr }, "[customer] session save error");
          return res.status(500).json({ error: "Session error" });
        }
        return res.json({ customer: publicCustomer(customer) });
      });
    });
  } catch (error) {
    logger.error({ error }, "[customer] login error");
    res.status(500).json({ error: "Sign-in failed. Please try again." });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("awdp_admin");
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  const customerId = getCustomerId(req);
  if (customerId === null) {
    return res.json({ customer: null });
  }
  try {
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, customerId))
      .limit(1);
    if (!customer) {
      return res.json({ customer: null });
    }
    res.json({ customer: publicCustomer(customer) });
  } catch (error) {
    logger.error({ error }, "[customer] me error");
    res.status(500).json({ error: "Failed to load account" });
  }
});

// PUT /api/account — update profile / shipping / password
router.put("/account", requireCustomer, async (req, res) => {
  try {
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({ error: issue?.message || "Invalid profile data" });
    }
    const customerId = getCustomerId(req)!;

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, customerId))
      .limit(1);
    if (!customer) {
      return res.status(404).json({ error: "Account not found" });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name || null;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone || null;
    if (parsed.data.shippingAddress !== undefined) updates.shippingAddress = parsed.data.shippingAddress;

    if (parsed.data.newPassword) {
      if (!parsed.data.currentPassword) {
        return res.status(400).json({ error: "Current password is required to set a new password" });
      }
      const ok = await verifyPassword(parsed.data.currentPassword, customer.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      updates.passwordHash = await hashPassword(parsed.data.newPassword);
    }

    const [updated] = await db
      .update(customersTable)
      .set(updates)
      .where(eq(customersTable.id, customerId))
      .returning();

    res.json({ customer: publicCustomer(updated) });
  } catch (error) {
    logger.error({ error }, "[customer] profile update error");
    res.status(500).json({ error: "Failed to update account" });
  }
});

// GET /api/account/orders — order history (linked orders + guest orders with same email)
router.get("/account/orders", requireCustomer, async (req, res) => {
  try {
    const customerId = getCustomerId(req)!;
    const [customer] = await db
      .select({ email: customersTable.email })
      .from(customersTable)
      .where(eq(customersTable.id, customerId))
      .limit(1);
    if (!customer) {
      return res.status(404).json({ error: "Account not found" });
    }

    const orders = await db
      .select({
        orderId: ordersTable.orderId,
        lineItems: ordersTable.lineItems,
        subtotal: ordersTable.subtotal,
        shippingCost: ordersTable.shippingCost,
        total: ordersTable.total,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .where(
        or(
          eq(ordersTable.customerId, customerId),
          eq(ordersTable.customerEmail, customer.email),
        ),
      )
      .orderBy(desc(ordersTable.createdAt))
      .limit(50);

    // Hide never-paid abandoned checkouts from the customer's history
    res.json({ orders: orders.filter((o) => o.status !== "pending") });
  } catch (error) {
    logger.error({ error }, "[customer] orders error");
    res.status(500).json({ error: "Failed to load orders" });
  }
});

export default router;
