// frontend/src/app/supercias/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import {
  FileText,
  Download,
  Building2,
  DollarSign,
  User,
  CheckCircle,
  Calendar,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

function SuperciasView() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Formulario Supercias
  const [companyName, setCompanyName] = useState('Dharma Comercial SAS');
  const [ruc, setRuc] = useState('1191797001001');
  const [year, setYear] = useState(2025);
  const [capital, setCapital] = useState('400.00');
  const [bancos, setBancos] = useState('400.00');
  const [utilidadPerdida, setUtilidadPerdida] = useState('0.00');
  const [gerenteName, setGerenteName] = useState('Pedro Rojas');
  const [presidenteName, setPresidenteName] = useState('Carlos Delgado');
  const [downloading, setDownloading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#166BA3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleDownloadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/supercias/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName,
          ruc,
          year: Number(year),
          capital: Number(capital),
          bancos: Number(bancos),
          utilidadPerdida: Number(utilidadPerdida),
          gerenteName,
          presidenteName,
        }),
      });

      if (!res.ok) throw new Error('Error al generar PDF de Supercias.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Supercias_${companyName.replace(/\s+/g, '_')}_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] pb-16 md:pl-64 overflow-x-hidden max-w-full">
      <Navbar />

      <main className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 space-y-6 overflow-x-hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E2A3C] flex items-center gap-2">
            <FileText className="text-[#166BA3]" size={24} />
            Informes de Superintendencia de Compañías
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Generación oficial del paquete de 3 documentos obligatorios: Acta de Junta, Informe de Gerente y Notas a los Estados Financieros.
          </p>
        </div>

        {/* Formulario Principal de Supercias */}
        <div className="bg-white/95 backdrop-blur-md border border-white/80 shadow-xs rounded-2xl p-6 sm:p-7">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
            <div>
              <span className="text-[10px] font-semibold text-[#166BA3] uppercase tracking-wider block">
                Cumplimiento Anual
              </span>
              <h2 className="text-base font-bold text-[#1E2A3C] mt-0.5">
                Datos de la Sociedad y Ejercicio Económico
              </h2>
            </div>
            <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
              Acta + Gerente + Notas
            </span>
          </div>

          <form onSubmit={handleDownloadPdf} className="space-y-4 text-xs">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Razón Social de la Compañía *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ej. Comercializadora San Carlos Cía. Ltda."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">RUC de la Compañía *</label>
                <input
                  type="text"
                  required
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  placeholder="1191797001001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-mono text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Año Fiscal del Balance *</label>
                <input
                  type="number"
                  required
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-mono text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Capital Social Suscrito ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-mono text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Saldo en Bancos / Caja ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={bancos}
                  onChange={(e) => setBancos(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-mono text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Utilidad o Pérdida Neta ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={utilidadPerdida}
                  onChange={(e) => setUtilidadPerdida(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-mono text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Nombre del Representante Legal / Gerente *</label>
                <input
                  type="text"
                  required
                  value={gerenteName}
                  onChange={(e) => setGerenteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Nombre del Presidente de Junta (Opcional)</label>
                <input
                  type="text"
                  value={presidenteName}
                  onChange={(e) => setPresidenteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={downloading}
                className="bg-[#166BA3] text-white px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#135887] active:scale-95 transition-all shadow-xs disabled:opacity-50 text-xs"
              >
                <Download size={15} />
                <span>{downloading ? 'Generando Paquete...' : 'Descargar Informes en PDF'}</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function SuperciasPage() {
  return <SuperciasView />;
}
