const JANELA_MS = 5 * 60 * 1000;
const MAX_REQUISICOES = 10;
const LIMITE_ENTRADAS = 5000;

const mapa = new Map<string, number[]>();

export function ipDaRequisicao(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const primeiro = xff.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "desconhecido";
}

export function checaRateLimit(ip: string): { permitido: boolean; retryEmSegundos: number } {
  const agora = Date.now();
  const registros = (mapa.get(ip) ?? []).filter(t => agora - t < JANELA_MS);

  if (registros.length >= MAX_REQUISICOES) {
    mapa.set(ip, registros);
    limpaEntradas(agora);
    const maisAntigo = registros[0] ?? agora;
    const retryEmSegundos = Math.max(1, Math.ceil((JANELA_MS - (agora - maisAntigo)) / 1000));
    return { permitido: false, retryEmSegundos };
  }

  registros.push(agora);
  mapa.set(ip, registros);
  limpaEntradas(agora);
  return { permitido: true, retryEmSegundos: 0 };
}

function limpaEntradas(agora: number): void {
  if (mapa.size <= LIMITE_ENTRADAS) return;
  for (const [chave, registros] of mapa) {
    if (registros.length === 0 || agora - registros[registros.length - 1]! > JANELA_MS) {
      mapa.delete(chave);
    }
  }
}
