// backend/src/routes/supercias.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { SuperciasService } from '../services/SuperciasService';
import { EvolutionApiService } from '../services/EvolutionApiService';

const router = Router();
router.use(authenticateToken);

/**
 * POST /api/supercias/generate-pdf
 * Genera el paquete de los 3 informes de la Superintendencia de Compañías (Acta, Gerente, Notas).
 */
router.post('/generate-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyName, ruc, year, capital, bancos, utilidadPerdida, gerenteName, presidenteName } = req.body;

    if (!companyName || !ruc || !year || !gerenteName) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios (companyName, ruc, year, gerenteName).',
      });
      return;
    }

    const pdfBuffer = await SuperciasService.generateSuperciasReports({
      companyName: companyName.trim(),
      ruc: ruc.trim(),
      year: parseInt(year, 10),
      capital: Number(capital || 400),
      bancos: Number(bancos || 400),
      utilidadPerdida: Number(utilidadPerdida || 0),
      gerenteName: gerenteName.trim(),
      presidenteName: presidenteName ? presidenteName.trim() : undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Supercias_${companyName.replace(/\s+/g, '_')}_${year}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar informe de Supercias:', error);
    res.status(500).json({ success: false, message: 'Error interno al generar informe Supercias.' });
  }
});

/**
 * POST /api/supercias/send-renta-projections
 * Módulo de envío masivo semestral de Proyecciones de Impuesto a la Renta (Mayo / Octubre).
 */
router.post('/send-renta-projections', async (req: Request, res: Response): Promise<void> => {
  try {
    const { periodSemester, year } = req.body; // 'I' (Mayo) | 'II' (Octubre)
    const sem = periodSemester || 'II';
    const yr = year || new Date().getFullYear();

    // Obtener clientes activos con WhatsApp
    const clients = await prisma.clientOwner.findMany({
      where: {
        whatsappPhone: { not: '' },
      },
      include: {
        taxpayers: true,
      },
    });

    let sentCount = 0;
    for (const c of clients) {
      const empresas = c.taxpayers.map((t) => t.razonSocial).join(', ') || c.fullName;
      const text =
        `Estimado(a) ${c.fullName} (${empresas}):\n\n` +
        `📊 Le saludamos del Estudio Contable Mayra Castillo. Le recordamos que estamos en temporada de *Proyección de Impuesto a la Renta (${yr} - Semestre ${sem})*.\n\n` +
        `Es fundamental que revise con anticipación sus facturas de gastos y compras para proyectar oportunamente sus impuestos y evitar sorpresas al cierre de año.\n\n` +
        `Por favor confírmenos si ya tiene listas sus facturas o si requiere que le preparemos su proyección preliminar. ¡Que tenga un excelente día!`;

      await EvolutionApiService.sendTextMessage({
        number: c.whatsappPhone,
        text,
      });

      sentCount++;
    }

    res.json({
      success: true,
      message: `Proyecciones de Renta notificadas exitosamente a ${sentCount} clientes vía WhatsApp.`,
      count: sentCount,
    });
  } catch (error) {
    console.error('Error al enviar proyecciones:', error);
    res.status(500).json({ success: false, message: 'Error al enviar proyecciones.' });
  }
});

export default router;

