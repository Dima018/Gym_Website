import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingSchema,
  dateSchema,
  parse,
  parseId,
  passwordSchema,
  registerSchema,
  trainingSchema,
} from "../../server/validation.js";

function futureDate(days = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("parseId приймає додатний PostgreSQL integer", () => {
  assert.equal(parseId("2147483647"), 2147483647);
});

test("parseId відхиляє нуль, дроби та ін'єкції", () => {
  for (const value of ["0", "1.5", "1 OR 1=1", "2147483648"])
    assert.throws(() => parseId(value), { status: 400 });
});

test("реєстрація нормалізує ім'я та email", () => {
  const data = parse(registerSchema, {
    name: "  Дмитро  ",
    email: "  TEST@EXAMPLE.COM ",
    password: "StrongPass123!",
  });
  assert.equal(data.name, "Дмитро");
  assert.equal(data.email, "test@example.com");
});

test("пароль коротший за 12 символів відхиляється", () => {
  assert.equal(passwordSchema.safeParse("Short1!").success, false);
});

test("bcrypt-сумісна межа пароля не перевищує 72 байти", () => {
  assert.equal(passwordSchema.safeParse("я".repeat(37)).success, false);
  assert.equal(passwordSchema.safeParse("a".repeat(72)).success, true);
});

test("невідома властивість реєстрації відхиляється", () => {
  assert.throws(
    () =>
      parse(registerSchema, {
        name: "Дмитро",
        email: "test@example.com",
        password: "StrongPass123!",
        role: "admin",
      }),
    { status: 400 },
  );
});

test("дата запису приймається в межах одного року", () => {
  assert.equal(dateSchema.safeParse(futureDate(1)).success, true);
});

test("неіснуюча календарна дата відхиляється", () => {
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
});

test("минула дата запису відхиляється", () => {
  assert.equal(dateSchema.safeParse("2020-01-01").success, false);
});

test("телефон приймається лише у форматі +380 і 9 цифр", () => {
  const valid = {
    training_id: 1,
    session_date: futureDate(),
    phone: "+380501234567",
  };
  assert.equal(bookingSchema.safeParse(valid).success, true);
  assert.equal(
    bookingSchema.safeParse({ ...valid, phone: "0501234567" }).success,
    false,
  );
});

test("порожня примітка до запису отримує безпечне значення", () => {
  const result = bookingSchema.parse({
    training_id: 1,
    session_date: futureDate(),
    phone: "+380501234567",
  });
  assert.equal(result.note, "");
});

test("тренування перевіряє мінімальну тривалість і ціну", () => {
  const training = {
    category_id: 1,
    name: "Тест",
    description: "Повний тестовий опис",
    duration_minutes: 14,
    price_cents: -1,
    image: "strength.png",
  };
  const result = trainingSchema.safeParse(training);
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path[0]),
    ["duration_minutes", "price_cents"],
  );
});
