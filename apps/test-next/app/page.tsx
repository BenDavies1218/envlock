export default function Page() {
  return (
    <main>
      <h1>envlock test app</h1>
      <p>Test secret: {process.env.TEST_SECRET ?? "(not set)"}</p>
      <p>Database URL: {process.env.DATABASE_URL ?? "(not set)"}</p>
    </main>
  );
}
