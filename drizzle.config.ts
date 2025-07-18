import { defineConfig } from "drizzle-kit";
// Environment variables are loaded by dotenv-cli, so we don't need to load them here
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Ensure the database is provisioned and environment variables are loaded.");
}
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
