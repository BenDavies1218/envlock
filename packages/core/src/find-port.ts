import { createServer } from "node:net";

const PORT_SEARCH_RANGE = 10;
const PORT_CHECK_TIMEOUT_MS = 2_000;

function isPortFree(port: number): Promise<boolean> {
  return Promise.race([
    new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => server.close(() => resolve(true)));
      server.listen(port, "127.0.0.1");
    }),
    new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), PORT_CHECK_TIMEOUT_MS),
    ),
  ]);
}

export async function findFreePort(preferred: number): Promise<number> {
  for (let port = preferred; port <= preferred + PORT_SEARCH_RANGE; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `[envlock] No free port found in range ${preferred}–${preferred + PORT_SEARCH_RANGE}.`,
  );
}
