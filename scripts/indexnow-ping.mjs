const SITEMAP = process.argv[2] ?? "https://vulnexusai.com/sitemap.xml";
const KEY = process.argv[3] ?? process.env.INDEXNOW_KEY;

if (!KEY) {
  console.error("IndexNow key nao informada. Use: node scripts/indexnow-ping.mjs <sitemap> <key>");
  process.exit(1);
}

const sitemap = await fetch(SITEMAP, { headers: { "user-agent": "indexnow-ping" } });
if (!sitemap.ok) {
  console.error(`Falha ao baixar o sitemap: ${sitemap.status}`);
  process.exit(1);
}
const xml = await sitemap.text();
const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
if (locs.length === 0) {
  console.error("Nenhuma URL encontrada no sitemap.");
  process.exit(1);
}
console.log(`${locs.length} URLs no sitemap (${SITEMAP}).`);

const urlList = locs.map((url) => (url.startsWith("https://vulnexusai.com") ? url : null)).filter(Boolean);
const body = { host: "vulnexusai.com", key: KEY, urlList };
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
console.log(`IndexNow -> ${res.status} ${res.statusText}`);
if (!res.ok) {
  const texto = await res.text();
  console.error(texto.slice(0, 500));
  process.exit(1);
}
console.log("Ping enviado com sucesso para todas as URLs.");
