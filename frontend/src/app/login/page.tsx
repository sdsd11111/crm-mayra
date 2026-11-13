'use client';

// frontend/src/app/login/page.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function LoginForm() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Por favor ingresa tu nombre de usuario.');
      return;
    }
    if (!password) {
      setError('Por favor ingresa tu contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim().toLowerCase(), password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al conectar con el servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#166BA3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Círculos decorativos de fondo */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[#166BA3]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-[#1E2A3C]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Cabecera con Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center px-4 py-2 h-16 max-w-[240px] rounded-2xl bg-white shadow-md border border-gray-100 mb-4">
            <img
              src="/Logo.jpg"
              alt="Mayra Castillo"
              className="h-12 w-auto max-w-full object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<span class="text-3xl font-bold" style="color:#166BA3">MC</span>';
                }
              }}
            />
          </div>
          <h1 className="text-xl font-bold text-[#1E2A3C]">Estudio Contable</h1>
          <p className="text-[#166BA3] font-semibold text-lg leading-tight">Mayra Castillo</p>
          <p className="text-gray-400 text-xs mt-1">Loja, Ecuador</p>
        </div>

        {/* Tarjeta Glassmorphism */}
        <div className="bg-white/85 backdrop-blur-md border border-white/60 shadow-xl rounded-3xl p-8">
          <div className="mb-6">
            <h2 className="text-[#1E2A3C] text-xl font-bold">Iniciar Sesión</h2>
            <p className="text-gray-500 text-sm mt-1">Sistema de Gestión Contable</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#1E2A3C] mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={18} />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mayra"
                  autoComplete="username"
                  autoFocus
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200/80 bg-white/70
                             text-[#1E2A3C] placeholder-gray-400 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#166BA3]/40 focus:border-[#166BA3]
                             transition-all duration-200 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#1E2A3C] mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200/80 bg-white/70
                             text-[#1E2A3C] placeholder-gray-400 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#166BA3]/40 focus:border-[#166BA3]
                             transition-all duration-200 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1E2A3C] transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1E2A3C] text-white font-semibold py-3.5 px-6 rounded-xl
                         hover:bg-[#1E2A3C]/90 active:scale-[0.98] transition-all duration-200
                         focus:outline-none focus:ring-2 focus:ring-[#166BA3] focus:ring-offset-2
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2.5"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 Estudio Contable Mayra Castillo · Loja, Ecuador
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}

