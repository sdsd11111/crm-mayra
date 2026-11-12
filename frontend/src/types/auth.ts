// frontend/src/types/auth.ts
export type UserRole = 'ADMIN_MAYRA' | 'ASISTENTE';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

