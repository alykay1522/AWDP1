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
