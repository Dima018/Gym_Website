import pg from "pg";
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});
pool.on("error", (err) =>
  console.error("Database connection:", err.code || "unavailable"),
);
export const query = (sql, values = []) => pool.query(sql, values);
