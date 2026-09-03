# VulnexusAI — Scanner de segurança de sites

**Site:** [https://vulnexusai.com](https://vulnexusai.com) · **Blog:** [https://vulnexusai.com/blog](https://vulnexusai.com/blog)

Scanner de segurança de websites em um clique: headers HTTP, HTTPS, certificado SSL, DNS de email, cookies, CORS, arquivos sensíveis e conteúdo — com score de 0 a 100, grade A–F e dicas de correção. Gratuito, sem cadastro, em português e inglês.

Feito com [Next.js](https://nextjs.org), `next-intl` e [Upstash](https://upstash.com).

## Monitoramento contínuo (QStash + webhooks)

O scanner pode monitorar domínios continuamente: um cron do [QStash](https://upstash.com) executa `POST /api/monitor/run` no horário agendado, o site é re-verificado e, se o score cair ou algum item piorar de `ok` para `falha`, um alerta é enviado para um webhook do Discord ou Slack.

### Autenticação por Token de Dono

Para prevenir sequestro de domínios monitorados ou cancelamentos não autorizados, o monitoramento utiliza autenticação por token:

- **Criação (`POST /api/monitor`):** Ao cadastrar um novo domínio, a API gera e retorna um `token` de dono (hexadecimal de 32 bytes / 64 caracteres) com status `201`. O token é salvo exclusivamente como hash SHA-256 (`tokenHash`) no banco de dados e nunca é armazenado em texto puro.
- **Aviso:** Guarde o token com segurança! Ele é exibido **apenas uma vez** na criação e não pode ser recuperado se perdido.
- **Atualização:** Para alterar o webhook ou cron de um domínio já monitorado, envie o `token` correspondente no corpo do `POST /api/monitor`. Tentativas sem o token correto retornarão `409 Conflict` (`monitor-ja-existe`). Para gerar um novo token durante a atualização, envie `"rotacionarToken": true`.
- **Cancelamento (`DELETE /api/monitor`):** É obrigatório enviar o `token` de dono no corpo. Caso o token não seja enviado ou seja inválido, a API retornará `403 Forbidden` (`token-invalido`) sem vazar a existência do domínio.

### Env vars (Upstash)

```bash
# QStash (agendamentos do monitoramento)
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
APP_URL=https://vulnexusai.com
```

- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` e `QSTASH_NEXT_SIGNING_KEY` saem do painel da Upstash (QStash → Settings).
- `APP_URL` é a URL pública da aplicação (o Vercel preenche `VERCEL_URL` automaticamente; `APP_URL` só é necessário fora da Vercel). O QStash usa essa URL como destino do cron (`{APP_URL}/api/monitor/run`).
- Sem `QSTASH_TOKEN`, `POST /api/monitor` responde `502` com o código `qstash-nao-configurado` — o monitoramento não é criado.

### API

- `POST /api/monitor` — Cria ou atualiza o monitoramento.
  - **Criação:** `{ "url": "https://meusite.com", "webhookUrl": "...", "webhookTipo": "discord"|"slack", "cron": "0 6 * * *" }`
    - Retorna `201` com `{ "ok": true, "hostname": "...", "token": "...", "aviso": "..." }`.
  - **Atualização:** `{ "url": "https://meusite.com", "token": "...", "webhookUrl": "...", "rotacionarToken": false }`
    - Retorna `200` (ou `201` se `rotacionarToken` for `true`).
- `DELETE /api/monitor` — `{ "url": "https://meusite.com", "token": "..." }`. Remove o monitor e cancela o agendamento no QStash.
- `POST /api/monitor/run` — chamado somente pelo QStash; a assinatura é verificada com `verifySignatureAppRouter` (as chaves de assinatura são obrigatórias). O corpo `{ "hostname": "..." }` processa um domínio; sem corpo, processa todos os monitores. Sempre responde `200` ao fim da rodada para evitar re-execuções do QStash por erro de scan.
- Rate limit: `monitor` permite 5 requisições por janela de 5 minutos (mesmo padrão de `verificar`).

### Como funciona

1. `POST /api/monitor` cria/atualiza o schedule `monitor-{hostname}` no QStash e salva o monitor em Redis (`monitor:{hostname}`).
2. No horário do cron, o QStash chama `/api/monitor/run`, que executa `verificarSite` e guarda o resultado em `monitor:resultado:{hostname}`.
3. A primeira execução serve como linha de base. Nas seguintes, o score e os itens são comparados; uma queda de score ou item `ok` → `falha` dispara `enviaAlerta` no webhook configurado (Discord `{content}` / Slack `{text}`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
