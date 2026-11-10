import { z } from "zod";

export const fail = (status, message) =>
  Object.assign(new Error(message), { status });

export function parseId(value) {
  const number = Number(value);
  if (
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > 2147483647
  )
    throw fail(400, "Некоректний ідентифікатор.");
  return number;
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(12)
  .refine(
    (value) => Buffer.byteLength(value) <= 72,
    "Пароль має містити не більше 72 байтів.",
  );

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(100),
  })
  .strict();

export const trainingSchema = z
  .object({
    category_id: z.number().int().positive().max(2147483647),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(10).max(2000),
    duration_minutes: z.number().int().min(15).max(240),
    price_cents: z.number().int().min(0).max(1000000),
    image: z.enum([
      "strength.png",
      "cardio.png",
      "yoga.png",
      "boxing.png",
      "stretch.png",
      "personal.png",
    ]),
  })
  .strict();

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value;
  }, "Некоректна дата.")
  .refine((value) => {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return value >= today && value <= end.toISOString().slice(0, 10);
  }, "Оберіть дату від сьогодні до року вперед.");

export const bookingSchema = z
  .object({
    training_id: z.number().int().positive().max(2147483647),
    session_date: dateSchema,
    phone: z.string().regex(/^\+380[0-9]{9}$/),
    note: z.string().trim().max(300).default(""),
  })
  .strict();

export function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const error = fail(400, "Перевірте заповнення полів.");
    error.fields = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw error;
  }
  return result.data;
}
