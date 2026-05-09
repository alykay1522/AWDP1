const fs = require("fs");
let s = fs.readFileSync(__dirname + "/package.json", "utf8");
s = s.replace('"preview": "vite preview"', '"preview": vite preview');
try {
  JSON.parse(s);
} catch (e) {
  console.log(e.message);
}
