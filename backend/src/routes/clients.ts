// backend/src/routes/clients.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { extractNovenoDigito, calculateFechaDecla } from '../utils/sriUtils';
import { calculateClientBalance } from '../utils/balanceUtils';
import { sanitizeTaxpayerForRole } from '../utils/sanitizeUtils';
import { TaxRegime, BillingFrequency, EntryType, BankAccount } from '@prisma/client';

const router = Router();

// Todas las rutas requieren token de sesión
router.use(authenticateToken);

/**
 * GET /api/clients
 * Lista todos los clientes dueños con sus empresas asociadas.
 * Acepta filtros: ?search=xxx&regimen=xxx&novenoDigito=X
 * Si el usuario es ASISTENTE, aplica "MODO CIEGO":
 * - Omite saldos pendientes
 * - Omite autoBillAmount
 * - Omite devIvaPercent
 * - Omite montos de ledgerEntries
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const isAssistant = req.user?.role === 'ASISTENTE';
    const { search, regimen, novenoDigito } = req.query;

    const whereTaxpayer: any = {};
    if (regimen && typeof regimen === 'string' && regimen !== 'ALL') {
      whereTaxpayer.regimen = regimen as TaxRegime;
    }
    if (novenoDigito !== undefined && novenoDigito !== '' && novenoDigito !== 'ALL') {
      whereTaxpayer.novenoDigito = parseInt(novenoDigito as string, 10);
    }

    const whereClient: any = {};
    if (search && typeof search === 'string') {
      const q = search.trim();
      whereClient.OR = [
        { fullName: { contains: q } },
        { whatsappPhone: { contains: q } },
        {
          taxpayers: {
            some: {
              OR: [
                { razonSocial: { contains: q } },
                { ruc: { contains: q } },
              ],
            },
          },
        },
      ];
    }

    if (Object.keys(whereTaxpayer).length > 0) {
      whereClient.taxpayers = { some: whereTaxpayer };
    }

    const clients = await prisma.clientOwner.findMany({
      where: whereClient,
      include: {
        taxpayers: {
          where: whereTaxpayer,
          orderBy: { razonSocial: 'asc' },
        },
        ledgerEntries: isAssistant
          ? false
          : {
              select: {
                id: true,
                entryType: true,
                amount: true,
                bankAccount: true,
                taxpayerId: true,
              },
            },
      },
      orderBy: { fullName: 'asc' },
    });

    // Mapear respuesta según rol (Modo Ciego estricto)
    const sanitized = clients.map((c: any) => {
      const saldoTotal = !isAssistant && c.ledgerEntries
        ? calculateClientBalance(c.ledgerEntries)
        : 0;

      const cleanTaxpayers = c.taxpayers.map((t: any) =>
        sanitizeTaxpayerForRole(t, isAssistant)
      );

      return {
        id: c.id,
        fullName: c.fullName,
        whatsappPhone: c.whatsappPhone,
        securityPin: c.securityPin,
        isVip: c.isVip,
        dataConsentSigned: c.dataConsentSigned,
        notes: c.notes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        taxpayers: cleanTaxpayers,
        ...(isAssistant
          ? {}
          : {
              saldoPendienteTotal: saldoTotal,
              totalMovimientos: c.ledgerEntries?.length || 0,
            }),
      };
    });

    res.json({
      success: true,
      count: sanitized.length,
      data: sanitized,
    });
  } catch (error) {
    console.error('Error al listar clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al consultar el directorio de clientes.',
    });
  }
});

/**
 * GET /api/clients/tax-alerts
 * Redirige u ofrece el semáforo tributario y alertas de firma electrónica.
 */
