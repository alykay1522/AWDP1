const fs = require("fs");
const orig = fs.readFileSync(__dirname + "/package.json", "utf8");

const mutations = [
  ["no comma after build", () => orig.replace('"vite build",', '"vite build"')],
  [
    "no comma after dev",
    () => orig.replace('"dev": "vite",', '"dev": "vite"'),
  ],
  [
    "trailing comma after engines value",
    () => orig.replace('"node": ">=18"\r\n  }', '"node": ">=18",\r\n  }'),
  ],
];

for (const [name, fn] of mutations) {
  const s = fn();
  try {
    JSON.parse(s);
    console.log(name, "-> unexpectedly ok");
  } catch (e) {
    const m = e.message.match(/position (\d+)/);
    console.log(name, "->", m ? m[1] : e.message);
  }
}
