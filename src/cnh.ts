/** Utilidades de normalização e comparação de CNH (Registro Nacional, 11 dígitos). */

/** Mantém só os dígitos da CNH. Retorna null se não sobrar dígito. */
export function normalizarCnh(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const digitos = String(raw).replace(/\D/g, '')
  return digitos.length > 0 ? digitos : null
}

/**
 * Compara duas CNHs ignorando zeros à esquerda — cobre o caso da planilha
 * que guardou a CNH como número (perdendo o zero inicial).
 */
export function cnhIgual(a: string | null, b: string | null): boolean {
  const na = normalizarCnh(a)
  const nb = normalizarCnh(b)
  if (!na || !nb) return false
  return na.replace(/^0+/, '') === nb.replace(/^0+/, '')
}
