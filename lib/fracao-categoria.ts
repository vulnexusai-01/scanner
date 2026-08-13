import type { ItemCheck } from "./verificador";

export function statusDosItens(itens: ItemCheck[]): number {
  if (itens.length === 0) return 0;
  const pontuados = itens.filter(i => i.status !== "aviso");
  if (pontuados.length === 0) return 100;
  const ok = pontuados.filter(i => i.status === "ok").length;
  return Math.round((ok / pontuados.length) * 100);
}

export function calculaFracaoCategoria(itens: ItemCheck[]): { ok: number; total: number; frac: number } {
  const ok = itens.filter(i => i.status === "ok").length;
  const total = itens.filter(i => i.status !== "aviso").length;
  return { ok, total, frac: statusDosItens(itens) };
}
