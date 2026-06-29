const fs = require("fs");
const path = require("path");

const siteRoot = path.join(__dirname, "artifacts", "awdp-site");
const partsRoot = path.join(siteRoot, "banner-upload");

function text(name) {
  return fs.readFileSync(path.join(partsRoot, name), "utf8").trim();
}

function fromCodes(name) {
  return Buffer.from(text(name).split(",").filter(Boolean).map(Number)).toString("utf8");
}

function reverse(value) {
  return value.split("").reverse().join("");
}

const base64 = [
  text("webp-test-1500.txt"),
  text("webp-test-2000.txt"),
  text("webp-test-2500.txt"),
  text("webp-test-3000.txt"),
  text("webp-test-3500.txt"),
  text("webp-tail-00.txt"),
  text("webp-tail-01a.txt"),
  text("webp-tail-01b.txt"),
  text("webp-tail-02.txt"),
  text("webp-tail-03.txt"),
  text("webp-tail-04.txt"),
  text("webp-tail-05a.txt"),
  text("webp-tail-05b.txt"),
  text("webp-tail-06.txt"),
  text("webp-tail-07.txt"),
  text("webp-tail-08.txt"),
  reverse(text("webp-tail-09rev.txt")),
  reverse(text("webp-tail-10rev.txt")),
  reverse(text("webp-tail-11reva.txt") + text("webp-tail-11revb.txt")),
  reverse(text("webp-tail-12reva.txt") + text("webp-tail-12revb-1.txt") + text("webp-tail-12revb-2.txt")),
  reverse(fromCodes("webp-tail-13rev-codes.txt")),
  reverse(text("webp-tail-14reva.txt") + text("webp-tail-14revb.txt")),
  reverse(fromCodes("webp-tail-15reva-codes.txt") + text("webp-tail-15revb.txt")),
  reverse(text("webp-tail-16reva.txt") + text("webp-tail-16revb.txt")),
  reverse(fromCodes("webp-tail-17reva-codes.txt") + text("webp-tail-17revb.txt")),
  reverse(text("webp-tail-18reva.txt") + text("webp-tail-18revb.txt")),
  reverse(text("webp-tail-19reva.txt") + text("webp-tail-19revb.txt")),
].join("");

const bytes = Buffer.from(base64, "base64");
const valid = bytes.length === 61393 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
if (!valid) throw new Error(`Header artwork reconstruction failed (${bytes.length} bytes)`);

const output = path.join(siteRoot, "public", "assets", "header_bg.webp");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, bytes);
console.log(`[header] Installed approved artwork (${bytes.length} bytes)`);