router.get('/tax-alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    const SRI_DUE_DAYS: Record<number, number> = {
      1: 10, 2: 12, 3: 14, 4: 16, 5: 18,
      6: 20, 7: 22, 8: 24, 9: 26, 0: 28,
    };

    const taxpayers = await prisma.taxpayer.findMany({
      where: {
        regimen: { not: 'INACTIVO_CERRADO' },
      },
      include: {
        clientOwner: true,
        documents: {
          where: {
            periodYear: currentYear,
            periodMonth: currentMonth,
            category: { in: ['DECLARACION_IVA', 'DECLARACION_RENTA', 'ANEXO_ATS'] },
          },
        },
      },
    });

    const semaforo = taxpayers.map((t) => {
      const digit = t.novenoDigito ?? 0;
      const dueDay = SRI_DUE_DAYS[digit] ?? 28;
      const hasDeclaration = t.documents.length > 0;
      const daysUntilDue = dueDay - currentDay;

      let estado: 'VERDE' | 'AMARILLO' | 'ROJO';
      if (hasDeclaration) {
        estado = 'VERDE';
      } else if (daysUntilDue <= 1 && daysUntilDue >= 0) {
        estado = 'ROJO';
      } else if (daysUntilDue < 0) {
        estado = 'ROJO';
      } else {
        estado = 'AMARILLO';
      }

      return {
        taxpayerId: t.id,
        clientId: t.clientOwner.id,
        razonSocial: t.razonSocial,
        ruc: t.ruc,
        claveSri: t.claveSri || null,
        clientName: t.clientOwner.fullName,
        novenoDigito: digit,
        dueDay,
        daysUntilDue,
        hasDeclaration,
        estado,
      };
    });

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const firmasExpirando = await prisma.taxpayer.findMany({
      where: {
        firmaExpira: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
      },
      include: { clientOwner: true },
      orderBy: { firmaExpira: 'asc' },
    });

    const firmaAlerts = firmasExpirando.map((t) => {
      const daysLeft = Math.ceil(
        (t.firmaExpira!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        taxpayerId: t.id,
        razonSocial: t.razonSocial,
        ruc: t.ruc,
        clientName: t.clientOwner.fullName,
        whatsappPhone: t.clientOwner.whatsappPhone,
        firmaExpira: t.firmaExpira,
        daysLeft,
      };
    });

    res.json({
      success: true,
      data: {
        semaforo: {
          verde: semaforo.filter((s) => s.estado === 'VERDE').length,
          amarillo: semaforo.filter((s) => s.estado === 'AMARILLO').length,
          rojo: semaforo.filter((s) => s.estado === 'ROJO').length,
          items: semaforo,
        },
        firmaAlerts: {
          count: firmaAlerts.length,
          items: firmaAlerts,
        },
      },
      semaforo: {
        verde: semaforo.filter((s) => s.estado === 'VERDE').length,
        amarillo: semaforo.filter((s) => s.estado === 'AMARILLO').length,
        rojo: semaforo.filter((s) => s.estado === 'ROJO').length,
        items: semaforo,
      },
      firmaAlerts: {
        count: firmaAlerts.length,
        items: firmaAlerts,
      },
    });
  } catch (error) {
    console.error('Error en /api/clients/tax-alerts:', error);
    res.status(500).json({ success: false, message: 'Error al obtener alertas tributarias.' });
  }
});

