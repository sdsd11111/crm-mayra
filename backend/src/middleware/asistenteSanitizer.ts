// backend/src/middleware/asistenteSanitizer.ts
// Escudo HTTP: garantiza que el JSON que viaja por red a un usuario ASISTENTE
// tenga intersección cero (∅) con campos financieros sensibles.
import { Request, Response, NextFunction } from 'express';

/** Campos que un ASISTENTE NO debe ver nunca en la red */
const FINANCIAL_FIELDS = new Set([
  'autoBillAmount',
  'autoBillFreq',
  'appliesVat',
  'devIvaPercent',
  'commissionPct',
  'commissionTotal',
  'ledgerEntries',
  'saldoPendiente',
  'balance',
  'amount',
  'paymentPromises',
  'devIvaRecords',
  'claveSri',
  'claveFirma',
  'claveSalar',
  'claveSut',
  'claveIess',
  'claveSupercias',
  'claveSercop',
  'securityPin',
  'firmaFileUrl',
  'firmaExpira',
]);

/**
 * Elimina recursivamente los campos financieros de cualquier objeto/array.
 */
function deepStrip(value: any, fields: Set<string>): any {
  if (Array.isArray(value)) {
    return value.map(item => deepStrip(item, fields));
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (!fields.has(k)) {
        cleaned[k] = deepStrip(v, fields);
      }
    }
    return cleaned;
  }
  return value;
}

/**
 * Middleware: intercepta res.json() para ASISTENTES y elimina campos financieros.
 * Aplica a las rutas donde se montan clientes, taxpayers y documentos.
 */
export function sanitizeAsistenteResponse(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;

  // Solo aplica a ASISTENTE (ADMIN_MAYRA ve todo)
  if (!user || user.role !== 'ASISTENTE') {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = (data: any) => {
    const sanitized = deepStrip(data, FINANCIAL_FIELDS);
    return originalJson(sanitized);
  };

  next();
}

/**
 * Middleware: bloquea completamente el acceso al ledger (cartera) para ASISTENTE.
 */
export function blockLedgerForAsistente(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (user?.role === 'ASISTENTE') {
    res.status(403).json({ error: 'Acceso denegado: el rol ASISTENTE no tiene acceso a datos financieros.' });
    return;
  }
  next();
}

/**
 * Middleware: fuerza queueType = OPERATIVA_CHICAS para ASISTENTE ignorando ?queue= param.
 */
export function forceOperativaQueue(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (user?.role === 'ASISTENTE') {
    req.query.queue = 'OPERATIVA_CHICAS';
    if (req.body && typeof req.body === 'object') {
      req.body.queue = 'OPERATIVA_CHICAS';
    }
  }
  next();
}
