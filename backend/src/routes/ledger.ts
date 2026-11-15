// backend/src/routes/ledger.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { PdfService } from '../services/PdfService';
import { BillingCron } from '../services/BillingCron';
import { calculateClientBalance } from '../utils/balanceUtils';
import { EntryType, BankAccount } from '@prisma/client';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/ledger/banks-summary
 * Estadísticas para las 3 Burbujas de Bancos del Dashboard + Cartera Total.
 * Solo ADMIN_MAYRA y COBRADOR.
 */
router.get(
  '/banks-summary',
  requireRole(['ADMIN_MAYRA']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Todos los abonos del mes agrupados por banco
      const paymentsThisMonth = await prisma.ledgerEntry.findMany({
        where: {
          entryType: EntryType.ABONO_PAGO,
          entryDate: {
            gte: firstDayOfMonth,
          },
        },
      });

      let bancoPichincha = 0;
      let bancoDeLoja = 0;
      let cooperativaJep = 0;
      let efectivo = 0;
      let totalRecaudadoMes = 0;

      paymentsThisMonth.forEach((p) => {
        const val = Number(p.amount);
        totalRecaudadoMes += val;
        if (p.bankAccount === BankAccount.BANCO_PICHINCHA) bancoPichincha += val;
        else if (p.bankAccount === BankAccount.BANCO_DE_LOJA) bancoDeLoja += val;
        else if (p.bankAccount === BankAccount.COOPERATIVA_JEP) cooperativaJep += val;
        else if (p.bankAccount === BankAccount.EFECTIVO) efectivo += val;
      });

      // Cálculo del Saldo Total en Cartera Morosa (todos los tiempos)
      const allEntries = await prisma.ledgerEntry.findMany();
      let totalCarteraPendiente = 0;

      allEntries.forEach((e) => {
        const val = Number(e.amount);
        if (
          e.entryType === EntryType.CARGO_AUTOMATICO ||
          e.entryType === EntryType.CARGO_MANUAL ||
          e.entryType === EntryType.CARGO_COMISION_DEV
        ) {
          totalCarteraPendiente += val;
        } else if (
          e.entryType === EntryType.ABONO_PAGO ||
          e.entryType === EntryType.DESCUENTO_CRUCE
        ) {
          totalCarteraPendiente -= val;
        }
      });

      res.json({
        success: true,
        data: {
          totalRecaudadoMes: Number(totalRecaudadoMes.toFixed(2)),
          totalCarteraPendiente: Number(totalCarteraPendiente.toFixed(2)),
          banks: {
            pichincha: Number(bancoPichincha.toFixed(2)),
            loja: Number(bancoDeLoja.toFixed(2)),
            jep: Number(cooperativaJep.toFixed(2)),
            efectivo: Number(efectivo.toFixed(2)),
          },
        },
      });
    } catch (error) {
      console.error('Error al obtener balance bancario:', error);
      res.status(500).json({ success: false, message: 'Error interno al calcular bancos.' });
    }
  }
);

/**
 * POST /api/ledger/charge
 * Registra un Cargo Manual en la bolsa de deuda del cliente.
 */
router.post(
  '/charge',
  requireRole(['ADMIN_MAYRA']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { clientOwnerId, taxpayerId, concept, amount, periodText, recurringFreq } = req.body;

      if (!clientOwnerId || !concept || amount === undefined) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios (clientOwnerId, concept, amount).',
        });
        return;
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0.' });
        return;
      }

      // Calcular nextChargeDate según la frecuencia de recurrencia
      let nextChargeDate: Date | null = null;
      const validFreqs = ['MENSUAL', 'SEMESTRAL', 'ANUAL'];
      const freq = recurringFreq && validFreqs.includes(recurringFreq) ? recurringFreq : null;
      if (freq) {
        const base = new Date();
        if (freq === 'MENSUAL') base.setMonth(base.getMonth() + 1);
        else if (freq === 'SEMESTRAL') base.setMonth(base.getMonth() + 6);
        else if (freq === 'ANUAL') base.setFullYear(base.getFullYear() + 1);
        nextChargeDate = base;
      }

      const entry = await prisma.ledgerEntry.create({
        data: {
          clientOwnerId: parseInt(clientOwnerId, 10),
          taxpayerId: taxpayerId ? parseInt(taxpayerId, 10) : null,
          entryType: EntryType.CARGO_MANUAL,
          concept: concept.trim(),
          amount: numAmount,
          periodText: periodText || null,
          bankAccount: BankAccount.NO_APLICA,
          createdById: req.user!.id,
          recurringFreq: freq,
          nextChargeDate,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Cargo registrado con éxito en la cuenta corriente.',
        data: entry,
      });
    } catch (error) {
      console.error('Error al registrar cargo:', error);
      res.status(500).json({ success: false, message: 'Error al registrar el cargo.' });
    }
  }
);

