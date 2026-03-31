console.log("Environment:", process.env.NODE_ENV);
console.log("Test secret:", process.env.TEST_SECRET ?? "(not set)");
console.log("Database URL:", process.env.DATABASE_URL ?? "(not set)");

console.log("\nAll ENVLOCK_ vars:");
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("ENVLOCK_") || key.startsWith("DOTENV_")) {
    console.log(`  ${key}=${value}`);
  }
}
