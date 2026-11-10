import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, pool } from "./db.js";
import {
  bookingSchema,
  fail,
  loginSchema,
  parse,
  parseId as id,
  registerSchema,
  trainingSchema,
} from "./validation.js";

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || !process.env.DATABASE_URL)
  throw new Error("Run npm run setup and configure .env");
export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { "upgrade-insecure-requests": null },
    },
  }),
);
app.use(express.json({ limit: "16kb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const cleanUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});
async function auth(req, _res, next) {
  const token = req.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw fail(401, "Увійдіть до облікового запису.");
  let payload;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "ritm-api",
      audience: "ritm-web",
    });
  } catch {
    throw fail(401, "Сеанс завершився. Увійдіть знову.");
  }
  const result = await query(
    "SELECT id,name,email,role FROM users WHERE id=$1",
    [id(payload.sub)],
  );
  if (!result.rowCount) throw fail(401, "Користувача не знайдено.");
  req.user = result.rows[0];
  next();
}
function admin(req, _res, next) {
  if (req.user.role !== "admin")
    throw fail(403, "Доступ лише для адміністратора.");
  next();
}
function tokenFor(user) {
  return jwt.sign({}, secret, {
    algorithm: "HS256",
    subject: String(user.id),
    issuer: "ritm-api",
    audience: "ritm-web",
    expiresIn: "1h",
  });
}
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Забагато спроб. Спробуйте через 15 хвилин." } },
});
app.get("/api/health", async (_req, res) => {
  await query("SELECT 1");
  res.json({ status: "ok" });
});
app.post("/api/auth/register", authLimit, async (req, res) => {
  const data = parse(registerSchema, req.body);
  const result = await query(
    "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",
    [data.name, data.email, await bcrypt.hash(data.password, 12)],
  );
  const user = cleanUser(result.rows[0]);
  res.status(201).json({ user, token: tokenFor(user), expires_in: 3600 });
});
app.post("/api/auth/login", authLimit, async (req, res) => {
  const data = parse(loginSchema, req.body);
  const result = await query("SELECT * FROM users WHERE email=$1", [
    data.email,
  ]);
  if (
    !result.rowCount ||
    !(await bcrypt.compare(data.password, result.rows[0].password_hash))
  )
    throw fail(401, "Неправильна пошта або пароль.");
  const user = cleanUser(result.rows[0]);
  res.json({ user, token: tokenFor(user), expires_in: 3600 });
});
app.get("/api/auth/me", auth, (req, res) =>
  res.json({ data: cleanUser(req.user) }),
);
app.get("/api/categories", async (_req, res) =>
  res.json({
    data: (await query("SELECT id,name FROM categories ORDER BY id")).rows,
  }),
);
const trainingSelect =
  "SELECT t.*,c.name AS category_name FROM trainings t JOIN categories c ON c.id=t.category_id";
