import { useEffect } from "react";

const REMOVE_PHRASES = [
  "Orders under $50 may require additional shipping charges — we'll contact you before processing",
  "Orders under $50 may require additional shipping. We'll contact you before processing.",
];

const REPLACEMENTS: Array<[string, string]> = [
  [
    "Our minimum order is $50. Orders below $50 may require additional handling charges and we will contact you before processing.",
    "Our minimum merchandise order is $50. Checkout is available once the cart subtotal reaches $50.",
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

function cleanLegacyCopy() {
  if (!document.body) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null;

  while ((current = walker.nextNode())) textNodes.push(current as Text);

  for (const node of textNodes) {
    const value = node.nodeValue ?? "";
    const removePhrase = REMOVE_PHRASES.find((phrase) => value.includes(phrase));

    if (removePhrase) {
      const parent = node.parentElement;
      const alert = parent?.closest(".bg-amber-50, .bg-amber-500\\/20");
      (alert ?? parent)?.remove();
      continue;
    }

    let updated = value;
    for (const [oldText, newText] of REPLACEMENTS) {
      updated = updated.replaceAll(oldText, newText);
    }
    if (updated !== value) node.nodeValue = updated;
  }

  addFullFaqLink();
}

export function SiteCopyCleanup() {
  useEffect(() => {
    cleanLegacyCopy();
    const observer = new MutationObserver(cleanLegacyCopy);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
