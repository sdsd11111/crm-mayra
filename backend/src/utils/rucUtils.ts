// backend/src/utils/rucUtils.ts
// Normaliza RUC y cédula ecuatorianos dañados por Excel (que borra el 0 inicial de provincias 01-09)

/**
 * Normaliza un RUC o cédula ecuatoriana recibida en texto libre.
 * Excel borra el 0 inicial de documentos de provincias 01-09:
 *   - Cédula de 9 dígitos → le falta el dígito 0 inicial → retorna '0' + raw
 *   - RUC de 12 dígitos que no empieza en 0-9 con provincia 01-09 → '0' + raw
 *   - RUC de 10 dígitos correcto → retorna tal cual
 *   - Cédula de 10 dígitos correcta → retorna tal cual
 */
export function normalizeEcuadorianDocument(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9) {
    // Cédula con 9 dígitos: Excel borró el 0 inicial (provincias 01, 02...09)
    return '0' + digits;
  }
  if (digits.length === 12) {
    // RUC con 12 dígitos: verificar si falta el 0 inicial
    // RUC = cédula(10) + 001. Si tiene 12 dígitos y la provincia sería 1-9 sin el 0,
    // es decir el primer dígito es 1-9 pero provincia real sería 01-09
    const firstTwo = parseInt(digits.substring(0, 2), 10);
    if (firstTwo >= 10) {
      // Primera cifra ya tiene 2 dígitos válidos (ej. 10, 17 Pichincha), ok
      return digits;
    }
    // firstTwo < 10 significa que el primer dígito es 0 (ya correcto) → no tocar
    return digits;
  }
  if (digits.length === 11) {
    // Podría ser RUC de 12 con 0 inicial perdido → '0' + 11 digits = 12
    const withZero = '0' + digits;
    return withZero;
  }
  // 10 dígitos: correcto tal cual
  return digits;
}

/**
 * Extrae el noveno dígito del RUC normalizado para calcular fecha de declaración SRI.
 * El noveno dígito del RUC coincide con el noveno dígito de la cédula del propietario.
 */
export function extractNovenoDigitoFromRuc(ruc: string): number {
  const normalized = normalizeEcuadorianDocument(ruc);
  if (normalized.length < 9) return 0;
  return parseInt(normalized[8], 10);
}
