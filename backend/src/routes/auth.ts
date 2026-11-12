// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/login — Autenticación exclusiva por username y password
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'secret';

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
      },
      secret,
      { expiresIn: '3650d' } // 10 años — sesión permanente sin caducidad
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/auth/me — Obtener usuario en sesión
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(404).json({ error: 'Usuario no encontrado o inactivo.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Error en /me:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ============================================================================
// GESTIÓN DE USUARIOS (Solo accesible para ADMIN_MAYRA)
// Permite a Mayra crear, listar, cambiar contraseña y activar/desactivar cuentas
// ============================================================================

// GET /api/auth/users — Listar todos los usuarios
router.get('/users', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'ADMIN_MAYRA') {
      res.status(403).json({ error: 'Solo la administradora puede gestionar usuarios.' });
      return;
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({ error: 'Error al listar usuarios.' });
  }
});

// POST /api/auth/users — Crear un nuevo usuario
router.post('/users', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'ADMIN_MAYRA') {
      res.status(403).json({ error: 'Solo la administradora puede crear usuarios.' });
      return;
    }

    const { username, fullName, password, role, avatarUrl } = req.body;

    if (!username || !password || !fullName || !role) {
      res.status(400).json({ error: 'Todos los campos son requeridos: username, fullName, password, role.' });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase().replace(/\s+/g, '');

    if (cleanUsername.length < 3) {
      res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
      return;
    }

    // Solo existen 2 roles: ADMIN_MAYRA y ASISTENTE
    if (!['ADMIN_MAYRA', 'ASISTENTE'].includes(role)) {
      res.status(400).json({ error: 'Rol no válido. Permitidos: ADMIN_MAYRA, ASISTENTE.' });
      return;
    }

    // Verificar si ya existe el username
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (existing) {
      res.status(400).json({ error: `El usuario "${cleanUsername}" ya existe en el sistema.` });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        fullName: String(fullName).trim(),
        avatarUrl: avatarUrl || null,
        passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: `Usuario @${newUser.username} creado exitosamente.`,
      user: newUser,
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario.' });
  }
});

// PUT /api/auth/users/:id — Actualizar datos, avatar o cambiar contraseña
router.put('/users/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'ADMIN_MAYRA') {
      res.status(403).json({ error: 'Solo la administradora puede modificar usuarios.' });
      return;
    }

    const targetId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const { fullName, role, password, isActive, avatarUrl } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    // Si es el usuario principal "mayra", proteger contra auto-desactivación o cambio de rol
    if (targetUser.username === 'mayra' && (isActive === false || (role && role !== 'ADMIN_MAYRA'))) {
      res.status(400).json({ error: 'No se puede desactivar ni quitar privilegios a la cuenta principal de Mayra.' });
      return;
    }

    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = String(fullName).trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl ? String(avatarUrl) : null;
    if (role && ['ADMIN_MAYRA', 'ASISTENTE'].includes(role)) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (password && String(password).trim().length >= 4) {
      updateData.passwordHash = await bcrypt.hash(String(password).trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
    });

    res.json({ success: true, message: 'Usuario actualizado correctamente.', user: updated });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// PUT /api/auth/users/:id/password — Ruta directa para cambiar contraseña
router.put('/users/:id/password', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'ADMIN_MAYRA') {
      res.status(403).json({ error: 'Solo la administradora puede cambiar contraseñas.' });
      return;
    }

    const targetId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const { newPassword, password } = req.body;
    const finalPassword = newPassword || password;

    if (!finalPassword || String(finalPassword).trim().length < 4) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(finalPassword).trim(), 10);

    await prisma.user.update({
      where: { id: targetId },
      data: { passwordHash },
    });

    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña.' });
  }
});

// DELETE /api/auth/users/:id — Eliminar permanentemente la cuenta
router.delete('/users/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'ADMIN_MAYRA') {
      res.status(403).json({ error: 'Solo la administradora puede eliminar usuarios.' });
      return;
    }

    const targetId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    if (targetUser.username === 'mayra' || targetUser.id === req.user.id) {
      res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administradora.' });
      return;
    }

    // Desvincular o reasignar referencias antes de eliminar para no violar claves foráneas
    await prisma.chatTicket.updateMany({
      where: { assignedToId: targetId },
      data: { assignedToId: null },
    });

    // Eliminar físicamente al usuario
    await prisma.user.delete({
      where: { id: targetId },
    });

    res.json({ success: true, message: `Usuario @${targetUser.username} eliminado permanentemente.` });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    // Si tiene documentos u otros registros históricos estrictos, hacemos desactivación como fallback seguro
    try {
      const targetId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
      await prisma.user.update({
        where: { id: targetId },
        data: { isActive: false },
      });
      res.json({ success: true, message: 'El usuario tiene documentos históricos asociados. Ha sido desactivado permanentemente para proteger el historial.' });
    } catch {
      res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
  }
});

export default router;
