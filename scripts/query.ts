import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { visits } from "../drizzle/schema";

async function main() {
  const connectionString = "mysql://root:VjEncCKEEnQjoPOwfPLpWIOvLHzbMvJm@sakura.proxy.rlwy.net:26201/railway";
  const connection = await mysql.createConnection(connectionString);
  const db = drizzle(connection);
  
  const allVisits = await db.select().from(visits);
  console.log(allVisits);
  
  process.exit(0);
}
main();
