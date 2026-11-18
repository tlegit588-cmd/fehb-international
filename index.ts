export interface Env {
  // Add the FEHB_D1 binding after creating the production D1 database.
  // Add R2 only when secure document storage is implemented.
}

const json = (data: unknown, status = 200): Response =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    },
  });

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        service: "FEHB International Platform API",
        status: "online",
        version: "0.1.0",
        database: "not-connected",
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Endpoint not configured yet" }, 501);
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
