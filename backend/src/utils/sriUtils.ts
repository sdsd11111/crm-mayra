// backend/src/utils/sriUtils.ts

/**
 * Tabla Oficial del SRI de Ecuador para vencimientos mensuales según el 9no dígito del RUC.
 * Dígito 1 -> Día 10
 * Dígito 2 -> Día 12
 * Dígito 3 -> Día 14
 * Dígito 4 -> Día 16
 * Dígito 5 -> Día 18
 * Dígito 6 -> Día 20
 * Dígito 7 -> Día 22
 * Dígito 8 -> Día 24
 * Dígito 9 -> Día 26
 * Dígito 0 -> Día 28
 */
const SRI_EXPIRATION_DAYS: Record<number, number> = {
  1: 10,
  2: 12,
  3: 14,
  4: 16,
  5: 18,
  6: 20,
  7: 22,
  8: 24,
  9: 26,
  0: 28,
};

/**
 * Extrae el noveno dígito de un RUC ecuatoriano (longitud 13 dígitos).
 * Si no es válido o tiene menos de 9 caracteres, retorna null.
 */
export function extractNovenoDigito(ruc?: string | null): number | null {
  if (!ruc) return null;
  const cleaned = ruc.trim().replace(/\D/g, '');
  if (cleaned.length < 9) return null;
  // El 9no dígito es el índice 8 (0-indexed)
  const digitChar = cleaned.charAt(8);
  const digit = parseInt(digitChar, 10);
  return isNaN(digit) ? null : digit;
}

/**
 * Calcula el texto de fecha de declaración sugerido a partir del RUC y régimen.
 * Ejemplo para RUC con 9no dígito 9 en régimen MENSUAL: "26C/MES"
 */
export function calculateFechaDecla(ruc?: string | null, regimen?: string): string | null {
  const noveno = extractNovenoDigito(ruc);
  if (noveno === null) return null;

  const dia = SRI_EXPIRATION_DAYS[noveno] || 28;

  if (regimen === 'SEMESTRAL' || regimen === 'DEVOLUCION_IVA_3RA_EDAD') {
    return `${dia} JU-EN`;
  }

  if (regimen === 'ANUAL') {
    return `${dia} MARZO`;
  }

  return `${dia}C/MES`;
}

