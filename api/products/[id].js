import fs from 'fs';
import path from 'path';

const productsPath = path.join(process.cwd(), 'products.json');

export default function handler(req, res) {
  const { id } = req.query;
  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

  if (req.method === 'PUT') {
    const index = products.findIndex(p => p.id == id);
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    
    products[index] = { ...products[index], ...req.body };
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const filtered = products.filter(p => p.id != id);
    fs.writeFileSync(productsPath, JSON.stringify(filtered, null, 2));
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