/**
 * POST /api/ledger/payment
 * Registra un Abono/Pago clasificado con uno de los 3 Bancos obligatorios.
 */
router.post(
  '/payment',
  requireRole(['ADMIN_MAYRA']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { clientOwnerId, amount, bankAccount, concept, receiptUrl } = req.body;

      if (!clientOwnerId || !amount || !bankAccount) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios (clientOwnerId, amount, bankAccount).',
        });
        return;
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        res.status(400).json({ success: false, message: 'El monto del abono debe ser mayor a 0.' });
        return;
      }

      const validAccounts: BankAccount[] = [
        BankAccount.BANCO_PICHINCHA,
        BankAccount.BANCO_DE_LOJA,
        BankAccount.COOPERATIVA_JEP,
        BankAccount.EFECTIVO,
        BankAccount.CRUCE_CUENTAS,
      ];

      if (!validAccounts.includes(bankAccount)) {
        res.status(400).json({
          success: false,
          message: 'Cuenta bancaria o destino de pago inválido.',
        });
        return;
      }

      const entry = await prisma.ledgerEntry.create({
        data: {
          clientOwnerId: parseInt(clientOwnerId, 10),
          entryType: EntryType.ABONO_PAGO,
          concept: concept ? concept.trim() : `Abono a cuenta ${bankAccount.replace(/_/g, ' ')}`,
          amount: numAmount,
          bankAccount,
          receiptUrl: receiptUrl || null,
          createdById: req.user!.id,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Abono registrado con éxito y acreditado a la cuenta bancaria.',
        data: entry,
      });
    } catch (error) {
      console.error('Error al registrar abono:', error);
      res.status(500).json({ success: false, message: 'Error al registrar el abono.' });
    }
  }
);

/**
 * POST /api/ledger/dev-iva
 * Modo Ciego para Devolución de IVA 3ra Edad.
 * Accesible tanto por ASISTENTE como por ADMIN_MAYRA.
 * La asistente ingresa únicamente lo solicitado al SRI ($).
 * El backend calcula la comisión en silencio y añade el cargo.
 */
router.post('/dev-iva', async (req: Request, res: Response): Promise<void> => {
  try {
    const { taxpayerId, periodYear, periodMonth, requestedAmount } = req.body;

    if (!taxpayerId || !periodYear || !periodMonth || requestedAmount === undefined) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios (taxpayerId, periodYear, periodMonth, requestedAmount).',
      });
      return;
    }

    const numRequested = Number(requestedAmount);
    if (isNaN(numRequested) || numRequested <= 0) {
      res.status(400).json({ success: false, message: 'El monto solicitado debe ser mayor a 0.' });
      return;
    }

    const taxpayer = await prisma.taxpayer.findUnique({
      where: { id: parseInt(taxpayerId, 10) },
      include: { clientOwner: true },
    });

    if (!taxpayer) {
      res.status(404).json({ success: false, message: 'Empresa o contribuyente no encontrado.' });
      return;
    }

    const commissionPct = Number(taxpayer.devIvaPercent || 10.0);
    const commissionTotal = Number(((numRequested * commissionPct) / 100).toFixed(2));

    // Guardar registro histórico
    const record = await prisma.devIvaRecord.create({
      data: {
        taxpayerId: taxpayer.id,
        periodYear: parseInt(periodYear, 10),
        periodMonth: parseInt(periodMonth, 10),
        requestedAmount: numRequested,
        commissionPct,
        commissionTotal,
      },
    });

    // Cargar automáticamente a la bolsa de deuda del cliente
    await prisma.ledgerEntry.create({
      data: {
        clientOwnerId: taxpayer.clientOwnerId,
        taxpayerId: taxpayer.id,
        entryType: EntryType.CARGO_COMISION_DEV,
        concept: `Comisión Dev. IVA ${periodMonth}/${periodYear} - ${taxpayer.razonSocial}`,
        periodText: `${periodYear}-${String(periodMonth).padStart(2, '0')}`,
        amount: commissionTotal,
        bankAccount: BankAccount.NO_APLICA,
        createdById: req.user!.id,
      },
    });

    const isAssistant = req.user?.role === 'ASISTENTE';

    res.status(201).json({
      success: true,
      message: 'Devolución de IVA registrada y procesada con éxito.',
      data: isAssistant
        ? {
            id: record.id,
            taxpayerId: record.taxpayerId,
            periodYear: record.periodYear,
            periodMonth: record.periodMonth,
            requestedAmount: record.requestedAmount,
            status: 'PROCESADO_Y_REGISTRADO',
          }
        : record,
    });
  } catch (error) {
    console.error('Error al procesar devolución de IVA:', error);
    res.status(500).json({ success: false, message: 'Error interno al procesar la devolución de IVA.' });
  }
});

