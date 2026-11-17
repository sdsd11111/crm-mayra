// backend/src/routes/tasks.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { BunnyStorageService } from '../services/BunnyStorageService';
import { SriTaskCronService } from '../services/SriTaskCronService';

const router = Router();
router.use(authenticateToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

/**
 * GET /api/tasks
 * Devuelve las tareas:
 * - Si se pasa ?all=true (solo ADMIN_MAYRA en el módulo de gestión): devuelve todas las tareas.
 * - Por defecto (Dashboard o Asistente): solo devuelve las tareas asignadas específicamente al usuario que consulta.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'ADMIN_MAYRA';
    const showAll = isAdmin && req.query.all === 'true';

    const whereCondition = showAll
      ? {}
      : { assignedToId: user.id };

    const tasks = await prisma.task.findMany({
      where: whereCondition,
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        assignedTo: {
          select: { id: true, fullName: true, username: true, role: true },
        },
      },
      orderBy: [
        { status: 'asc' }, // PENDIENTE primero
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error('Error al listar tareas:', error);
    res.status(500).json({ success: false, message: 'Error interno al consultar tareas.' });
  }
});

/**
 * POST /api/tasks/generate-sri
 * Disparo manual/on-demand del motor de generación de tareas del SRI.
 * Permite a Mayra forzar la evaluación o probar la generación en cualquier momento.
 */
router.post('/generate-sri', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'ADMIN_MAYRA') {
      res.status(403).json({ success: false, message: 'Solo Administradores pueden ejecutar la generación SRI.' });
      return;
    }

    const { date } = req.body;
    const refDate = date ? new Date(date) : new Date();

    const result = await SriTaskCronService.generateDailySriTasks(refDate);

    res.json({
      success: true,
      message: `Generador SRI completado: ${result.createdTasks} tareas creadas, ${result.skippedExisting} existentes.`,
      result,
    });
  } catch (error: any) {
    console.error('Error en /api/tasks/generate-sri:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al ejecutar generador SRI.' });
  }
});

/**
 * POST /api/tasks
 * Crea una nueva tarea (para Mayra o para asistentes), con soporte de subida de archivo opcional
 */
router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, priority, dueDate, assignedToId } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: 'El título de la tarea es obligatorio.' });
      return;
    }

    const assignedId = assignedToId ? parseInt(assignedToId, 10) : req.user!.id;

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;

    if (req.file) {
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
      // Subir archivo a Bunny Storage bajo carpeta tareas/
      const uploadRes = await BunnyStorageService.uploadFile({
        ruc: 'TAREAS',
        year: new Date().getFullYear(),
        category: 'ADJUNTOS',
        fileName: `${Date.now()}_${req.file.originalname}`,
        fileBuffer: req.file.buffer,
        contentType: req.file.mimetype,
      });
      fileUrl = uploadRes.bunnyUrl;
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'MEDIA',
        status: 'PENDIENTE',
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: req.user!.id,
        assignedToId: assignedId,
        fileUrl,
        fileName,
        fileType,
      },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
        assignedTo: { select: { id: true, fullName: true, username: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Tarea creada exitosamente.',
      task,
    });
  } catch (error) {
    console.error('Error al crear tarea:', error);
    res.status(500).json({ success: false, message: 'Error interno al crear tarea.' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Actualiza estado (COMPLETADA, PENDIENTE, etc.) o campos de la tarea
 */
router.patch('/:id', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status, title, description, priority, dueDate, assignedToId, cancelNote } = req.body;

    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido.' });
      return;
    }

    const dataToUpdate: any = {};
    if (status) {
      dataToUpdate.status = status;
      if (status === 'COMPLETADA') {
        dataToUpdate.completedAt = new Date();
        dataToUpdate.cancelNote = null;
      } else if (status === 'CANCELADA') {
        dataToUpdate.completedAt = null;
        dataToUpdate.cancelNote = cancelNote ? cancelNote.trim() : null;
      } else {
        dataToUpdate.completedAt = null;
        dataToUpdate.cancelNote = null;
      }
    }
    if (cancelNote !== undefined && !status) dataToUpdate.cancelNote = cancelNote ? cancelNote.trim() : null;
    if (title !== undefined) dataToUpdate.title = title.trim();
    if (description !== undefined) dataToUpdate.description = description ? description.trim() : null;
    if (priority !== undefined) dataToUpdate.priority = priority;
    if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedToId !== undefined) dataToUpdate.assignedToId = parseInt(assignedToId, 10);

    if (req.file) {
      dataToUpdate.fileName = req.file.originalname;
      dataToUpdate.fileType = req.file.mimetype;
      const uploadRes = await BunnyStorageService.uploadFile({
        ruc: 'TAREAS',
        year: new Date().getFullYear(),
        category: 'ADJUNTOS',
        fileName: `${Date.now()}_${req.file.originalname}`,
        fileBuffer: req.file.buffer,
        contentType: req.file.mimetype,
      });
      dataToUpdate.fileUrl = uploadRes.bunnyUrl;
    }

    const task = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
        assignedTo: { select: { id: true, fullName: true, username: true } },
      },
    });

    res.json({
      success: true,
      message: 'Tarea actualizada.',
      task,
    });
  } catch (error) {
    console.error('Error al actualizar tarea:', error);
    res.status(500).json({ success: false, message: 'Error interno al actualizar tarea.' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Elimina una tarea
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido.' });
      return;
    }

    await prisma.task.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Tarea eliminada exitosamente.',
    });
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar tarea.' });
  }
});

export default router;

