import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { verificarSite } from "@/lib/verificador";
import { comparaResultados, leMonitor, leUltimoResultado, listaMonitores, salvaUltimoResultado } from "@/lib/monitor";
import { enviaAlerta } from "@/lib/webhook";

export const maxDuration = 60;

function temChavesAssinatura(): boolean {
  return Boolean(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY);
}

let roteadorVerificado: ReturnType<typeof verifySignatureAppRouter> | null = null;

function obtemRoteadorVerificado(): ReturnType<typeof verifySignatureAppRouter> {
  if (!roteadorVerificado) {
    roteadorVerificado = verifySignatureAppRouter(roteador);
  }
  return roteadorVerificado;
}

const roteador = async (request: Request) => {
  let hostname: string | null = null;
  try {
    const corpo = await request.json();
    if (typeof corpo.hostname === "string" && corpo.hostname.trim()) {
      hostname = corpo.hostname.trim().toLowerCase();
    }
  } catch {
    // corpo ausente ou inválido: processa todos os monitores
  }

  const monitores = await listaMonitores();
  const alvos =
    hostname !== null
      ? [{ monitor: await leMonitor(hostname), hostname }]
      : monitores.map(m => ({ monitor: m, hostname: m.hostname }));

  if (alvos.length === 0) {
    return new Response(JSON.stringify({ processados: 0 }), { status: 200 });
  }

  const comErro: string[] = [];
  for (const alvo of alvos) {
    try {
      const resultado = await verificarSite(alvo.hostname);
      const anterior = await leUltimoResultado(alvo.hostname);
      await salvaUltimoResultado(alvo.hostname, resultado);

      // Primeira execução apenas registra a linha de base — sem alerta.
      if (anterior) {
        const comparacao = comparaResultados(anterior, resultado);
        if ((comparacao.scoreCaiu || comparacao.itensPioraram.length > 0) && alvo.monitor) {
          await enviaAlerta({
            monitor: alvo.monitor,
            resultado,
            anterior,
            itensPioraram: comparacao.itensPioraram,
          });
        }
      }
    } catch (erro) {
      console.error(`[monitor] Falha ao verificar ${alvo.hostname}:`, erro);
      comErro.push(alvo.hostname);
    }
  }

  // Sempre 200 após concluir a rodada: o QStash não deve re-executar a rodada por erro de scan.
  return Response.json({ processados: alvos.length, comErro }, { status: 200 });
};

export async function POST(request: Request) {
  if (!temChavesAssinatura()) {
    return Response.json(
      {
        erro: "QStash não configurado: defina QSTASH_CURRENT_SIGNING_KEY e QSTASH_NEXT_SIGNING_KEY.",
        codigo: "qstash-nao-configurado",
      },
      { status: 503 }
    );
  }
  return obtemRoteadorVerificado()(request);
}