/**
 * GET /api/ledger/statement-pdf/:clientOwnerId
 * Genera y descarga el PDF de Estado de Cuenta Consolidado.
 */
router.get(
  '/statement-pdf/:clientOwnerId',
  requireRole(['ADMIN_MAYRA']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clientOwnerId = parseInt(req.params.clientOwnerId as string, 10);
      if (isNaN(clientOwnerId)) {
        res.status(400).json({ success: false, message: 'ID de cliente inválido.' });
        return;
      }

      const client = await prisma.clientOwner.findUnique({
        where: { id: clientOwnerId },
        include: {
          taxpayers: true,
          ledgerEntries: {
            orderBy: { entryDate: 'asc' },
          },
        },
      });

      if (!client) {
        res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
        return;
      }

      let totalBalance = 0;
      const formattedEntries = client.ledgerEntries.map((e) => {
        const val = Number(e.amount);
        if (
          e.entryType === EntryType.CARGO_AUTOMATICO ||
          e.entryType === EntryType.CARGO_MANUAL ||
          e.entryType === EntryType.CARGO_COMISION_DEV
        ) {
          totalBalance += val;
        } else {
          totalBalance -= val;
        }

        return {
          entryDate: e.entryDate,
          entryType: e.entryType,
          concept: e.concept,
          bankAccount: e.bankAccount,
          amount: val,
        };
      });

      const pdfBuffer = await PdfService.generateAccountStatement({
        clientName: client.fullName,
        phone: client.whatsappPhone,
        taxpayers: client.taxpayers.map((t) => ({ razonSocial: t.razonSocial, ruc: t.ruc })),
        entries: formattedEntries,
        totalBalance: Number(totalBalance.toFixed(2)),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Estado_Cuenta_${client.fullName.replace(/\s+/g, '_')}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error al generar PDF de estado de cuenta:', error);
      res.status(500).json({ success: false, message: 'Error interno al generar el PDF.' });
    }
  }
);

/**
 * POST /api/ledger/cron-trigger
 * Disparador manual para probar el ciclo de facturación automática del mes actual.
 */
router.post(
  '/cron-trigger',
  requireRole(['ADMIN_MAYRA']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await BillingCron.executeBillingRun();
      res.json({
        success: true,
        message: 'Ciclo de facturación automática ejecutado con éxito.',
        data: result,
      });
    } catch (error) {
      console.error('Error al ejecutar cron manual:', error);
      res.status(500).json({ success: false, message: 'Error al ejecutar facturación automática.' });
    }
  }
);

/**
 * POST /api/ledger/trigger-collection
 * Disparador manual de cobranza masiva WhatsApp (PDF estado de cuenta a todos con saldo > $0).
 * Accesible desde el botón "Disparar Cobranza Mensual WhatsApp" del Dashboard.
 */
router.post(
  '/trigger-collection',
  requireRole(['ADMIN_MAYRA']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await BillingCron.executeCollectionRun();
      res.json({
        success: true,
        message: `Cobranza masiva encolada: ${result.enqueued} estados de cuenta ingresados a la cola anti-baneo.`,
        data: result,
      });
    } catch (error) {
      console.error('Error al ejecutar cobranza masiva:', error);
      res.status(500).json({ success: false, message: 'Error al ejecutar cobranza masiva.' });
    }
  }
);

/**
 * GET /api/ledger/top-debtors
 * Retorna los 5 clientes con mayor saldo pendiente acumulado (> $0)
 */
