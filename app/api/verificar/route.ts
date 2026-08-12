import { NextRequest } from "next/server";
import { verificarSite } from "@/lib/verificador";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : "";
  if (!url.trim()) {
    return Response.json({ erro: "Informe uma URL." }, { status: 400 });
  }

  try {
    const resultado = await verificarSite(url);
    return Response.json(resultado);
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Falha ao verificar o site.";
    return Response.json({ erro: mensagem }, { status: 422 });
  }
}
