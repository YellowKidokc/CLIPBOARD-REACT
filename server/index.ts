import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Hono } from "hono";
import { api } from "./routes";
import { initializeDatabase } from "./db";

initializeDatabase();

const honoApp = new Hono();
honoApp.route("/api", api);

const expressApp = express();
const httpServer = createServer(expressApp);

expressApp.use("/api", async (req: Request, res: Response) => {
  const url = `http://localhost${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      const body = Buffer.concat(chunks);
      await proxyToHono(url, req.method, headers, body.length > 0 ? body : undefined, res);
    });
    return;
  }

  await proxyToHono(url, req.method, headers, undefined, res);
});

async function proxyToHono(url: string, method: string, headers: Headers, body: any, res: Response) {
  try {
    const honoReq = new globalThis.Request(url, { method, headers, body });
    const honoRes = await honoApp.fetch(honoReq);

    res.status(honoRes.status);
    honoRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-encoding") {
        res.setHeader(key, value);
      }
    });

    if (honoRes.body) {
      const reader = honoRes.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(value);
        return pump();
      };
      await pump();
    } else {
      const text = await honoRes.text();
      res.end(text);
    }
  } catch (e) {
    console.error("Proxy error:", e);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

export function log(message: string, source = "hono") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

(async () => {
  expressApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    const { serveStatic } = await import("./static");
    serveStatic(expressApp);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, expressApp);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