app.get("/api/trainings", async (req, res) => {
  const params = [];
  let sql = trainingSelect;
  if (req.query.category_id !== undefined) {
    params.push(id(req.query.category_id));
    sql += " WHERE t.category_id=$1";
  }
  res.json({ data: (await query(sql + " ORDER BY t.id", params)).rows });
});
app.get("/api/trainings/:id", async (req, res) => {
  const r = await query(trainingSelect + " WHERE t.id=$1", [id(req.params.id)]);
  if (!r.rowCount) throw fail(404, "Тренування не знайдено.");
  res.json({ data: r.rows[0] });
});
app.post("/api/trainings", auth, admin, async (req, res) => {
  const d = parse(trainingSchema, req.body);
  const r = await query(
    "INSERT INTO trainings(category_id,name,description,duration_minutes,price_cents,image) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [
      d.category_id,
      d.name,
      d.description,
      d.duration_minutes,
      d.price_cents,
      d.image,
    ],
  );
  res
    .location("/api/trainings/" + r.rows[0].id)
    .status(201)
    .json({ data: r.rows[0] });
});
app.patch("/api/trainings/:id", auth, admin, async (req, res) => {
  const d = parse(
    trainingSchema
      .partial()
      .refine((v) => Object.keys(v).length > 0, "Немає змін."),
    req.body,
  );
  const keys = Object.keys(d);
  const r = await query(
    `UPDATE trainings SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")} WHERE id=$${keys.length + 1} RETURNING *`,
    [...Object.values(d), id(req.params.id)],
  );
  if (!r.rowCount) throw fail(404, "Тренування не знайдено.");
  res.json({ data: r.rows[0] });
});
app.delete("/api/trainings/:id", auth, admin, async (req, res) => {
  const r = await query("DELETE FROM trainings WHERE id=$1 RETURNING id", [
    id(req.params.id),
  ]);
  if (!r.rowCount) throw fail(404, "Тренування не знайдено.");
  res.status(204).end();
});
const bookingSelect = `SELECT b.id,b.user_id,b.training_id,to_char(b.session_date,'YYYY-MM-DD') AS session_date,b.phone,b.note,b.created_at,t.name AS training_name,t.price_cents,t.duration_minutes FROM bookings b JOIN trainings t ON t.id=b.training_id`;
app.get("/api/bookings", auth, async (req, res) =>
  res.json({
    data: (
      await query(
        bookingSelect + " WHERE b.user_id=$1 ORDER BY b.session_date,b.id",
        [req.user.id],
      )
    ).rows,
  }),
);
app.get("/api/bookings/:id", auth, async (req, res) => {
  const r = await query(bookingSelect + " WHERE b.id=$1 AND b.user_id=$2", [
    id(req.params.id),
    req.user.id,
  ]);
  if (!r.rowCount) throw fail(404, "Запис не знайдено.");
  res.json({ data: r.rows[0] });
});
app.post("/api/bookings", auth, async (req, res) => {
  const d = parse(bookingSchema, req.body);
  const r = await query(
    `INSERT INTO bookings(user_id,training_id,session_date,phone,note) VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [req.user.id, d.training_id, d.session_date, d.phone, d.note],
  );
  const row = (await query(bookingSelect + " WHERE b.id=$1", [r.rows[0].id]))
    .rows[0];
  res
    .location("/api/bookings/" + row.id)
    .status(201)
    .json({ data: row });
});
app.patch("/api/bookings/:id", auth, async (req, res) => {
  const d = parse(
    bookingSchema
      .extend({ note: z.string().trim().max(300).optional() })
      .partial()
      .refine((v) => Object.keys(v).length > 0, "Немає змін."),
    req.body,
  );
  const keys = Object.keys(d);
  const r = await query(
    `UPDATE bookings SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")} WHERE id=$${keys.length + 1} AND user_id=$${keys.length + 2} RETURNING id`,
    [...Object.values(d), id(req.params.id), req.user.id],
  );
  if (!r.rowCount) throw fail(404, "Запис не знайдено.");
  res.json({
    data: (await query(bookingSelect + " WHERE b.id=$1", [r.rows[0].id]))
      .rows[0],
  });
});
app.delete("/api/bookings/:id", auth, async (req, res) => {
  const r = await query(
    "DELETE FROM bookings WHERE id=$1 AND user_id=$2 RETURNING id",
    [id(req.params.id), req.user.id],
  );
  if (!r.rowCount) throw fail(404, "Запис не знайдено.");
  res.status(204).end();
});
app.use("/api", (_req, _res, next) =>
  next(fail(404, "API-маршрут не знайдено.")),
);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const dir of ["assets", "styles", "scripts"])
  app.use(
    "/" + dir,
    express.static(path.join(root, dir), { index: false, dotfiles: "deny" }),
  );
for (const page of [
  "index",
  "trainings",
  "strength-training",
  "about-gym",
  "training-signup",
  "account",
  "admin",
])
  app.get("/" + page + ".html", (_req, res) =>
    res.sendFile(path.join(root, page + ".html")),
  );
app.get("/", (_req, res) => res.sendFile(path.join(root, "index.html")));
app.use((_req, res) => res.status(404).send("Сторінку не знайдено."));
app.use((err, _req, res, _next) => {
  let status = err.status || 500,
    message = err.message;
  if (err.code === "23505") {
    status = 409;
    message =
      "Такі дані вже існують: перевірте пошту, назву або повторний запис на дату.";
  }
  if (err.code === "23503") {
    status = 409;
    message =
      "Пов’язаний запис відсутній або використовується. Перевірте категорію, тренування та наявні записи.";
  }
  if (err.code === "23514" || err.code === "22007" || err.code === "22008") {
    status = 400;
    message = "Дані не відповідають обмеженням бази.";
  }
  if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Некоректний JSON.";
  }
  if (status >= 500) {
    console.error("Request failed:", err.code || err.name);
    message = "Помилка сервера. Спробуйте пізніше.";
  }
  res
    .status(status)
    .json({
      error: { message, ...(err.fields ? { fields: err.fields } : {}) },
    });
});
export async function startServer() {
  await query("SELECT 1");
  const server = app.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
    () => console.log(`Ritm: http://localhost:${process.env.PORT || 3000}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () =>
      server.close(() => pool.end().then(() => process.exit(0))),
    );
  return server;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await startServer();
