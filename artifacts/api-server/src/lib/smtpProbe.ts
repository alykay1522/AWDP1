import net from "node:net";

export function probeSmtpPort(port: number, timeoutMs = 4500): Promise<{
  configured: boolean;
  ok: boolean;
  port: number;
  errorCode?: string;
}> {
  const host = process.env.SMTP_HOST;
  if (!host) return Promise.resolve({ configured: false, ok: false, port, errorCode: "NOT_CONFIGURED" });

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (result: { configured: boolean; ok: boolean; port: number; errorCode?: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs, () => finish({ configured: true, ok: false, port, errorCode: "ETIMEDOUT" }));
    socket.once("connect", () => finish({ configured: true, ok: true, port }));
    socket.once("error", (error: NodeJS.ErrnoException) => {
      finish({ configured: true, ok: false, port, errorCode: error.code || "ECONNECTION" });
    });
  });
}
