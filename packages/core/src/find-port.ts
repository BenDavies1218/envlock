import { createServer } from "node:net";

const PORT_SEARCH_RANGE = 10;
const PORT_CHECK_TIMEOUT_MS = 2_000;

function isPortFree(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    const timer = setTimeout(() => {
      server.close();
      resolve(false);
    }, PORT_CHECK_TIMEOUT_MS);
    server.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    server.once("listening", () => {
      clearTimeout(timer);
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function findFreePort(preferred: number): Promise<number> {
  for (let port = preferred; port <= preferred + PORT_SEARCH_RANGE; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `[envlock] No free port found in range ${preferred}–${preferred + PORT_SEARCH_RANGE}.`,
  );
}
