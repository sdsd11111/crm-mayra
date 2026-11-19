// frontend/src/components/Sidebar.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LogOut,
  LayoutDashboard,
  Users,
  Shield,
  User,
  MessageSquare,
  FileCheck,
  Settings,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

const ROLE_INFO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN_MAYRA: {
    label: 'Administradora (Mayra)',
    color: 'bg-[#166BA3]/15 text-[#166BA3] border-[#166BA3]/30',
    icon: <Shield size={13} />,
  },
  ASISTENTE: {
    label: 'Asistente Operativo',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <User size={13} />,
  },
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Scroll-aware header: se oculta al bajar, aparece al subir ──
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        // Leer scrollTop del elemento que realmente scrolleó (puede ser window o un div)
        const target = e.target as Element | Document;
        const currentY =
          target === document
            ? (document.documentElement.scrollTop || document.body.scrollTop)
            : (target as Element).scrollTop ?? window.scrollY;

        const delta = currentY - lastScrollY.current;
        if (Math.abs(delta) > 3) {
          setHeaderVisible(currentY < 60 || delta < 0);
          lastScrollY.current = currentY;
        }
        ticking.current = false;
      });
    };

    // capture:true para interceptar el scroll de CUALQUIER contenedor hijo
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
    };
  }, []);

  if (!user) return null;

  const currentRole = ROLE_INFO[user.role] || {
    label: user.role === 'ADMIN_MAYRA' ? 'Administradora' : 'Asistente',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: <User size={13} />,
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/clientes', label: 'Directorio de Clientes', icon: <Users size={18} /> },
    { href: '/whatsapp', label: 'Centro WhatsApp', icon: <MessageSquare size={18} /> },
    { href: '/supercias', label: 'Informes Supercias', icon: <FileCheck size={18} /> },
    ...(user.role === 'ADMIN_MAYRA'
      ? [
        { href: '/configuracion', label: 'Configuración', icon: <Settings size={18} /> },
      ]
      : []),
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between">
      <div>
        {/* Brand Header — Solo el Logo de Mayra limpio */}
        <div className="h-20 px-6 border-b border-gray-100 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center">
            <img
              src="/Logo.jpg"
              alt="Mayra Castillo"
              className="h-12 w-auto object-contain rounded-md"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </Link>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-gray-50/80 border border-gray-100">
          <div className="flex items-center gap-2.5 mb-1.5">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName || user.username}
                className="w-8 h-8 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#1E2A3C] text-white flex items-center justify-center text-xs font-bold uppercase shadow-xs">
                {user.username.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#1E2A3C] truncate">{user.fullName || user.username}</p>
              <p className="text-[10px] text-gray-400">@{user.username}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${currentRole.color} w-full justify-center`}
          >
            {currentRole.icon}
            <span className="truncate">{currentRole.label}</span>
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="px-3 space-y-1">
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-3 py-1.5">
            Módulos
          </p>
          {navLinks.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href)) ||
              (item.href === '/configuracion' &&
                (pathname === '/configuracion' ||
                  pathname === '/whatsapp/configuracion' ||
                  pathname === '/usuarios'));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? 'bg-[#1E2A3C] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#1E2A3C]'
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-[#166BA3]' : 'text-gray-400'}>{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </div>
                <ChevronRight size={14} className={isActive ? 'text-white/70' : 'text-gray-300'} />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <button
          onClick={() => {
            logout();
            router.replace('/login');
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-red-600 bg-red-50/60 border border-red-100 hover:bg-red-50 transition-colors"
        >
          <LogOut size={15} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ═════════ BARRA MÓVIL SUPERIOR (< md) ═════════ */}
      {/* Spacer para compensar el header fixed en móvil */}
      <div className="md:hidden h-14 shrink-0" aria-hidden="true" />
      <header
        className={`md:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 h-14 flex items-center justify-between transition-transform duration-300 ease-in-out ${
          headerVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 border border-gray-200"
        >
          <Menu size={20} />
        </button>

        <img src="/Logo.jpg" alt="Mayra Castillo" className="h-8 w-auto object-contain" />

        <div className="w-8 h-8 rounded-full bg-[#1E2A3C] text-white flex items-center justify-center text-xs font-bold uppercase">
          {user.username.charAt(0)}
        </div>
      </header>

      {/* ═════════ SIDEBAR FIJO DE ESCRITORIO (md en adelante) ═════════ */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200/90 h-screen fixed left-0 top-0 z-30 shadow-xs">
        {sidebarContent}
      </aside>

      {/* ═════════ DRAWER MÓVIL ═════════ */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#1E2A3C]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85%] bg-white h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
