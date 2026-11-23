export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
}

const allowedOrigins = (env: Env): Set<string> =>
  new Set((env.ALLOWED_ORIGIN || "").split(",").map((value) => value.trim()).filter(Boolean));

const headersFor = (request: Request, env: Env): Headers => {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Vary": "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, X-Bootstrap-Secret");
  }
  return headers;
};

const json = (request: Request, env: Env, data: unknown, status = 200): Response =>
  Response.json(data, { status, headers: headersFor(request, env) });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: headersFor(request, env) });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      try {
        await env.DB.prepare("SELECT 1 AS connected").first();
        return json(request, env, {
          service: "FEHB International Platform API",
          status: "online",
          version: "0.2.0",
          database: "connected",
        });
      } catch {
        return json(request, env, {
          service: "FEHB International Platform API",
          status: "degraded",
          version: "0.2.0",
          database: "unavailable",
        }, 503);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json(request, env, { error: "This API endpoint is not implemented yet." }, 501);
    }

    return json(request, env, { error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
