// backend/src/utils/balanceUtils.ts
import { EntryType } from '@prisma/client';

/**
 * Tipos de movimiento contable que se consideran CARGOS (débitos al cliente).
 * Fuente única de verdad: si se agrega un nuevo EntryType de cargo,
 * SOLO se actualiza aquí y todos los cálculos de saldo se alinean.
 */
const DEBIT_ENTRY_TYPES: EntryType[] = [
  EntryType.CARGO_AUTOMATICO,
  EntryType.CARGO_MANUAL,
  EntryType.CARGO_COMISION_DEV,
];

/**
 * Tipos de movimiento contable que se consideran ABONOS (créditos al cliente).
 */
const CREDIT_ENTRY_TYPES: EntryType[] = [
  EntryType.ABONO_PAGO,
  EntryType.DESCUENTO_CRUCE,
];

/**
 * Calcula el saldo pendiente total a partir de un arreglo de movimientos contables.
 * Cargos suman, abonos restan.
 *
 * @param ledgerEntries - Arreglo de movimientos con al menos { entryType, amount }.
 * @returns Saldo pendiente redondeado a 2 decimales.
 */
export function calculateClientBalance(
  ledgerEntries: { entryType: string; amount: any }[]
): number {
  const total = ledgerEntries.reduce((acc, entry) => {
    const val = Number(entry.amount);
    if (DEBIT_ENTRY_TYPES.includes(entry.entryType as EntryType)) {
      return acc + val;
    }
    if (CREDIT_ENTRY_TYPES.includes(entry.entryType as EntryType)) {
      return acc - val;
    }
    return acc;
  }, 0);

  return Number(total.toFixed(2));
}