/**
 * GET /api/clients/:id
 * Detalle completo de un Dueño Pagador y sus empresas asociadas
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const isAssistant = req.user?.role === 'ASISTENTE';
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID de cliente inválido.' });
      return;
    }

    const client = await prisma.clientOwner.findUnique({
      where: { id },
      include: {
        taxpayers: {
          orderBy: { razonSocial: 'asc' },
        },
        ledgerEntries: isAssistant
          ? false
          : {
              orderBy: { entryDate: 'desc' },
              include: {
                createdBy: {
                  select: { id: true, username: true, fullName: true },
                },
              },
            },
      },
    });

    if (!client) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
      return;
    }

    let saldoTotal = 0;
    if (!isAssistant && (client as any).ledgerEntries) {
      saldoTotal = calculateClientBalance((client as any).ledgerEntries);
    }

    const cleanTaxpayers = client.taxpayers.map((t: any) =>
      sanitizeTaxpayerForRole(t, isAssistant)
    );

    res.json({
      success: true,
      data: {
        ...client,
        taxpayers: cleanTaxpayers,
        ...(isAssistant
          ? {}
          : {
              saldoPendienteTotal: saldoTotal,
              ledgerEntries: (client as any).ledgerEntries?.map((e: any) => ({
                ...e,
                amount: Number(e.amount),
              })),
            }),
      },
    });
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ success: false, message: 'Error interno al consultar el cliente.' });
  }
});

/**
 * POST /api/clients
 * Crea un nuevo Dueño Pagador
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, whatsappPhone, securityPin, isVip, dataConsentSigned, notes } = req.body;

    if (!fullName || !fullName.trim()) {
      res.status(400).json({ success: false, message: 'El nombre completo es obligatorio.' });
      return;
    }
    if (!whatsappPhone || !whatsappPhone.trim()) {
      res.status(400).json({ success: false, message: 'El teléfono de WhatsApp es obligatorio.' });
      return;
    }

    // Limpiar teléfono
    const cleanPhone = whatsappPhone.trim().replace(/\D/g, '');

    const existing = await prisma.clientOwner.findUnique({
      where: { whatsappPhone: cleanPhone },
    });
    if (existing) {
      res.status(400).json({
        success: false,
        message: `Ya existe un cliente registrado con el teléfono ${cleanPhone}.`,
      });
      return;
    }

    const created = await prisma.clientOwner.create({
      data: {
        fullName: fullName.trim(),
        whatsappPhone: cleanPhone,
        securityPin: securityPin || '0000',
        isVip: Boolean(isVip),
        dataConsentSigned: Boolean(dataConsentSigned),
        notes: notes || null,
      },
    });

    // Vincular retroactivamente tickets previos de este número a la nueva ficha creada
    // Soporta tanto 593967491847 como 0967491847 usando los últimos 9 dígitos
    const last9 = cleanPhone.slice(-9);
    await prisma.chatTicket.updateMany({
      where: {
        OR: [
          { whatsappPhone: cleanPhone },
          { whatsappPhone: { endsWith: last9 } },
        ],
        clientOwnerId: null,
      },
      data: {
        clientOwnerId: created.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Cliente creado con éxito.',
      data: created,
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ success: false, message: 'Error interno al registrar el cliente.' });
  }
});

/**
 * PUT /api/clients/:id
 * Actualiza los datos de un Dueño Pagador
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido.' });
      return;
    }

    const { fullName, whatsappPhone, securityPin, isVip, dataConsentSigned, notes } = req.body;

    const updated = await prisma.clientOwner.update({
      where: { id },
      data: {
        ...(fullName ? { fullName: fullName.trim() } : {}),
        ...(whatsappPhone ? { whatsappPhone: whatsappPhone.trim().replace(/\D/g, '') } : {}),
        ...(securityPin !== undefined ? { securityPin } : {}),
        ...(isVip !== undefined ? { isVip: Boolean(isVip) } : {}),
        ...(dataConsentSigned !== undefined ? { dataConsentSigned: Boolean(dataConsentSigned) } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    res.json({
      success: true,
      message: 'Cliente actualizado con éxito.',
      data: updated,
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ success: false, message: 'Error interno al actualizar el cliente.' });
  }
});

/**
 * POST /api/clients/:id/taxpayers
 * Agrega una Empresa / RUC a un Dueño Pagador
 */
