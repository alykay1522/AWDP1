import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";

// ── mocks ──────────────────────────────────────────────────────────────────────────────

vi.mock("nodemailer");
vi.mock("./lib/notifyRecipients.js", () => ({
  getContactForwardEmails: vi.fn(() => ["staff@example.com"]),
}));

import { sendOrderNotification } from "./emailNotifier.js";
import { getContactForwardEmails } from "./lib/notifyRecipients.js";

// ── fixtures ───────────────────────────────────────────────────────────────────────────

const SAMPLE_PAYLOAD = {
  orderId: "ORD-TEST-001",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "555-1234",
  shippingAddress: {
    line1: "123 Main St",
    city: "Springfield",
    state: "KS",
    postal_code: "66801",
    country: "US",
  },
  items: [{ name: "Window Operator", sku: "WO-123", price: 29.99, quantity: 2 }],
  subtotal: "59.98",
  total: "64.98",
  paymentMethod: "paypal" as const,
};

// ── helpers ─────────────────────────────────────────────────────────────────────────────

function setupSmtp() {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_USER = "user@example.com";
  process.env.SMTP_PASS = "secret";
}

function teardownSmtp() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
}

// ── tests ──────────────────────────────────────────────────────────────────────────────

describe("sendOrderNotification", () => {
  let sendMailMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMailMock = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as ReturnType<typeof vi.fn>).mockReturnValue({
      sendMail: sendMailMock,
    });
    (getContactForwardEmails as ReturnType<typeof vi.fn>).mockReturnValue([
      "staff@example.com",
    ]);
    setupSmtp();
  });

  afterEach(() => {
    vi.clearAllMocks();
    teardownSmtp();
  });

  it("sends two emails on success: one to staff, one to customer", async () => {
    await sendOrderNotification(SAMPLE_PAYLOAD);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("sends staff notification with order ID and total in subject", async () => {
    await sendOrderNotification(SAMPLE_PAYLOAD);
    expect(sendMailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        subject: "New Order ORD-TEST-001 — $64.98",
        to: "staff@example.com",
      })
    );
  });

  it("sends customer confirmation with order ID in subject", async () => {
    await sendOrderNotification(SAMPLE_PAYLOAD);
    expect(sendMailMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        subject: "Order Confirmation — ORD-TEST-001",
        to: "jane@example.com",
        replyTo: "info@allwindowdoorparts.com",
      })
    );
  });

  it("includes customer name in confirmation email HTML", async () => {
    await sendOrderNotification(SAMPLE_PAYLOAD);
    const customerCall = sendMailMock.mock.calls[1][0];
    expect(customerCall.html).toContain("Jane Doe");
  });

  it("includes order total in staff email HTML", async () => {
    await sendOrderNotification(SAMPLE_PAYLOAD);
    const staffCall = sendMailMock.mock.calls[0][0];
    expect(staffCall.html).toContain("ORD-TEST-001");
    expect(staffCall.html).toContain("64.98");
  });

  it("sends to multiple staff inboxes in a single call", async () => {
    (getContactForwardEmails as ReturnType<typeof vi.fn>).mockReturnValue([
      "ops@example.com",
      "orders@example.com",
    ]);
    await sendOrderNotification(SAMPLE_PAYLOAD);
    const staffCall = sendMailMock.mock.calls[0][0];
    expect(staffCall.to).toBe("ops@example.com, orders@example.com");
  });

  it("returns early without sending when SMTP_HOST is unset", async () => {
    delete process.env.SMTP_HOST;
    await sendOrderNotification(SAMPLE_PAYLOAD);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("returns early without sending when SMTP_USER is unset", async () => {
    delete process.env.SMTP_USER;
    await sendOrderNotification(SAMPLE_PAYLOAD);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("returns early without sending when SMTP_PASS is unset", async () => {
    delete process.env.SMTP_PASS;
    await sendOrderNotification(SAMPLE_PAYLOAD);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("skips staff notification when getContactForwardEmails returns empty array", async () => {
    (getContactForwardEmails as ReturnType<typeof vi.fn>).mockReturnValue([]);
    await sendOrderNotification(SAMPLE_PAYLOAD);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@example.com" })
    );
  });

  it("skips customer confirmation when customerEmail is an empty string", async () => {
    await sendOrderNotification({ ...SAMPLE_PAYLOAD, customerEmail: "" });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "staff@example.com" })
    );
  });

  it("handles missing shippingAddress gracefully", async () => {
    const { shippingAddress: _, ...noAddress } = SAMPLE_PAYLOAD;
    await expect(sendOrderNotification(noAddress as typeof SAMPLE_PAYLOAD)).resolves.not.toThrow();
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("propagates error when sendMail rejects", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("SMTP connection refused"));
    await expect(sendOrderNotification(SAMPLE_PAYLOAD)).rejects.toThrow(
      "SMTP connection refused"
    );
  });
});
