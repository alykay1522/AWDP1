/** Default staff inboxes: contact form, parts-ID, and order notifications forward here. */
const DEFAULT_FORWARD_EMAILS = "thepolak@wefixitusa.com,alyshameade.1522@gmail.com";

function isValidSingleForwardEmail(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  if (/[,;\r\n\t?&#%]/.test(s)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(s);
}

function parseForwardList(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isValidSingleForwardEmail);
}

/**
 * Staff inboxes for contact form, parts-ID requests, and order notifications.
 * Outbound mail uses the customer-facing `info@allwindowdoorparts.com` account as **from** (see `email.ts` / `emailNotifier.ts`); this list is the **to** field for staff.
 *
 * `CONTACT_FORWARD_EMAILS` — optional comma-separated override. If unset or empty, the default owner list is used.
 */
export function getContactForwardEmails(): string[] {
  const raw = process.env.CONTACT_FORWARD_EMAILS?.trim();
  const src = raw && raw.length > 0 ? raw : DEFAULT_FORWARD_EMAILS;
  const list = parseForwardList(src);
  if (list.length > 0) return list;
  return parseForwardList(DEFAULT_FORWARD_EMAILS);
}