router.post('/:id/taxpayers', async (req: Request, res: Response): Promise<void> => {
  try {
    const clientOwnerId = parseInt(req.params.id as string, 10);
    if (isNaN(clientOwnerId)) {
      res.status(400).json({ success: false, message: 'ID de cliente inválido.' });
      return;
    }

    const isAssistant = req.user?.role === 'ASISTENTE';
    const {
      razonSocial,
      ruc,
      regimen,
      email,
      claveSri,
      claveFirma,
      firmaExpira,
      claveSalar,
      claveSut,
      claveIess,
      claveSupercias,
      expSupercias,
      claveSercop,
      checkDecla,
      checkIce,
      checkAnexo,
      checkIva,
      checkSalar,
      checkSut,
      checkIess,
      checkSupercias,
      checkPatente,
      autoBillFreq,
      autoBillAmount,
      appliesVat,
      devIvaPercent,
    } = req.body;

    if (!razonSocial || !razonSocial.trim()) {
      res.status(400).json({ success: false, message: 'La razón social es obligatoria.' });
      return;
    }

    const novenoDigito = extractNovenoDigito(ruc);
    const fechaDecla = calculateFechaDecla(ruc, regimen);

    const data: any = {
      clientOwnerId,
      razonSocial: razonSocial.trim(),
      ruc: ruc ? ruc.trim() : null,
      novenoDigito,
      fechaDecla,
      regimen: regimen || TaxRegime.MENSUAL,
      email: email ? email.trim() : null,
      claveSri: claveSri || null,
      claveFirma: claveFirma || null,
      firmaExpira: firmaExpira ? new Date(firmaExpira) : null,
      claveSalar: claveSalar || null,
      claveSut: claveSut || null,
      claveIess: claveIess || null,
      claveSupercias: claveSupercias || null,
      expSupercias: expSupercias || null,
      claveSercop: claveSercop || null,
      checkDecla: Boolean(checkDecla),
      checkIce: Boolean(checkIce),
      checkAnexo: Boolean(checkAnexo),
      checkIva: Boolean(checkIva),
      checkSalar: Boolean(checkSalar),
      checkSut: Boolean(checkSut),
      checkIess: Boolean(checkIess),
      checkSupercias: Boolean(checkSupercias),
      checkPatente: Boolean(checkPatente),
      declaDetalle: req.body.declaDetalle !== undefined ? (req.body.declaDetalle ? String(req.body.declaDetalle).trim() : null) : null,
      iceDetalle: req.body.iceDetalle !== undefined ? (req.body.iceDetalle ? String(req.body.iceDetalle).trim() : null) : null,
      anexoDetalle: req.body.anexoDetalle !== undefined ? (req.body.anexoDetalle ? String(req.body.anexoDetalle).trim() : null) : null,
      ivaDetalle: req.body.ivaDetalle !== undefined ? (req.body.ivaDetalle ? String(req.body.ivaDetalle).trim() : null) : null,
      salarDetalle: req.body.salarDetalle !== undefined ? (req.body.salarDetalle ? String(req.body.salarDetalle).trim() : null) : null,
      sutDetalle: req.body.sutDetalle !== undefined ? (req.body.sutDetalle ? String(req.body.sutDetalle).trim() : null) : null,
      iessDetalle: req.body.iessDetalle !== undefined ? (req.body.iessDetalle ? String(req.body.iessDetalle).trim() : null) : null,
      superciasDetalle: req.body.superciasDetalle !== undefined ? (req.body.superciasDetalle ? String(req.body.superciasDetalle).trim() : null) : null,
      patenteDetalle: req.body.patenteDetalle !== undefined ? (req.body.patenteDetalle ? String(req.body.patenteDetalle).trim() : null) : null,
      servicesBreakdown: req.body.servicesBreakdown !== undefined ? (req.body.servicesBreakdown ? String(req.body.servicesBreakdown).trim() : null) : null,
    };

    // Solo ADMIN_MAYRA puede configurar precios de cobro
    if (!isAssistant) {
      if (autoBillFreq) data.autoBillFreq = autoBillFreq;
      if (autoBillAmount !== undefined) data.autoBillAmount = Number(autoBillAmount);
      if (appliesVat !== undefined) data.appliesVat = Boolean(appliesVat);
      if (devIvaPercent !== undefined) data.devIvaPercent = Number(devIvaPercent);
    }

    const created = await prisma.taxpayer.create({
      data,
    });

    // Generar de inmediato los cargos iniciales de los servicios configurados si aplica
    if (!isAssistant && created.autoBillFreq !== BillingFrequency.NONE) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const periodText = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      let servicesList: Array<{ concepto: string; monto: number }> = [];
      if (created.servicesBreakdown && created.servicesBreakdown.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(created.servicesBreakdown);
          if (Array.isArray(parsed)) {
            servicesList = parsed
              .filter(s => s && typeof s.concepto === 'string' && Number(s.monto) > 0)
              .map(s => ({ concepto: String(s.concepto).trim(), monto: Number(s.monto) }));
          }
        } catch {}
      }
      if (servicesList.length === 0 && Number(created.autoBillAmount) > 0) {
        servicesList = [{ concepto: `Honorarios Contables - ${created.razonSocial}`, monto: Number(created.autoBillAmount) }];
      }

      for (let sIndex = 0; sIndex < servicesList.length; sIndex++) {
        const service = servicesList[sIndex];
        const subPeriodText = servicesList.length > 1 ? `${periodText}-S${sIndex + 1}` : periodText;
        const fullConcept = service.concepto.includes(created.razonSocial)
          ? `${service.concepto} (${periodText})`
          : `${service.concepto} (${periodText}) - ${created.razonSocial}`;

        try {
          await prisma.ledgerEntry.create({
            data: {
              clientOwnerId: created.clientOwnerId,
              taxpayerId: created.id,
              entryType: EntryType.CARGO_AUTOMATICO,
              concept: fullConcept,
              periodText: subPeriodText,
              amount: service.monto,
              bankAccount: BankAccount.NO_APLICA,
            },
          });
        } catch (err: any) {
          // Si ya existe por constraint unique, omitir
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Empresa / RUC registrado con éxito.',
      data: created,
    });
  } catch (error) {
    console.error('Error al agregar taxpayer:', error);
    res.status(500).json({ success: false, message: 'Error interno al registrar empresa/RUC.' });
  }
});

