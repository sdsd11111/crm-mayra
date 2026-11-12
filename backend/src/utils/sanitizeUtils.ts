// backend/src/utils/sanitizeUtils.ts

/**
 * Sanitiza un objeto Taxpayer según el rol del usuario.
 *
 * MODO CIEGO (ASISTENTE): Remueve campos monetarios y financieros
 * que las asistentes no deben conocer (honorarios, IVA, frecuencia de cobro).
 *
 * ADMIN / COBRADOR: Devuelve todos los campos, convirtiendo Decimal a number.
 *
 * @param taxpayer - Objeto taxpayer de Prisma (con cualquier shape).
 * @param isAssistant - true si el usuario autenticado tiene rol ASISTENTE.
 * @returns Taxpayer sanitizado listo para enviar al frontend.
 */
export function sanitizeTaxpayerForRole(taxpayer: any, isAssistant: boolean): any {
  if (isAssistant) {
    const {
      autoBillAmount,
      devIvaPercent,
      appliesVat,
      autoBillFreq,
      ...safeFields
    } = taxpayer;
    return safeFields;
  }

  return {
    ...taxpayer,
    autoBillAmount: Number(taxpayer.autoBillAmount),
    devIvaPercent: Number(taxpayer.devIvaPercent),
  };
}

