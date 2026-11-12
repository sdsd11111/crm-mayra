// backend/src/routes/tasks.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

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
 * POST /api/tasks
 * Crea una nueva tarea (para Mayra o para asistentes)
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, priority, dueDate, assignedToId } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: 'El título de la tarea es obligatorio.' });
      return;
    }

    const assignedId = assignedToId ? parseInt(assignedToId, 10) : req.user!.id;

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'MEDIA',
        status: 'PENDIENTE',
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: req.user!.id,
        assignedToId: assignedId,
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
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status, title, description, priority, dueDate, assignedToId } = req.body;

    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido.' });
      return;
    }

    const dataToUpdate: any = {};
    if (status) {
      dataToUpdate.status = status;
      if (status === 'COMPLETADA') {
        dataToUpdate.completedAt = new Date();
      } else {
        dataToUpdate.completedAt = null;
      }
    }
    if (title !== undefined) dataToUpdate.title = title.trim();
    if (description !== undefined) dataToUpdate.description = description ? description.trim() : null;
    if (priority !== undefined) dataToUpdate.priority = priority;
    if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedToId !== undefined) dataToUpdate.assignedToId = parseInt(assignedToId, 10);

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

