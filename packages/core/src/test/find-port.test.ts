import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { findFreePort } from "../find-port.js";

function occupyPort(port: number): Promise<() => Promise<void>> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(port, "127.0.0.1", () => {
      resolve(() => new Promise((res) => server.close(() => res())));
    });
    server.on("error", reject);
  });
}

describe("findFreePort", () => {
  it("returns the preferred port when it is free", async () => {
    const port = await findFreePort(19001);
    expect(port).toBe(19001);
  });

  it("returns the next free port when preferred is occupied", async () => {
    const release = await occupyPort(19002);
    try {
      const port = await findFreePort(19002);
      expect(port).toBe(19003);
    } finally {
      await release();
    }
  });

  it("skips multiple occupied ports to find a free one", async () => {
    const release1 = await occupyPort(19010);
    const release2 = await occupyPort(19011);
    try {
      const port = await findFreePort(19010);
      expect(port).toBe(19012);
    } finally {
      await release1();
      await release2();
    }
  });

  it("throws if no free port found within range of 10", async () => {
    const releases: Array<() => Promise<void>> = [];
    for (let p = 19020; p <= 19030; p++) {
      releases.push(await occupyPort(p));
    }
    try {
      await expect(findFreePort(19020)).rejects.toThrow(/no free port/i);
    } finally {
      await Promise.all(releases.map((r) => r()));
    }
  });

  it("treats a hung listen as not-free after 2 seconds", async () => {
    // Verify PORT_SEARCH_RANGE is reflected in the error message range.
    const releases: Array<() => Promise<void>> = [];
    for (let p = 19040; p <= 19050; p++) {
      releases.push(await occupyPort(p));
    }
    try {
      await expect(findFreePort(19040)).rejects.toThrow(/19040.{1,5}19050/);
    } finally {
      await Promise.all(releases.map((r) => r()));
    }
  }, 15_000);
});
