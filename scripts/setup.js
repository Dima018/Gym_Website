import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; left unchanged.");
} else {
  const db = randomBytes(24).toString("hex");
  const admin = randomBytes(18).toString("base64url");
  writeFileSync(
    ".env",
    `PORT=3000\nHOST=127.0.0.1\nPOSTGRES_DB=ritm\nPOSTGRES_USER=ritm\nPOSTGRES_PASSWORD=${db}\nDATABASE_URL=postgresql://ritm:${db}@127.0.0.1:54329/ritm\nJWT_SECRET=${randomBytes(48).toString("hex")}\nADMIN_EMAIL=admin@ritm.local\nADMIN_PASSWORD=${admin}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Created .env with random secrets. Administrator credentials are in ADMIN_EMAIL / ADMIN_PASSWORD. Do not commit .env.",
  );
}
