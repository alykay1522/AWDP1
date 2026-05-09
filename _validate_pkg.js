const fs = require("fs");
const path = require("path");

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === "node_modules" || name.name === ".git") continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else if (name.name === "package.json") acc.push(p);
  }
  return acc;
}

const root = path.join(__dirname);
for (const p of walk(root)) {
  const rel = path.relative(root, p);
  const s = fs.readFileSync(p, "utf8");
  try {
    JSON.parse(s);
  } catch (e) {
    console.log("FAIL", rel);
    console.log(e.message);
    const m = e.message.match(/position (\d+)/);
    if (m) {
      const pos = +m[1];
      console.log("around:", JSON.stringify(s.slice(Math.max(0, pos - 30), pos + 30)));
    }
  }
}
