import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

const LUGARES = ["pt", "en", "es"] as const;

function aplicarCabecalhos(response: NextResponse, nonce: string, isDev: boolean) {
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", construirCsp(nonce, isDev));
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
  response.cookies.set("vx_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: !isDev,
    path: "/",
  });
}

function construirCsp(nonce: string, isDev: boolean): string {
  return `
    default-src 'none';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' data:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
    report-to csp-endpoint;
  `
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const { pathname, search } = request.nextUrl;

  const jaLocalizado = LUGARES.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (!jaLocalizado) {
    const destino = request.nextUrl.clone();
    const corpo = pathname === "/" ? "" : pathname;
    destino.pathname = `/pt${corpo}`;
    destino.search = search;
    const response = NextResponse.redirect(destino, 301);
    aplicarCabecalhos(response, nonce, isDev);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response =
    handleI18nRouting(request) ??
    NextResponse.next({ request: { headers: requestHeaders } });

  aplicarCabecalhos(response, nonce, isDev);

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|twitter-image|.*\\..*).*)"],
};
