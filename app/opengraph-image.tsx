import { ALT, TAMANHO, TIPO_CONTENT, gerarImagemOg } from "@/lib/og-imagem";

export const alt = ALT;
export const size = TAMANHO;
export const contentType = TIPO_CONTENT;

export default async function Image() {
  return gerarImagemOg();
}
