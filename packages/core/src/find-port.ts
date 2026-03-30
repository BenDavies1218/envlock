import { createServer } from "node:net";

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

export async function findFreePort(preferred: number): Promise<number> {
  for (let port = preferred; port <= preferred + 10; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `[envlock] No free port found in range ${preferred}–${preferred + 10}.`,
  );
}
