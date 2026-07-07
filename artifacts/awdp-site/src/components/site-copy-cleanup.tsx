import { useEffect } from "react";

const REMOVE_PHRASES = [
  "Orders under $50 may require additional shipping charges — we'll contact you before processing",
  "Orders under $50 may require additional shipping. We'll contact you before processing.",
  "Shipping calculated at checkout",
  "Fast shipping",
  "Ships fast",
  "Ships quickly",
  "Usually ships",
  "Lead time",
  "lead time",
  "business days",
  "Delivery estimate",
  "delivery estimate",
];

const STOCK_STATUS_PHRASES = [
  "In Stock",
  "Out of Stock",
  "Temporarily Out of Stock",
  "Backordered",
];

const REPLACEMENTS: Array<[string, string]> = [
  [
    "Our minimum order is $50. Orders below $50 may require additional handling charges and we will contact you before processing.",
    "Our minimum merchandise order is $50. Checkout is available once the cart subtotal reaches $50.",
  ],
  [
    "In stock at All Window Door Parts. Veteran-owned, 40+ years experience. Free Parts ID service available.",
    "Available from All Window Door Parts. Veteran-owned, 40+ years experience. Free Parts ID service available.",
  ],
];

function addFullFaqLink() {
  if (window.location.pathname !== "/") return;
  if (document.querySelector('[data-full-faq-link="true"]')) return;

  const heading = Array.from(document.querySelectorAll("h1, h2, h3"))
    .find((element) => element.textContent?.trim() === "Frequently Asked Questions");
  const section = heading?.closest("section");
  const container = section?.querySelector(".max-w-3xl") ?? section?.querySelector(".container") ?? section;
  if (!container) return;

  const wrapper = document.createElement("div");
  wrapper.dataset.fullFaqLink = "true";
  wrapper.className = "mt-8 text-center";

  const link = document.createElement("a");
  link.href = "/faq";
  link.className = "inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90";
  link.textContent = "View All Frequently Asked Questions";

  wrapper.appendChild(link);
  container.appendChild(wrapper);
}

function removeCopyNode(node: Text) {
  const parent = node.parentElement;
  const removable = parent?.closest("tr, li, p, .bg-amber-50, .bg-amber-500\\/20, .rounded, .rounded-md, .rounded-lg, .rounded-xl, span, div");
  (removable ?? parent)?.remove();
}

function normalizeActionButtons() {
  for (const button of Array.from(document.querySelectorAll("button"))) {
    const text = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (STOCK_STATUS_PHRASES.some((phrase) => text.includes(phrase))) {
      button.removeAttribute("disabled");
      button.removeAttribute("aria-disabled");
      button.textContent = "Add to Cart";
    }
  }
}

function cleanLegacyCopy() {
  if (!document.body) return;

  // Do not mutate admin pages; internal stock/import controls still need their labels.
  if (window.location.pathname.startsWith("/admin")) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null;

  while ((current = walker.nextNode())) textNodes.push(current as Text);

  for (const node of textNodes) {
    const value = node.nodeValue ?? "";
    const trimmed = value.replace(/\s+/g, " ").trim();
    const removePhrase = REMOVE_PHRASES.find((phrase) => value.includes(phrase));
    const removeStockStatus = STOCK_STATUS_PHRASES.some((phrase) => trimmed === phrase || trimmed.includes(phrase));

    if (removePhrase || removeStockStatus) {
      removeCopyNode(node);
      continue;
    }

    let updated = value;
    for (const [oldText, newText] of REPLACEMENTS) {
      updated = updated.replaceAll(oldText, newText);
    }
    if (updated !== value) node.nodeValue = updated;
  }

  normalizeActionButtons();
  addFullFaqLink();
}

export function SiteCopyCleanup() {
  useEffect(() => {
    cleanLegacyCopy();
    const observer = new MutationObserver(cleanLegacyCopy);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "aria-disabled"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
