#!/usr/bin/env node

/**
 * Smoke test do fluxo de token de dono do monitoramento (/api/monitor).
 * Executa 6 passos contra produção (ou BASE_URL configurado) para validar:
 * 1. Criação com geração de token único (201)
 * 2. Bloqueio de colisão/sequestro sem token (409 monitor-ja-existe)
 * 3. Atualização permitida com token correto (200)
 * 4. Rejeição de exclusão com token inválido (403 token-invalido)
 * 5. Exclusão bem-sucedida com token correto (200)
 * 6. Rejeição de exclusão após remoção / idempotência (403 token-invalido)
 */

const BASE_URL = process.env.BASE_URL || "https://vulnexusai.com";
const DELAY_MS = 600; // Delay entre chamadas para respeitar rate-limit

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function executaRequisicao(metodo, endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      // Se não for JSON, mantém null
    }

    return {
      status: res.status,
      ok: res.ok,
      data: json,
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      erro: err.message,
    };
  }
}

async function runSmokeTests() {
  const idUnico = `smoketest-${Date.now()}`;
  const testHost = `${idUnico}.exemplo.com`;
  const testUrl = `https://${testHost}`;
  const dummyWebhook = "https://httpbin.org/post";

  console.log("==================================================");
  console.log("🚀 Iniciando Smoke Test: Monitoramento com Token de Dono");
  console.log(`🌐 Alvo: ${BASE_URL}`);
  console.log(`🎯 Hostname de Teste: ${testHost}`);
  console.log("==================================================\n");

  let passosPassaram = 0;
  const totalPassos = 6;
  let tokenSalvo = null;

  // Passo 1: POST /api/monitor (Criar novo monitor)
  {
    console.log("▶ Passo 1: POST /api/monitor (Criação de novo monitor)");
    const { status, data, erro } = await executaRequisicao("POST", "/api/monitor", {
      url: testUrl,
      webhookUrl: dummyWebhook,
      webhookTipo: "discord",
    });

    const statusEsperado = 201;
    const temToken = typeof data?.token === "string" && data.token.length > 0;
    const hostnameBate = data?.hostname === testHost;
    const passou = status === statusEsperado && temToken && hostnameBate;

    console.log(`   Status HTTP: ${status} (Esperado: ${statusEsperado})`);
    console.log(`   Resposta:`, data || erro);

    if (passou) {
      tokenSalvo = data.token;
      console.log(`   Token obtido: ${tokenSalvo.slice(0, 8)}... (${tokenSalvo.length} chars)`);
      console.log("   Resultado: ✅ PASSOU\n");
      passosPassaram++;
    } else {
      console.log("   Resultado: ❌ FALHOU\n");
    }
  }

  await sleep(DELAY_MS);

  // Passo 2: POST /api/monitor sem token (Tentativa de sobrescrita/sequestro)
  {
    console.log("▶ Passo 2: POST /api/monitor (Tentativa de sobrescrita sem token)");
    const { status, data, erro } = await executaRequisicao("POST", "/api/monitor", {
      url: testUrl,
      webhookUrl: dummyWebhook,
      webhookTipo: "discord",
    });

    const statusEsperado = 409;
    const codigoEsperado = "monitor-ja-existe";
    const passou = status === statusEsperado && data?.codigo === codigoEsperado;

    console.log(`   Status HTTP: ${status} (Esperado: ${statusEsperado})`);
    console.log(`   Código de Erro: "${data?.codigo}" (Esperado: "${codigoEsperado}")`);
    console.log(`   Resposta:`, data || erro);

    if (passou) {
      console.log("   Resultado: ✅ PASSOU\n");
      passosPassaram++;
    } else {
      console.log("   Resultado: ❌ FALHOU\n");
    }
  }

  await sleep(DELAY_MS);

  // Passo 3: POST /api/monitor com token correto (Atualização de monitor)
  {
    console.log("▶ Passo 3: POST /api/monitor (Atualização com token correto)");
    const { status, data, erro } = await executaRequisicao("POST", "/api/monitor", {
      url: testUrl,
      webhookUrl: dummyWebhook,
      webhookTipo: "slack",
      token: tokenSalvo,
    });

    const passou = (status === 200 || status === 201) && data?.ok === true;

    console.log(`   Status HTTP: ${status} (Esperado: 200 ou 201)`);
    console.log(`   Resposta:`, data || erro);

    if (passou) {
      console.log("   Resultado: ✅ PASSOU\n");
      passosPassaram++;
    } else {
      console.log("   Resultado: ❌ FALHOU\n");
    }
  }

  await sleep(DELAY_MS);

  // Passo 4: DELETE /api/monitor com token inválido
  {
    console.log("▶ Passo 4: DELETE /api/monitor (Exclusão com token INVÁLIDO)");
    const { status, data, erro } = await executaRequisicao("DELETE", "/api/monitor", {
      url: testUrl,
      token: "token_invalido_de_teste_123456",
    });

    const statusEsperado = 403;
    const codigoEsperado = "token-invalido";
    const passou = status === statusEsperado && data?.codigo === codigoEsperado;

    console.log(`   Status HTTP: ${status} (Esperado: ${statusEsperado})`);
    console.log(`   Código de Erro: "${data?.codigo}" (Esperado: "${codigoEsperado}")`);
    console.log(`   Resposta:`, data || erro);

    if (passou) {
      console.log("   Resultado: ✅ PASSOU\n");
      passosPassaram++;
    } else {
      console.log("   Resultado: ❌ FALHOU\n");
    }
  }

  await sleep(DELAY_MS);

  // Passo 5: DELETE /api/monitor com token correto
  {
    console.log("▶ Passo 5: DELETE /api/monitor (Exclusão com token CORRETO)");
    const { status, data, erro } = await executaRequisicao("DELETE", "/api/monitor", {
      url: testUrl,
      token: tokenSalvo,
    });

    const statusEsperado = 200;
    const passou = status === statusEsperado && data?.ok === true;

    console.log(`   Status HTTP: ${status} (Esperado: ${statusEsperado})`);
    console.log(`   Resposta:`, data || erro);

    if (passou) {
      console.log("   Resultado: ✅ PASSOU\n");
      passosPassaram++;
    } else {
      console.log("   Resultado: ❌ FALHOU\n");
    }
  }

  await sleep(DELAY_MS);

  // Passo 6: DELETE /api/monitor novamente (Monitor já excluído / inexistente)
  {
    console.log("▶ Passo 6: DELETE /api/monitor (Re-exclusão após remoção)");
    const { status, data, erro } = await executaRequisicao("DELETE", "/api/monitor", {
      url: testUrl,
      token: tokenSalvo,
    });

    const statusEsperado = 403;
    const codigoEsperado = "token-invalido";
    const passou = status === statusEsperado && data?.codigo === codigoEsperado;

    console.log(`   Status HTTP: ${status} (Esperado: ${statusEsperado})`);
    console.log(`   Código de Erro: "${data?.codigo}" (Esperado: "${codigoEsperado}")`);
    console.log(`   Resposta:`, data || erro);

    if (passou) {
      console.log("   Resultado: ✅ PASSOU\n");
      passosPassaram++;
    } else {
      console.log("   Resultado: ❌ FALHOU\n");
    }
  }

  // Resumo Final
  console.log("==================================================");
  console.log(`📊 RESUMO DO SMOKE TEST: ${passosPassaram}/${totalPassos} passos passaram.`);
  console.log("==================================================");

  if (passosPassaram === totalPassos) {
    console.log("🎉 Todos os testes de validação de token passaram com sucesso!");
    process.exit(0);
  } else {
    console.error("⚠️ Alguns passos falharam. Verifique os logs acima.");
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error("💥 Erro inesperado na execução do smoke test:", err);
  process.exit(1);
});
