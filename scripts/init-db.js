import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { pool } from "../server/db.js";
const client = await pool.connect();
try {
  await client.query(
    await readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
  );
  await client.query("BEGIN");
  const categories = ["Сила", "Витривалість", "Рухливість"];
  for (const name of categories)
    await client.query(
      "INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING",
      [name],
    );
  const items = [
    [
      "Силове тренування",
      "Сила",
      "Вправи з гантелями, штангою та на тренажерах. Тренер допоможе підібрати навантаження.",
      60,
      25000,
      "strength.png",
    ],
    [
      "Кардіо",
      "Витривалість",
      "Бігова доріжка, велотренажер і рух у зручному темпі.",
      45,
      20000,
      "cardio.png",
    ],
    [
      "Йога",
      "Рухливість",
      "Спокійні вправи на рівновагу, дихання та рухливість.",
      60,
      22000,
      "yoga.png",
    ],
    [
      "Бокс",
      "Витривалість",
      "Робота з грушею, базові удари та вправи на координацію.",
      60,
      28000,
      "boxing.png",
    ],
    [
      "Стретчинг",
      "Рухливість",
      "Плавна розтяжка та вправи на гнучкість.",
      45,
      20000,
      "stretch.png",
    ],
    [
      "Персональне заняття",
      "Сила",
      "Індивідуальна робота з тренером відповідно до твоєї мети.",
      60,
      50000,
      "personal.png",
    ],
  ];
  for (const [name, category, description, duration, price, image] of items) {
    await client.query(
      `INSERT INTO trainings(name,category_id,description,duration_minutes,price_cents,image)
      VALUES($1,(SELECT id FROM categories WHERE name=$2),$3,$4,$5,$6) ON CONFLICT(name) DO NOTHING`,
      [name, category, description, duration, price, image],
    );
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    password = process.env.ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (12–72 bytes) in .env");
  await client.query(
    `INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') ON CONFLICT(email) DO NOTHING`,
    ["Адміністратор Ритм", email, await bcrypt.hash(password, 12)],
  );
  await client.query("COMMIT");
  console.log("Schema and seed ready. Existing records were preserved.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
