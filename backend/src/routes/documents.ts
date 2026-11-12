// backend/src/routes/documents.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { BunnyStorageService } from '../services/BunnyStorageService';
import { DocCategory } from '@prisma/client';

const router = Router();
router.use(authenticateToken);

// Multer en memoria para procesar el archivo antes de subirlo a Bunny.net
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Máximo 50MB
  },
});

/**
 * GET /api/documents/client/:clientId
 * Lista todos los documentos de la Bóveda Digital de TODAS las razones sociales
 * pertenecientes a un Cliente Dueño (Bóveda unificada por cliente).
 */
router.get('/client/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = parseInt(req.params.clientId as string, 10);
    if (isNaN(clientId)) {
      res.status(400).json({ success: false, message: 'ID de cliente inválido.' });
      return;
    }

    const docs = await prisma.document.findMany({
      where: {
        taxpayer: {
          clientOwnerId: clientId,
        },
      },
      include: {
        taxpayer: {
          select: { id: true, razonSocial: true, ruc: true },
        },
        uploadedBy: {
          select: { id: true, username: true, fullName: true, role: true },
        },
      },
      orderBy: [
        { periodYear: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      success: true,
      count: docs.length,
      data: docs,
    });
  } catch (error) {
    console.error('Error al listar documentos del cliente:', error);
    res.status(500).json({ success: false, message: 'Error al consultar la bóveda digital unificada.' });
  }
});

/**
 * GET /api/documents/taxpayer/:id
 * Lista todos los documentos y carpetas de una empresa específica.
 */
router.get('/taxpayer/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const taxpayerId = parseInt(req.params.id as string, 10);
    if (isNaN(taxpayerId)) {
      res.status(400).json({ success: false, message: 'ID de empresa inválido.' });
      return;
    }

    const docs = await prisma.document.findMany({
      where: { taxpayerId },
      include: {
        uploadedBy: {
          select: { id: true, username: true, fullName: true, role: true },
        },
      },
      orderBy: [
        { periodYear: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      success: true,
      count: docs.length,
      data: docs,
    });
  } catch (error) {
    console.error('Error al listar documentos:', error);
    res.status(500).json({ success: false, message: 'Error al consultar la bóveda de documentos.' });
  }
});

/**
 * POST /api/documents/upload
 * Sube un archivo a la Bóveda Digital (Bunny.net o Fallback local).
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No se envió ningún archivo.' });
      return;
    }

    const {
      taxpayerId,
      category,
      title,
      periodYear,
      periodMonth,
      sendByWhatsapp,
    } = req.body;

    if (!taxpayerId || !category || !title || !periodYear) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios (taxpayerId, category, title, periodYear).',
      });
      return;
    }

    const parsedTaxpayerId = parseInt(taxpayerId, 10);
    const parsedYear = parseInt(periodYear, 10);
    const parsedMonth = periodMonth ? parseInt(periodMonth, 10) : null;

    const taxpayer = await prisma.taxpayer.findUnique({
      where: { id: parsedTaxpayerId },
      include: { clientOwner: true },
    });

    if (!taxpayer) {
      res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
      return;
    }

    const ruc = taxpayer.ruc || `ID_${taxpayer.id}`;

    // Subir a Bunny.net
    const uploadResult = await BunnyStorageService.uploadFile({
      ruc,
      year: parsedYear,
      category: category as DocCategory,
      fileName: file.originalname,
      fileBuffer: file.buffer,
      contentType: file.mimetype,
    });

    // Registrar en Base de Datos
    const doc = await prisma.document.create({
      data: {
        taxpayerId: parsedTaxpayerId,
        category: category as DocCategory,
        title: title.trim(),
        periodYear: parsedYear,
        periodMonth: parsedMonth,
        bunnyPath: uploadResult.bunnyPath,
        bunnyUrl: uploadResult.bunnyUrl,
        fileType: uploadResult.fileType,
        uploadedById: req.user!.id,
        sentByWhatsapp: Boolean(sendByWhatsapp),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Documento subido y registrado con éxito en la Bóveda Digital.',
      data: doc,
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ success: false, message: 'Error interno al procesar el documento.' });
  }
});

export default router;

