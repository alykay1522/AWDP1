const fs = require("fs");
let s = fs.readFileSync(__dirname + "/package.json", "utf8");
s = s.replace('"vue": "^3.3.0"\r\n  },', '"vue": "^3.3.0",\r\n  },');
try {
  JSON.parse(s);
} catch (e) {
  console.log(e.message);
}
