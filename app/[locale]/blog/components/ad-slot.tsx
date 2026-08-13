export default function AdSlot({ slot }: { slot: string }) {
  return (
    // Espaço reservado para o Google AdSense. Quando a conta for aprovada:
    // - substituir este div por um <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXX" data-ad-slot="XXXX"></ins>
    // - carregar o script do AdSense via <Script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" strategy="afterInteractive" />
    //   (ajustar a CSP em proxy.ts para permitir esse domínio em script-src e a requisição em connect-src, se necessário)
    <div className="ad-slot" data-slot={slot} aria-hidden="true" />
  );
}