/**
 * PUT /api/clients/taxpayers/:taxpayerId
 * Actualiza una Empresa / RUC
 */
router.put('/taxpayers/:taxpayerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const taxpayerId = parseInt(req.params.taxpayerId as string, 10);
    if (isNaN(taxpayerId)) {
      res.status(400).json({ success: false, message: 'ID inválido.' });
      return;
    }

    const isAssistant = req.user?.role === 'ASISTENTE';
    const body = req.body;

    const dataToUpdate: any = {};

    if (body.razonSocial) dataToUpdate.razonSocial = body.razonSocial.trim();
    if (body.ruc !== undefined) {
      dataToUpdate.ruc = body.ruc ? body.ruc.trim() : null;
      dataToUpdate.novenoDigito = extractNovenoDigito(body.ruc);
      dataToUpdate.fechaDecla = calculateFechaDecla(body.ruc, body.regimen);
    }
    if (body.regimen) dataToUpdate.regimen = body.regimen;
    if (body.email !== undefined) dataToUpdate.email = body.email ? body.email.trim() : null;
    if (body.claveSri !== undefined) dataToUpdate.claveSri = body.claveSri;
    if (body.claveFirma !== undefined) dataToUpdate.claveFirma = body.claveFirma;
    if (body.firmaExpira !== undefined) {
      dataToUpdate.firmaExpira = body.firmaExpira ? new Date(body.firmaExpira) : null;
    }
    if (body.claveSalar !== undefined) dataToUpdate.claveSalar = body.claveSalar;
    if (body.claveSut !== undefined) dataToUpdate.claveSut = body.claveSut;
    if (body.claveIess !== undefined) dataToUpdate.claveIess = body.claveIess;
    if (body.claveSupercias !== undefined) dataToUpdate.claveSupercias = body.claveSupercias;
    if (body.expSupercias !== undefined) dataToUpdate.expSupercias = body.expSupercias;
    if (body.claveSercop !== undefined) dataToUpdate.claveSercop = body.claveSercop;

    if (body.checkDecla !== undefined) dataToUpdate.checkDecla = Boolean(body.checkDecla);
    if (body.checkIce !== undefined) dataToUpdate.checkIce = Boolean(body.checkIce);
    if (body.checkAnexo !== undefined) dataToUpdate.checkAnexo = Boolean(body.checkAnexo);
    if (body.checkIva !== undefined) dataToUpdate.checkIva = Boolean(body.checkIva);
    if (body.checkSalar !== undefined) dataToUpdate.checkSalar = Boolean(body.checkSalar);
    if (body.checkSut !== undefined) dataToUpdate.checkSut = Boolean(body.checkSut);
    if (body.checkIess !== undefined) dataToUpdate.checkIess = Boolean(body.checkIess);
    if (body.checkSupercias !== undefined) dataToUpdate.checkSupercias = Boolean(body.checkSupercias);
    if (body.checkPatente !== undefined) dataToUpdate.checkPatente = Boolean(body.checkPatente);

    if (body.declaDetalle !== undefined) dataToUpdate.declaDetalle = body.declaDetalle ? String(body.declaDetalle).trim() : null;
    if (body.iceDetalle !== undefined) dataToUpdate.iceDetalle = body.iceDetalle ? String(body.iceDetalle).trim() : null;
    if (body.anexoDetalle !== undefined) dataToUpdate.anexoDetalle = body.anexoDetalle ? String(body.anexoDetalle).trim() : null;
    if (body.ivaDetalle !== undefined) dataToUpdate.ivaDetalle = body.ivaDetalle ? String(body.ivaDetalle).trim() : null;
    if (body.salarDetalle !== undefined) dataToUpdate.salarDetalle = body.salarDetalle ? String(body.salarDetalle).trim() : null;
    if (body.sutDetalle !== undefined) dataToUpdate.sutDetalle = body.sutDetalle ? String(body.sutDetalle).trim() : null;
    if (body.iessDetalle !== undefined) dataToUpdate.iessDetalle = body.iessDetalle ? String(body.iessDetalle).trim() : null;
    if (body.superciasDetalle !== undefined) dataToUpdate.superciasDetalle = body.superciasDetalle ? String(body.superciasDetalle).trim() : null;
    if (body.patenteDetalle !== undefined) dataToUpdate.patenteDetalle = body.patenteDetalle ? String(body.patenteDetalle).trim() : null;
    if (body.servicesBreakdown !== undefined) dataToUpdate.servicesBreakdown = body.servicesBreakdown ? String(body.servicesBreakdown).trim() : null;

    // Campos financieros bloqueados para Asistente
    if (!isAssistant) {
      if (body.autoBillFreq !== undefined) dataToUpdate.autoBillFreq = body.autoBillFreq;
      if (body.autoBillAmount !== undefined) dataToUpdate.autoBillAmount = Number(body.autoBillAmount);
      if (body.appliesVat !== undefined) dataToUpdate.appliesVat = Boolean(body.appliesVat);
      if (body.devIvaPercent !== undefined) dataToUpdate.devIvaPercent = Number(body.devIvaPercent);
    }

    const updated = await prisma.taxpayer.update({
      where: { id: taxpayerId },
      data: dataToUpdate,
    });

    // Sincronizar/crear cargos de cuenta corriente si se configuraron servicios
    if (!isAssistant && updated.autoBillFreq !== BillingFrequency.NONE) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const periodText = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      let servicesList: Array<{ concepto: string; monto: number }> = [];
      if (updated.servicesBreakdown && updated.servicesBreakdown.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(updated.servicesBreakdown);
          if (Array.isArray(parsed)) {
            servicesList = parsed
              .filter(s => s && typeof s.concepto === 'string' && Number(s.monto) > 0)
              .map(s => ({ concepto: String(s.concepto).trim(), monto: Number(s.monto) }));
          }
        } catch {}
      }
      if (servicesList.length === 0 && Number(updated.autoBillAmount) > 0) {
        servicesList = [{ concepto: `Honorarios Contables - ${updated.razonSocial}`, monto: Number(updated.autoBillAmount) }];
      }

      for (let sIndex = 0; sIndex < servicesList.length; sIndex++) {
        const service = servicesList[sIndex];
        const subPeriodText = servicesList.length > 1 ? `${periodText}-S${sIndex + 1}` : periodText;
        const fullConcept = service.concepto.includes(updated.razonSocial)
          ? `${service.concepto} (${periodText})`
          : `${service.concepto} (${periodText}) - ${updated.razonSocial}`;

        try {
          // Si ya existe el cargo automático para este periodo, actualizamos el monto si cambió
          const existing = await prisma.ledgerEntry.findFirst({
            where: {
              taxpayerId: updated.id,
              periodText: subPeriodText,
              entryType: EntryType.CARGO_AUTOMATICO,
            },
          });

          if (existing) {
            await prisma.ledgerEntry.update({
              where: { id: existing.id },
              data: {
                concept: fullConcept,
                amount: service.monto,
              },
            });
          } else {
            await prisma.ledgerEntry.create({
              data: {
                clientOwnerId: updated.clientOwnerId,
                taxpayerId: updated.id,
                entryType: EntryType.CARGO_AUTOMATICO,
                concept: fullConcept,
                periodText: subPeriodText,
                amount: service.monto,
                bankAccount: BankAccount.NO_APLICA,
              },
            });
          }
        } catch (err: any) {
          // Omitir errores de concurrencia
        }
      }
    }

    res.json({
      success: true,
      message: 'Empresa / RUC actualizado con éxito.',
      data: updated,
    });
  } catch (error) {
    console.error('Error al actualizar taxpayer:', error);
    res.status(500).json({ success: false, message: 'Error interno al actualizar.' });
  }
});

