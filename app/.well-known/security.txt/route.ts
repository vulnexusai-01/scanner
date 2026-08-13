import { NextResponse } from "next/server";

const CONTEUDO = `# Security contact for VulnexusAI
#
# More info: https://securitytxt.org/
Contact: https://vulnexusai.com/seguranca
Expires: 2027-08-01T00:00:00Z
Preferred-Languages: pt-BR, en
Canonical: https://vulnexusai.com/.well-known/security.txt
`;

export function GET() {
  return new NextResponse(CONTEUDO, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}