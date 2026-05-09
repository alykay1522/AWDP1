import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY id DESC");
    return res.status(200).json(rows);
  }

  if (req.method === "POST") {
    const data = JSON.parse(req.body || "{}");

    const result = await pool.query(
      `INSERT INTO products (name, sku, price, description, category, image)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.name, data.sku, data.price, data.description, data.category, data.image]
    );

    return res.status(201).json(result.rows[0]);
  }

  res.status(405).json({ error: "Method not allowed" });
}
