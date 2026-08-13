import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "sem-content-type";
  try {
    const body = await request.text();
    console.error(`[csp-report] (${contentType}) ${body}`);
  } catch (err) {
    console.error("[csp-report] erro ao ler corpo da requisição:", err);
  }
  return new Response(null, { status: 204 });
}
