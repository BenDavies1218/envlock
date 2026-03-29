let verbose = false;

export function setVerbose(flag: boolean): void {
  verbose = flag;
}

export const log = {
  debug: (msg: string): void => {
    if (verbose) process.stderr.write(`[envlock:debug] ${msg}\n`);
  },
  info: (msg: string): void => {
    process.stderr.write(`[envlock] ${msg}\n`);
  },
  warn: (msg: string): void => {
    process.stderr.write(`[envlock] Warning: ${msg}\n`);
  },
  error: (msg: string): void => {
    process.stderr.write(`[envlock] Error: ${msg}\n`);
  },
};
