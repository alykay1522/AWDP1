const NUM_TO_LETTER: Record<string, string> = {
  "1": "P", "2": "R", "3": "O", "4": "F", "5": "I",
  "6": "T", "7": "A", "8": "B", "9": "L", "0": "E",
};

const LETTER_TO_NUM: Record<string, string> = {
  P: "1", R: "2", O: "3", F: "4", I: "5",
  T: "6", A: "7", B: "8", L: "9", E: "0",
};

export function applySkuCipher(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .map((char) => NUM_TO_LETTER[char] ?? LETTER_TO_NUM[char] ?? char)
    .join("");
}

export function buildSku(originalSku: string): string {
  const clean = originalSku.trim();
  if (clean.toUpperCase().startsWith("AWDP-")) return clean.toUpperCase();
  return `AWDP-${applySkuCipher(clean)}`;
}
