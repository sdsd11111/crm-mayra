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
export const SRI_EXPIRATION_DAYS: Record<number, number> = {
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
 * Traslada una fecha al siguiente día hábil si cae en sábado o domingo
 * conforme al Art. 116 del Código Tributario de Ecuador.
 */
export function adjustToNextBusinessDay(date: Date): Date {
  const adjusted = new Date(date);
  const dayOfWeek = adjusted.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 6) {
    adjusted.setDate(adjusted.getDate() + 2); // Pasa al Lunes
  } else if (dayOfWeek === 0) {
    adjusted.setDate(adjusted.getDate() + 1); // Pasa al Lunes
  }
  return adjusted;
}

/**
 * Calcula la fecha legal exacta de vencimiento SRI para un año, mes y RUC dados.
 * Retorna un objeto Date con la hora fijada a las 18:00 (hora hábil de corte SRI).
 */
export function getSriLegalDueDate(year: number, month: number, ruc: string): Date | null {
  const noveno = extractNovenoDigito(ruc);
  if (noveno === null) return null;

  const baseDay = SRI_EXPIRATION_DAYS[noveno] || 28;
  // month es 1-based (1 = Enero, 12 = Diciembre)
  const rawDate = new Date(year, month - 1, baseDay, 18, 0, 0, 0);
  return adjustToNextBusinessDay(rawDate);
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
