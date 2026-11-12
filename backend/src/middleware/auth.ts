// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUserPayload, UserRoleType } from '../types/express';

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ error: 'Token de acceso no proporcionado.' });
    return;
  }

  const secret = process.env.JWT_SECRET || 'secret';

  jwt.verify(token, secret, (err, decoded) => {
    if (err || !decoded) {
      res.status(403).json({ error: 'Token inválido o expirado.' });
      return;
    }

    req.user = decoded as AuthUserPayload;
    next();
  });
}

export function requireRole(allowedRoles: UserRoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Acceso denegado: Tu rol no tiene permisos para esta acción (Modo Ciego).'
      });
      return;
    }

    next();
  };
}
