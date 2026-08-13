import { Client } from "@upstash/qstash";

export class QStashErro extends Error {
  codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "QStashErro";
    this.codigo = codigo;
  }
}

export const CRON_PADRAO = "0 6 * * *";

const CAMPO_CRON =
  /^(\*|(\d{1,2}|\*)\/\d{1,2}|\d{1,2}(-\d{1,2})?)(,(\d{1,2}|\*)\/\d{1,2}|\d{1,2}(-\d{1,2})?)*$/;

export function cronValido(cron: string): boolean {
  const campos = cron.trim().split(/\s+/);
  if (campos.length !== 5) return false;
  return campos.every(c => CAMPO_CRON.test(c));
}

export function scheduleIdMonitor(hostname: string): string {
  return `monitor-${hostname.toLowerCase()}`;
}

export function obtemClienteQStash(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token });
}

function urlDoRun(): string {
  if (process.env.APP_URL) return `${process.env.APP_URL}/api/monitor/run`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/monitor/run`;
  return "";
}

export async function agendaMonitoramento(hostname: string, cron: string = CRON_PADRAO): Promise<void> {
  if (!cronValido(cron)) {
    throw new QStashErro("cron-invalido", "Expressão cron inválida. Use o formato de 5 campos (minuto hora dia mês dia-da-semana).");
  }

  const cliente = obtemClienteQStash();
  if (!cliente) {
    throw new QStashErro("qstash-nao-configurado", "QSTASH_TOKEN não está configurado — vincule o projeto no painel da Upstash.");
  }

  const destino = urlDoRun();
  if (!destino) {
    throw new QStashErro("url-nao-configurada", "APP_URL não está configurado — o QStash precisa de uma URL pública para chamar /api/monitor/run.");
  }

  await cliente.schedules.create({
    scheduleId: scheduleIdMonitor(hostname),
    destination: destino,
    cron,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostname }),
    retries: 2,
    timeout: 60,
  });
}

export async function cancelaMonitoramento(hostname: string): Promise<void> {
  const cliente = obtemClienteQStash();
  if (!cliente) return;
  await cliente.schedules.delete(scheduleIdMonitor(hostname));
}