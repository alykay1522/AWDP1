import pino from "pino";

const isVercel = process.env.VERCEL === "1";

const opts: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
};

if (process.env.NODE_ENV !== "production" && !isVercel) {
  opts.transport = {
    target: "pino-pretty",
    options: { colorize: true },
  };
}

/** Vercel: sync stdout only — avoids worker/thread-stream edge cases in short-lived isolates. */
export const logger = isVercel ? pino(opts, pino.destination(1)) : pino(opts);
