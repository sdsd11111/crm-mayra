// backend/src/types/express.d.ts
export type UserRoleType = 'ADMIN_MAYRA' | 'ASISTENTE';

export interface AuthUserPayload {
  id: number;
  username: string;
  role: UserRoleType;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
