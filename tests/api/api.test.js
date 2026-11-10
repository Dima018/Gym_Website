import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../../server/index.js";
import { pool, query } from "../../server/db.js";

const stamp = `${Date.now()}-${process.pid}`;
const member = {
  name: "API Test User",
  email: `api-${stamp}@example.com`,
  password: "ApiTestPass123!",
};
let token;
let userId;
let trainingId;
let bookingId;

function futureDate(days = 2) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

before(async () => {
  await query("SELECT 1");
});

after(async () => {
  if (userId)
    await query("DELETE FROM bookings WHERE user_id=$1", [userId]).catch(() => {});
  if (userId)
    await query("DELETE FROM users WHERE id=$1", [userId]).catch(() => {});
  await pool.end();
});

test("GET /api/health повертає готовність сервісу", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("GET /api/trainings повертає масив реальних даних", async () => {
  const response = await request(app).get("/api/trainings").expect(200);
  assert.ok(Array.isArray(response.body.data));
  assert.ok(response.body.data.length > 0);
  trainingId = response.body.data[0].id;
});

test("POST /api/auth/register створює member і JWT", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send(member)
    .expect(201);
  assert.equal(response.body.user.email, member.email);
  assert.equal(response.body.user.role, "member");
  assert.equal(typeof response.body.token, "string");
  token = response.body.token;
  userId = response.body.user.id;
});

test("POST /api/auth/register відхиляє дублікат email", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send(member)
    .expect(409);
  assert.match(response.body.error.message, /вже існують/i);
});

test("POST /api/auth/login відхиляє неправильний пароль", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: member.email, password: "WrongPassword!" })
    .expect(401);
  assert.match(response.body.error.message, /Неправильна/i);
});

test("GET /api/bookings вимагає Bearer token", async () => {
  await request(app).get("/api/bookings").expect(401);
});

test("POST /api/bookings перевіряє формат телефону", async () => {
  const response = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      training_id: trainingId,
      session_date: futureDate(),
      phone: "0501234567",
    })
    .expect(400);
  assert.equal(response.body.error.fields[0].field, "phone");
});

test("POST /api/bookings створює запис користувача", async () => {
  const response = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      training_id: trainingId,
      session_date: futureDate(),
      phone: "+380501234567",
      note: "API regression",
    })
    .expect(201);
  bookingId = response.body.data.id;
  assert.equal(response.headers.location, `/api/bookings/${bookingId}`);
  assert.equal(response.body.data.note, "API regression");
});

test("PATCH /api/bookings зберігає поля, яких немає у запиті", async () => {
  const response = await request(app)
    .patch(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ phone: "+380671234567" })
    .expect(200);
  assert.equal(response.body.data.phone, "+380671234567");
  assert.equal(response.body.data.note, "API regression");
});

test("звичайний користувач не може створити тренування", async () => {
  await request(app)
    .post("/api/trainings")
    .set("Authorization", `Bearer ${token}`)
    .send({})
    .expect(403);
});

test("DELETE /api/bookings видаляє власний запис", async () => {
  await request(app)
    .delete(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(204);
  await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(404);
  bookingId = undefined;
});

test("невідомий API-маршрут повертає JSON 404", async () => {
  const response = await request(app).get("/api/unknown").expect(404);
  assert.match(response.body.error.message, /не знайдено/i);
});
