const bad =
  "{\r\n" +
  '  "name": "my-vite-project",\r\n' +
  '  "version": "1.0.0",\r\n' +
  '  "private": true,\r\n' +
  '  "scripts": {\r\n' +
  '    "dev": "vite",\r\n' +
  '    "build": "vite build"\r\n' +
  '    "preview": "vite preview"\r\n' +
  "  },\r\n" +
  '  "dependencies": {\r\n' +
  '    "vue": "^3.3.0"\r\n' +
  "  }\r\n" +
  "}";
try {
  JSON.parse(bad);
} catch (e) {
  console.log(e.message);
}
