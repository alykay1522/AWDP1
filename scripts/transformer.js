import fs from "fs";
import path from "path";
import { parse } from "json2csv";

const INPUT = path.join("data", "catalog.json");
const OUTPUT = path.join("data", "awdp_woocommerce.csv");

// WooCommerce CSV headers
const HEADERS = [
  "ID",
  "Type",
  "SKU",
  "Name",
  "Published",
  "Is featured?",
  "Visibility in catalog",
  "Short description",
  "Description",
  "Tax status",
  "Tax class",
  "In stock?",
  "Stock",
  "Backorders allowed?",
  "Sold individually?",
  "Regular price",
  "Categories",
  "Tags",
  "Images",
  "Attribute 1 name",
  "Attribute 1 value(s)",
  "Attribute 1 visible",
  "Attribute 1 global",
  "Attribute 2 name",
  "Attribute 2 value(s)",
  "Attribute 2 visible",
  "Attribute 2 global",
  "Attribute 3 name",
  "Attribute 3 value(s)",
  "Attribute 3 visible",
  "Attribute 3 global"
];

// Load scraped data
const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const products = raw.products;

// ---------------------------------------------------------
// ATTRIBUTE AGGREGATION
// ---------------------------------------------------------

const globalAttributeOptions = {}; // { Color: Set([...]), Handing: Set([...]) }

for (const p of products) {
  if (!p.attributes) continue;

  for (const [key, value] of Object.entries(p.attributes)) {
    if (!globalAttributeOptions[key]) {
      globalAttributeOptions[key] = new Set();
    }
    globalAttributeOptions[key].add(value);
  }
}

// ---------------------------------------------------------
// GROUP PRODUCTS INTO PARENT + VARIATIONS
// ---------------------------------------------------------

function groupByBaseSKU(products) {
  const groups = {};

  for (const p of products) {
    if (!p.sku) continue;

    // Example: 45054-L, 45054-R → base = 45054
    const base = p.sku.replace(/[-_][A-Za-z0-9]+$/, "");

    if (!groups[base]) groups[base] = [];
    groups[base].push(p);
  }

  return groups;
}

const grouped = groupByBaseSKU(products);

// ---------------------------------------------------------
// BUILD WOO CSV ROWS
// ---------------------------------------------------------

const rows = [];
let idCounter = 1000;

for (const [baseSKU, items] of Object.entries(grouped)) {
  const parent = items[0];

  // Build parent row
  const parentRow = {
    ID: idCounter++,
    Type: "variable",
    SKU: baseSKU,
    Name: parent.title,
    Published: 1,
    "Is featured?": 0,
    "Visibility in catalog": "visible",
    "Short description": parent.description.slice(0, 160),
    Description: parent.description,
    "Tax status": "taxable",
    "Tax class": "",
    "In stock?": 1,
    Stock: "",
    "Backorders allowed?": 0,
    "Sold individually?": 0,
    "Regular price": "",
    Categories: parent.category,
    Tags: "",
    Images: parent.images.join(","),
  };

  // Add global attributes to parent
  let attrIndex = 1;
  for (const [attrName, values] of Object.entries(globalAttributeOptions)) {
    parentRow[`Attribute ${attrIndex} name`] = attrName;
    parentRow[`Attribute ${attrIndex} value(s)`] = Array.from(values).join(" | ");
    parentRow[`Attribute ${attrIndex} visible`] = 1;
    parentRow[`Attribute ${attrIndex} global`] = 1;
    attrIndex++;
  }

  rows.push(parentRow);

  // Build variation rows
  for (const item of items) {
    const variationRow = {
      ID: idCounter++,
      Type: "variation",
      SKU: item.sku,
      Name: item.title,
      Published: 1,
      "Is featured?": 0,
      "Visibility in catalog": "visible",
      "Short description": item.description.slice(0, 160),
      Description: item.description,
      "Tax status": "taxable",
      "Tax class": "",
      "In stock?": 1,
      Stock: "",
      "Backorders allowed?": 0,
      "Sold individually?": 0,
      "Regular price": item.price ? item.price.replace("$", "") : "",
      Categories: item.category,
      Tags: "",
      Images: item.images.join(","),
    };

    // Add only the attributes that apply to this variation
    let vIndex = 1;
    for (const [attrName, value] of Object.entries(item.attributes || {})) {
      variationRow[`Attribute ${vIndex} name`] = attrName;
      variationRow[`Attribute ${vIndex} value(s)`] = value;
      variationRow[`Attribute ${vIndex} visible`] = 1;
      variationRow[`Attribute ${vIndex} global`] = 1;
      vIndex++;
    }

    rows.push(variationRow);
  }
}

// ---------------------------------------------------------
// WRITE CSV
// ---------------------------------------------------------

const csv = parse(rows, { fields: HEADERS });
fs.writeFileSync(OUTPUT, csv);

console.log(`\n🎉 WooCommerce CSV generated → ${OUTPUT}\n`);