router.get(
  '/top-debtors',
  requireRole(['ADMIN_MAYRA']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const clients = await prisma.clientOwner.findMany({
        include: {
          taxpayers: {
            select: { id: true, razonSocial: true, ruc: true },
          },
          ledgerEntries: {
            orderBy: { entryDate: 'desc' },
          },
        },
      });

      const debtorsList = clients
        .map((client) => {
          const saldoPendiente = calculateClientBalance(client.ledgerEntries);
          if (saldoPendiente <= 0) return null;

          // Totales brutos
          const CARGOS: string[] = [EntryType.CARGO_AUTOMATICO, EntryType.CARGO_MANUAL, EntryType.CARGO_COMISION_DEV];
          const ABONOS: string[] = [EntryType.ABONO_PAGO, EntryType.DESCUENTO_CRUCE];
          const totalCargos = client.ledgerEntries
            .filter((e) => CARGOS.includes(e.entryType))
            .reduce((acc, e) => acc + Number(e.amount), 0);
          const totalAbonos = client.ledgerEntries
            .filter((e) => ABONOS.includes(e.entryType))
            .reduce((acc, e) => acc + Number(e.amount), 0);

          // Último abono
          const lastPaymentEntry = client.ledgerEntries.find(
            (e) => e.entryType === EntryType.ABONO_PAGO
          );

          // Días de antigüedad del cargo más antiguo impago
          const oldestCharge = client.ledgerEntries
            .filter((e) => e.entryType !== EntryType.ABONO_PAGO)
            .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime())[0];

          let daysOverdue = 0;
          if (oldestCharge) {
            const diffTime = Math.abs(Date.now() - oldestCharge.entryDate.getTime());
            daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }

          return {
            clientId: client.id,
            clientName: client.fullName,
            whatsappPhone: client.whatsappPhone,
            empresas: client.taxpayers.map((t) => t.razonSocial).join(', '),
            saldoPendiente,
            totalCargos: Number(totalCargos.toFixed(2)),
            totalAbonos: Number(totalAbonos.toFixed(2)),
            daysOverdue,
            lastPayment: lastPaymentEntry ? lastPaymentEntry.entryDate.toISOString() : null,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .sort((a, b) => b.saldoPendiente - a.saldoPendiente)
        .slice(0, 5);

      res.json({
        success: true,
        debtors: debtorsList,
      });
    } catch (error) {
      console.error('Error al obtener top debtors:', error);
      res.status(500).json({ success: false, message: 'Error al obtener deudores principales.' });
    }
  }
);

/**
 * GET /api/ledger/promises-today
 * Promesas de pago que vencen hoy o están vencidas/pendientes,
 * junto con tickets de GERENCIAL_MAYRA y documentos subidos hoy.
 */
router.get(
  '/promises-today',
  requireRole(['ADMIN_MAYRA']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      // 1. Promesas de pago pendientes con fecha <= hoy (vencidas o para hoy)
      const promises = await prisma.paymentPromise.findMany({
        where: {
          status: 'PENDIENTE',
          promisedDate: {
            lte: endOfToday,
          },
        },
        include: {
          clientOwner: {
            select: { id: true, fullName: true, whatsappPhone: true },
          },
        },
        orderBy: { promisedDate: 'asc' },
      });

      // 2. Tickets en cola GERENCIAL_MAYRA abiertos
      const gerencialTicketsCount = await prisma.chatTicket.count({
        where: {
          queueType: 'GERENCIAL_MAYRA',
          status: 'ABIERTO',
        },
      });

      // 3. Documentos subidos hoy por el equipo
      const docsTodayCount = await prisma.document.count({
        where: {
          createdAt: {
            gte: startOfToday,
          },
        },
      });

      res.json({
        success: true,
        data: {
          promises: promises.map((p) => ({
            id: p.id,
            clientId: p.clientOwner.id,
            clientName: p.clientOwner.fullName,
            whatsappPhone: p.clientOwner.whatsappPhone,
            amount: p.promisedAmount ? Number(p.promisedAmount) : 0,
            promisedDate: p.promisedDate,
            notes: p.notes,
            isToday: p.promisedDate >= startOfToday && p.promisedDate <= endOfToday,
          })),
          gerencialTicketsCount,
          docsTodayCount,
        },
      });
    } catch (error) {
      console.error('Error al obtener promesas y atención de Mayra:', error);
      res.status(500).json({ success: false, message: 'Error interno.' });
    }
  }
);

/**
 * PATCH /api/ledger/promises/:id/status
 * Actualizar estado de una promesa de pago (CUMPLIDA / CANCELADA)
 */
router.patch(
  '/promises/:id/status',
  requireRole(['ADMIN_MAYRA']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const promiseId = parseInt(req.params.id as string, 10);
      const { status } = req.body;

      if (!status || !['CUMPLIDA', 'CANCELADA', 'PENDIENTE', 'INCUMPLIDA'].includes(status)) {
        res.status(400).json({ success: false, message: 'Estado inválido.' });
        return;
      }

      const updated = await prisma.paymentPromise.update({
        where: { id: promiseId },
        data: { status },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error al actualizar promesa:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar promesa.' });
    }
  }
);

/**
 * GET /api/ledger/debtors-count
 * Cuenta cuántos clientes tienen saldo > 0 para el modal de confirmación de cobranza
 */
router.get(
  '/debtors-count',
  requireRole(['ADMIN_MAYRA']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const clients = await prisma.clientOwner.findMany({
        include: {
          ledgerEntries: true,
        },
      });

      let count = 0;
      let totalDebt = 0;

      for (const client of clients) {
        const saldo = calculateClientBalance(client.ledgerEntries);
        if (saldo > 0) {
          count++;
          totalDebt += saldo;
        }
      }

      res.json({
        success: true,
        count,
        totalDebt: Math.round(totalDebt * 100) / 100,
      });
    } catch (error) {
      console.error('Error al contar deudores:', error);
      res.status(500).json({ success: false, message: 'Error al contar deudores.' });
    }
  }
);

export default router;

