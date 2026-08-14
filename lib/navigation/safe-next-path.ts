// `next` sempre vem de entrada não confiável (query string ou campo de
// formulário) e alimenta um redirect — sem essa checagem, um valor como
// `//evil.com` ou `https://evil.com` vira open redirect usando nosso domínio
// pra dar credibilidade a um destino malicioso. Só aceita caminho relativo à
// própria origem.
export function safeNextPath(next: string | null, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}