/**
 * DELETE /api/clients/:id
 * Elimina un Cliente Dueño y toda su información en cascada (Empresas, RUCs, Documentos, Contabilidad, etc.)
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido.' });
      return;
    }

    const client = await prisma.clientOwner.findUnique({
      where: { id },
      include: {
        taxpayers: true,
      },
    });

    if (!client) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
      return;
    }

    // Desvincular o limpiar ChatTickets asociados si los hubiere
    await prisma.chatTicket.updateMany({
      where: { clientOwnerId: id },
      data: { clientOwnerId: null },
    });

    // Eliminar el cliente dueño (Prisma y la BD eliminarán en cascada taxpayers, ledger, documentos, etc.)
    await prisma.clientOwner.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: `Cliente ${client.fullName} y toda su información asociada han sido eliminados con éxito.`,
    });
  } catch (error) {
    console.error('Error al eliminar cliente dueño:', error);
    res.status(500).json({ success: false, message: 'Error interno al eliminar el cliente.' });
  }
});

/**
 * DELETE /api/clients/taxpayers/:taxpayerId
 */
router.delete('/taxpayers/:taxpayerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const taxpayerId = parseInt(req.params.taxpayerId as string, 10);
    if (isNaN(taxpayerId)) {
      res.status(400).json({ success: false, message: 'ID inválido.' });
      return;
    }

    await prisma.taxpayer.delete({
      where: { id: taxpayerId },
    });

    res.json({
      success: true,
      message: 'Empresa / RUC eliminado con éxito.',
    });
  } catch (error) {
    console.error('Error al eliminar taxpayer:', error);
    res.status(500).json({ success: false, message: 'Error interno al eliminar.' });
  }
});

export default router;
