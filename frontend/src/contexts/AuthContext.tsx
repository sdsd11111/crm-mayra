'use client';

// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, LoginResponse } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('crm_token');
      const cached = localStorage.getItem('crm_user');

      if (!storedToken || !cached) {
        setIsLoading(false);
        return;
      }

      // Inicializar de inmediato con el usuario y token guardados localmente para evitar parpadeos y cierres de sesión
      setToken(storedToken);
      try {
        const parsedUser = JSON.parse(cached);
        setUser(parsedUser);
      } catch {
        // Ignorar error de parsing si existiera
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem('crm_user', JSON.stringify(data.user));
        } else if (res.status === 401 || res.status === 403) {
          // Solo si el servidor rechaza explícitamente el token por expirado o inválido
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_user');
          setUser(null);
          setToken(null);
        }
      } catch {
        // En caso de corte de red o reinicio del backend, preservar la sesión del usuario con el token guardado
        try {
          setUser(JSON.parse(cached));
        } catch {
          setUser(null);
          setToken(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Credenciales inválidas.');
    }

    const { token: loggedToken, user: loggedUser } = data as LoginResponse;
    localStorage.setItem('crm_token', loggedToken);
    localStorage.setItem('crm_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
    setToken(loggedToken);
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

