import { log } from "./logger.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

function isTTY(): boolean {
  return !!process.stderr.isTTY;
}

let timer: ReturnType<typeof setInterval> | null = null;
let frameIndex = 0;

export const spinner = {
  start(msg: string): void {
    if (!isTTY()) return;
    frameIndex = 0;
    process.stderr.write(`\r${FRAMES[0]!} ${msg}`);
    frameIndex = 1;
    timer = setInterval(() => {
      const frame = FRAMES[frameIndex % FRAMES.length]!;
      process.stderr.write(`\r${frame} ${msg}`);
      frameIndex++;
    }, INTERVAL_MS);
  },

  stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (!isTTY()) return;
    process.stderr.write("\r\x1b[K");
  },

  fail(msg: string): void {
    this.stop();
    log.error(msg);
  },
};
