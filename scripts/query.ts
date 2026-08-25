import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { visits } from "../drizzle/schema";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is required (set it in .env)");
    process.exit(1);
  }
  const connection = await mysql.createConnection(connectionString);
  const db = drizzle(connection);

  const allVisits = await db.select().from(visits);
  console.log(allVisits);

  process.exit(0);
}
main();
