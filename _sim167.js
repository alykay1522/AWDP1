const fs = require("fs");
let s = fs.readFileSync(__dirname + "/package.json", "utf8");
s = s.replace(/\r\n/g, "\n");
s = s.replace('"vite build",', '"vite build"');
try {
  JSON.parse(s);
} catch (e) {
  console.log(e.message);
}
