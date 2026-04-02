import { Resend } from "resend";

const OWNER_EMAIL = "Info@AllWindowDoorParts.com";
const FROM_EMAIL = "orders@allwindowdoorparts.com";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — skipping email");
    return null;
  }
  return new Resend(key);
}

interface OrderItem {
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

interface OrderEmailPayload {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  items: OrderItem[];
  subtotal: string;
  total: string;
  paymentMethod: "stripe" | "paypal";
}

function formatAddress(addr?: OrderEmailPayload["shippingAddress"]): string {
  if (!addr) return "Not provided";
  const parts = [addr.line1];
  if (addr.line2) parts.push(addr.line2);
  parts.push(`${addr.city}, ${addr.state} ${addr.postal_code}`);
  parts.push(addr.country);
  return parts.join("<br>");
}

function buildOwnerHtml(o: OrderEmailPayload): string {
  const itemRows = o.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.sku}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e293b">
  <div style="background:#1e3a8a;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">New Order Received</h1>
    <p style="color:#bfdbfe;margin:6px 0 0">All Window Door Parts</p>
  </div>
  <div style="padding:24px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="padding:8px 0"><strong>Order ID:</strong></td>
        <td style="padding:8px 0">${o.orderId}</td>
      </tr>
      <tr>
        <td style="padding:8px 0"><strong>Payment via:</strong></td>
        <td style="padding:8px 0;text-transform:capitalize">${o.paymentMethod}</td>
      </tr>
      <tr>
        <td style="padding:8px 0"><strong>Customer Name:</strong></td>
        <td style="padding:8px 0">${o.customerName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0"><strong>Customer Email:</strong></td>
        <td style="padding:8px 0"><a href="mailto:${o.customerEmail}">${o.customerEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:8px 0"><strong>Phone:</strong></td>
        <td style="padding:8px 0">${o.customerPhone || "Not provided"}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;vertical-align:top"><strong>Ship To:</strong></td>
        <td style="padding:8px 0">${formatAddress(o.shippingAddress)}</td>
      </tr>
    </table>

    <h3 style="border-bottom:2px solid #1e3a8a;padding-bottom:8px">Order Items</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:8px;text-align:left">Product</th>
          <th style="padding:8px;text-align:center">SKU</th>
          <th style="padding:8px;text-align:center">Qty</th>
          <th style="padding:8px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px">Order Total:</td>
          <td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px;color:#1e3a8a">$${o.total}</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top:24px;padding:16px;background:#fef9c3;border-left:4px solid #f59e0b;border-radius:4px">
      <strong>Action Required:</strong> Review and fulfill this order. Reply to the customer at 
      <a href="mailto:${o.customerEmail}">${o.customerEmail}</a>.
    </div>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#64748b">
    All Window Door Parts &mdash; 785-533-0244 &mdash; ${OWNER_EMAIL}
  </div>
</body>
</html>`;
}

function buildCustomerHtml(o: OrderEmailPayload): string {
  const itemRows = o.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e293b">
  <div style="background:#1e3a8a;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">Thank You for Your Order!</h1>
    <p style="color:#bfdbfe;margin:6px 0 0">All Window Door Parts</p>
  </div>
  <div style="padding:24px">
    <p>Hi ${o.customerName || "Valued Customer"},</p>
    <p>We've received your order and will be in touch shortly to confirm shipping details.</p>

    <table style="width:100%;border-collapse:collapse;margin:4px 0 16px;background:#f8fafc;border-radius:6px">
      <tr><td style="padding:8px"><strong>Order ID:</strong></td><td style="padding:8px">${o.orderId}</td></tr>
    </table>

    <h3 style="border-bottom:2px solid #1e3a8a;padding-bottom:8px">Your Items</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:8px;text-align:left">Product</th>
          <th style="padding:8px;text-align:center">Qty</th>
          <th style="padding:8px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:12px 8px;text-align:right;font-weight:bold">Order Total:</td>
          <td style="padding:12px 8px;text-align:right;font-weight:bold;color:#1e3a8a">$${o.total}</td>
        </tr>
      </tfoot>
    </table>

    <p style="margin-top:24px">Questions about your order? Contact us:</p>
    <ul style="margin:8px 0;padding-left:20px">
      <li><strong>Phone:</strong> <a href="tel:785-533-0244">785-533-0244</a> (Mon-Fri 8am-5pm CST)</li>
      <li><strong>Email:</strong> <a href="mailto:${OWNER_EMAIL}">${OWNER_EMAIL}</a></li>
    </ul>
    <p>Thank you for choosing All Window Door Parts — veteran owned and operated with 40+ years of experience.</p>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#64748b">
    All Window Door Parts &mdash; 785-533-0244 &mdash; ${OWNER_EMAIL}
  </div>
</body>
</html>`;
}

export async function sendOrderNotification(payload: OrderEmailPayload): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const subject = `New Order ${payload.orderId} — $${payload.total}`;

  // Send owner notification
  const ownerResult = await resend.emails.send({
    from: `All Window Door Parts Orders <${FROM_EMAIL}>`,
    to: [OWNER_EMAIL],
    subject,
    html: buildOwnerHtml(payload),
  });

  if (ownerResult.error) {
    console.error("[email] Failed to send owner notification:", ownerResult.error);
  } else {
    console.log("[email] Owner notification sent:", ownerResult.data?.id);
  }

  // Send customer confirmation if we have their email
  if (payload.customerEmail) {
    const customerResult = await resend.emails.send({
      from: `All Window Door Parts <${FROM_EMAIL}>`,
      to: [payload.customerEmail],
      replyTo: OWNER_EMAIL,
      subject: `Order Confirmation — ${payload.orderId}`,
      html: buildCustomerHtml(payload),
    });

    if (customerResult.error) {
      console.error("[email] Failed to send customer confirmation:", customerResult.error);
    } else {
      console.log("[email] Customer confirmation sent:", customerResult.data?.id);
    }
  }
}
