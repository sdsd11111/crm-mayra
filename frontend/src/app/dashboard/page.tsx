// frontend/src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Building2,
  Plus,
  ArrowRight,
  CheckCircle,
  Calendar,
  X,
  Wallet,
  AlertTriangle,
  Key,
  Send,
  Landmark,
  Banknote,
  ChevronRight,
  ChevronDown,
  Search,
  ExternalLink,
  Zap,
  MessageSquare,
  CheckCheck,
  Copy,
  FileText,
  Bell,
  ShieldAlert,
  CheckSquare,
  UserPlus,
} from 'lucide-react';

// ─────────────────────────── Types ───────────────────────────

interface Client {
  id: number;
  fullName: string;
  whatsappPhone?: string;
  isVip?: boolean;
  saldoPendienteTotal?: number;
  taxpayers?: { razonSocial: string; ruc?: string }[];
}

interface BankSummary {
  totalRecaudadoMes: number;
  totalCarteraPendiente: number;
  banks: {
    pichincha: number;
    loja: number;
    jep: number;
    efectivo: number;
  };
}

interface TaxAlerts {
  semaforo: { verde: number; amarillo: number; rojo: number; items: TaxItem[] };
  firmaAlerts: { count: number; items: FirmaItem[] };
}

interface TaxItem {
  clientId?: number;
  razonSocial: string;
  dueDay: number;
  estado: 'VERDE' | 'AMARILLO' | 'ROJO';
  daysUntilDue?: number;
  claveSri?: string;
}

interface FirmaItem {
  razonSocial: string;
  clientName?: string;
  daysLeft: number;
}

interface WhatsappStats {
  pendingMessages: { gerencial: number; operativa: number; cobranza: number };
}

interface Debtor {
  clientId?: number;
  clientName: string;
  saldoPendiente: number;
  daysOverdue: number;
  lastPayment: string | null;
  whatsappPhone?: string;
}

interface PaymentPromise {
  id: number;
  clientId: number;
  clientName: string;
  whatsappPhone?: string;
  amount: number;
  promisedDate: string;
  notes?: string;
  isToday: boolean;
}

interface TaskItem {
  id: number;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  dueDate?: string | null;
  assignedTo: { id: number; fullName: string };
}

interface MayraAttention {
  promises: PaymentPromise[];
  gerencialTicketsCount: number;
  docsTodayCount: number;
}

// ─────────────────────────── Skeleton ────────────────────────

function KpiSkeleton() {
  return (
    <div className="bg-white/80 border border-white/80 rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-32 bg-slate-200 rounded mb-2" />
      <div className="h-2.5 w-16 bg-slate-100 rounded" />
    </div>
  );
}

// ─────────────────────────── Main View ───────────────────────

function DashboardView() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // ── State ──
  const [summary, setSummary] = useState<BankSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [isBankBreakdownOpen, setIsBankBreakdownOpen] = useState(false);

  const [taxAlerts, setTaxAlerts] = useState<TaxAlerts | null>(null);
  const [taxAlertsLoading, setTaxAlertsLoading] = useState(true);
  const [taxAlertsError, setTaxAlertsError] = useState(false);
  const [semaforoTab, setSemaforoTab] = useState<'all' | 'today' | 'tomorrow'>('all');
  const [copiedSriId, setCopiedSriId] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);

  const [whatsappStats, setWhatsappStats] = useState<WhatsappStats>({
    pendingMessages: { gerencial: 0, operativa: 0, cobranza: 0 },
  });

  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [debtorsLoading, setDebtorsLoading] = useState(true);

  // Bloque Tareas
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Bloque Atención de Mayra
  const [mayraAttention, setMayraAttention] = useState<MayraAttention | null>(null);
  const [attentionLoading, setAttentionLoading] = useState(true);

  // Modal abono
  const [isAbonoOpen, setIsAbonoOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [abonoMonto, setAbonoMonto] = useState('');
  const [abonoBanco, setAbonoBanco] = useState('BANCO_PICHINCHA');
  const [abonoConcepto, setAbonoConcepto] = useState('');
  const [savingAbono, setSavingAbono] = useState(false);
  const [abonoError, setAbonoError] = useState('');
  const [abonoSuccess, setAbonoSuccess] = useState(false);

  // Modal confirmación recordatorio WhatsApp
  const [reminderDebtor, setReminderDebtor] = useState<Debtor | null>(null);

  // Buscador
  const [clientSearch, setClientSearch] = useState('');

  const isAdmin = user?.role === 'ADMIN_MAYRA';
  const isAssistant = user?.role === 'ASISTENTE';

  // ── Auth guard ──
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // ── Fetches ──
  const fetchBankSummary = useCallback(async () => {
    if (!token || isAssistant) { setSummaryLoading(false); return; }
    try {
      const res = await fetch('/api/ledger/banks-summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setSummary(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  }, [token, isAssistant]);

  const fetchClientsList = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/clients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setClients(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchTaxAlerts = useCallback(async () => {
    if (!token) { setTaxAlertsLoading(false); return; }
    setTaxAlertsLoading(true);
    setTaxAlertsError(false);
    try {
      const res = await fetch('/api/clients/tax-alerts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTaxAlerts(data.data);
      } else {
        setTaxAlertsError(true);
      }
    } catch (err) {
      console.error(err);
      setTaxAlertsError(true);
    } finally {
      setTaxAlertsLoading(false);
    }
  }, [token]);

  const fetchWhatsappStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/whatsapp/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.pendingMessages) setWhatsappStats(data);
    } catch {
      // silently fail
    }
  }, [token]);

  const fetchTopDebtors = useCallback(async () => {
    if (!token || isAssistant) { setDebtorsLoading(false); return; }
    setDebtorsLoading(true);
    try {
      const res = await fetch('/api/ledger/top-debtors', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.debtors) setDebtors(data.debtors);
    } catch {
      // silently fail
    } finally {
      setDebtorsLoading(false);
    }
  }, [token, isAssistant]);

  const fetchMayraAttention = useCallback(async () => {
    if (!token || isAssistant) { setAttentionLoading(false); return; }
    setAttentionLoading(true);
    try {
      const res = await fetch('/api/ledger/promises-today', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setMayraAttention(data.data);
    } catch {
      // silently fail
    } finally {
      setAttentionLoading(false);
    }
  }, [token, isAssistant]);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    setTasksLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setTasks(data.tasks || []);
    } catch {
      // silently fail
    } finally {
      setTasksLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchBankSummary();
      fetchClientsList();
      fetchTaxAlerts();
      fetchWhatsappStats();
      fetchTopDebtors();
      fetchMayraAttention();
      fetchTasks();
    }
  }, [token, isAssistant, fetchBankSummary, fetchClientsList, fetchTaxAlerts, fetchWhatsappStats, fetchTopDebtors, fetchMayraAttention, fetchTasks]);

  // Copiar Clave SRI
  const handleCopySri = async (clave: string, key: string) => {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiedSriId(key);
      setTimeout(() => setCopiedSriId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Marcar promesa
  const handleMarkPromise = async (promiseId: number, status: 'CUMPLIDA' | 'CANCELADA') => {
    if (!token) return;
    try {
      await fetch(`/api/ledger/promises/${promiseId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchMayraAttention();
    } catch {
      // silently fail
    }
  };

  // Toggle estado de tarea
  const handleToggleTask = async (taskId: number, currentStatus: string) => {
    if (!token) return;
    const nextStatus = currentStatus === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA';
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)));
      }
    } catch {
      // silently fail
    }
  };

  // Modal abono
  const handleSaveAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedClientId || !abonoMonto) return;
    setSavingAbono(true);
    setAbonoError('');
    try {
      const res = await fetch('/api/ledger/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientOwnerId: parseInt(selectedClientId, 10),
          amount: Number(abonoMonto),
          bankAccount: abonoBanco,
          concept: abonoConcepto || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al registrar abono.');
      setAbonoSuccess(true);
      setAbonoMonto('');
      setAbonoConcepto('');
      setSelectedClientId('');
      await fetchBankSummary();
      await fetchClientsList();
      await fetchTopDebtors();
      setTimeout(() => {
        setIsAbonoOpen(false);
        setAbonoSuccess(false);
      }, 1800);
    } catch (err: any) {
      setAbonoError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setSavingAbono(false);
    }
  };

  const totalWaPending =
    whatsappStats.pendingMessages.gerencial +
    whatsappStats.pendingMessages.operativa +
    whatsappStats.pendingMessages.cobranza;

  const totalDebt = debtors.reduce((acc, d) => acc + d.saldoPendiente, 0);

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return false;
    return (
      c.fullName?.toLowerCase().includes(q) ||
      c.whatsappPhone?.includes(q) ||
      c.taxpayers?.some(
        (t: any) => t.razonSocial?.toLowerCase().includes(q) || t.ruc?.toLowerCase().includes(q)
      )
    );
  });

  const todayStr = new Date().toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const semaforoItems = taxAlerts?.semaforo.items ?? [];
  const filteredSemaforo = semaforoItems.filter((i) => {
    if (semaforoTab === 'all') return i.estado === 'ROJO';
    if (semaforoTab === 'today') return i.daysUntilDue === 0;
    if (semaforoTab === 'tomorrow') return i.daysUntilDue === 1;
    return false;
  });

  const pendingTasks = tasks.filter((t) => t.status === 'PENDIENTE');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-[#166BA3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-12 md:pl-64">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-5">
        {/* HEADER */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {isAssistant ? 'Perfil Operativo' : 'Dirección General'}
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500 font-medium">Estudio Contable Mayra Castillo</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400 capitalize">{todayStr}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2A3C] mt-1 tracking-tight">
              Bienvenida, {user.fullName}
            </h1>
          </div>

          {!isAssistant && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => { setIsAbonoOpen(true); setAbonoError(''); setAbonoSuccess(false); }}
                className="inline-flex items-center gap-2 bg-[#166BA3] hover:bg-[#135887] text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm hover:shadow-md active:scale-95 transition-all"
              >
                <Plus size={15} />
                Registrar Abono
              </button>
              <Link
                href="/clientes?action=new"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-[#1E2A3C] border border-slate-300 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm hover:shadow-md active:scale-95 transition-all"
              >
                <UserPlus size={15} className="text-[#166BA3]" />
                Agregar Cliente
              </Link>
            </div>
          )}
        </div>

        {/* BANDA DE IMPACTO SUPERIOR: RECAUDACIÓN (Solo ADMIN) Y SEMÁFORO SRI */}
        <div className={`grid grid-cols-1 ${!isAssistant ? 'xl:grid-cols-12' : 'xl:grid-cols-2'} gap-5 items-stretch`}>
          {/* Tarjeta de Recaudación del Mes — total arriba, 4 cuentas abajo dentro de la card */}
          {!isAssistant && (
            <div className="xl:col-span-4 flex flex-col">

              {summaryLoading ? (
                <KpiSkeleton />
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-full gap-4">
                  {/* Cabecera con total */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Recaudado (Mes)
                      </span>
                      <TrendingUp size={16} className="text-[#166BA3]" />
                    </div>
                    <div className="text-4xl font-extrabold font-mono tracking-tight text-[#1E2A3C]">
                      +${summary?.totalRecaudadoMes.toFixed(2) ?? '0.00'}
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                      Cuentas conciliadas
                    </span>
                  </div>

                  {/* Divisor */}
                  <div className="border-t border-slate-100" />

                  {/* 4 cuentas siempre visibles, llenando la card */}
                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {[
                      { label: 'Pichincha', key: 'pichincha' as const, icon: <Landmark size={14} className="text-[#166BA3]" /> },
                      { label: 'JEP',       key: 'jep'       as const, icon: <Landmark size={14} className="text-[#166BA3]" /> },
                      { label: 'Loja',      key: 'loja'      as const, icon: <Landmark size={14} className="text-[#166BA3]" /> },
                      { label: 'Efectivo',  key: 'efectivo'  as const, icon: <Banknote  size={14} className="text-slate-500" /> },
                    ].map(({ label, key, icon }) => (
                      <div key={key} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                          {icon} {label}
                        </span>
                        <span className="text-xl font-mono font-bold text-[#1E2A3C] mt-2">
                          ${summary?.banks[key].toFixed(2) ?? '0.00'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Semáforo Tributario SRI */}
          <div className={`${!isAssistant ? 'xl:col-span-8' : ''} flex flex-col`}>
            {taxAlertsLoading ? (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6 animate-pulse h-full">
                <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-24 bg-slate-100 rounded-xl" />
                  <div className="h-24 bg-slate-100 rounded-xl" />
                  <div className="h-24 bg-slate-100 rounded-xl" />
                </div>
              </div>
            ) : taxAlertsError || !taxAlerts ? (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6 flex items-center justify-between h-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#1E2A3C]">Semáforo Tributario SRI</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      No se pudieron cargar las alertas SRI. Revisa la conexión.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => fetchTaxAlerts()}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                        <Calendar className="text-[#166BA3]" size={18} />
                        Semáforo Tributario SRI
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Estado mensual por 9no dígito del RUC
                      </p>
                    </div>
                    <Link
                      href="/clientes"
                      className="text-xs font-semibold text-[#166BA3] hover:underline flex items-center gap-1 shrink-0"
                    >
                      Directorio <ChevronRight size={12} />
                    </Link>
                  </div>

                  {/* 3 Contadores del semáforo */}
                  <div className="grid grid-cols-3 gap-2.5 mb-4">
                    {[
                      { label: 'Al día', count: taxAlerts.semaforo.verde, numColor: 'text-emerald-600', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
                      { label: 'Próx. semana', count: taxAlerts.semaforo.amarillo, numColor: 'text-amber-600', dot: 'bg-amber-400', bar: 'bg-amber-400' },
                      { label: 'Urgente', count: taxAlerts.semaforo.rojo, numColor: 'text-rose-600', dot: 'bg-rose-500', bar: 'bg-rose-500' },
                    ].map((s) => {
                      const total = taxAlerts.semaforo.verde + taxAlerts.semaforo.amarillo + taxAlerts.semaforo.rojo || 1;
                      const pct = Math.round((s.count / total) * 100);
                      return (
                        <div key={s.label} className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</span>
                          </div>
                          <div className={`text-2xl font-extrabold font-mono ${s.numColor}`}>{s.count}</div>
                          <div className="w-full bg-slate-100 rounded-full h-1 mt-auto">
                            <div className={`h-1 rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[9px] text-slate-400">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pestañas de filtrado */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {([
                      { key: 'all', label: `Todos críticos (${taxAlerts.semaforo.rojo})` },
                      { key: 'today', label: `Vencen hoy (${semaforoItems.filter(i => i.daysUntilDue === 0).length})` },
                      { key: 'tomorrow', label: `Vencen mañana (${semaforoItems.filter(i => i.daysUntilDue === 1).length})` },
                    ] as { key: 'all' | 'today' | 'tomorrow'; label: string }[]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSemaforoTab(tab.key)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                          semaforoTab === tab.key
                            ? 'bg-[#1E2A3C] text-white border-[#1E2A3C]'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista o Mensaje de éxito */}
                <div>
                  {filteredSemaforo.length > 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 max-h-36 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredSemaforo.slice(0, 6).map((item, idx) => {
                          const copyKey = `${item.clientId}-${idx}`;
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 text-[11px] gap-2 border border-slate-200/80"
                            >
                              <div className="min-w-0">
                                <span className="text-slate-800 font-medium truncate block">• {item.razonSocial}</span>
                                <span className="font-mono font-bold text-slate-500 text-[10px]">Día {item.dueDay}</span>
                              </div>
                              {item.claveSri && (
                                <button
                                  onClick={() => handleCopySri(item.claveSri!, copyKey)}
                                  title="Copiar Clave SRI"
                                  className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-all ${
                                    copiedSriId === copyKey
                                      ? 'bg-slate-100 border-slate-300 text-slate-700'
                                      : 'bg-white border-slate-200 text-[#166BA3] hover:border-[#166BA3]'
                                  }`}
                                >
                                  {copiedSriId === copyKey ? <CheckCheck size={9} /> : <Copy size={9} />}
                                  {copiedSriId === copyKey ? 'Copiada' : 'Clave'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs text-slate-600 font-medium">
                      <CheckCheck size={15} className="text-[#166BA3]" />
                      {semaforoTab === 'today' ? 'Ninguna declaración vence hoy. ¡Todo al día!' :
                       semaforoTab === 'tomorrow' ? 'Ninguna declaración vence mañana.' :
                       'Todas las declaraciones están al día. Sin urgencias tributarias.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tareas Pendientes — para ASISTENTE van aquí dentro del mismo grid xl:grid-cols-2 */}
          {isAssistant && (
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col">
              <div className="mb-4">
                <h2 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                  <CheckSquare className="text-[#166BA3]" size={18} />
                  Tareas Pendientes
                </h2>
                <p className="text-xs text-gray-400">Tus tareas asignadas</p>
              </div>
              {tasksLoading ? (
                <div className="text-xs text-gray-400 py-4 text-center">Cargando tareas...</div>
              ) : pendingTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-2">
                    <CheckCheck size={15} className="text-[#166BA3]" /> Sin tareas pendientes por el momento.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 flex-1">
                  {pendingTasks.slice(0, 4).map((t) => (
                    <div
                      key={t.id}
                      className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3.5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            t.priority === 'URGENTE' ? 'bg-rose-100 text-rose-700' :
                            t.priority === 'ALTA' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-200/70 text-slate-700'
                          }`}>
                            {t.priority}
                          </span>
                          {t.dueDate && (
                            <span className="text-[10px] text-gray-400">
                              {new Date(t.dueDate).toLocaleDateString('es-EC')}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xs font-bold text-[#1E2A3C] block truncate">{t.title}</h3>
                        {t.description && (
                          <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{t.description}</p>
                        )}
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">
                          Asignado: <strong className="text-slate-600">{t.assignedTo?.fullName || 'Mayra'}</strong>
                        </span>
                        <button
                          onClick={() => handleToggleTask(t.id, t.status)}
                          className="text-[10px] font-semibold text-[#166BA3] hover:text-emerald-700 flex items-center gap-1"
                        >
                          <CheckCheck size={11} /> Listo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BLOQUE: TAREAS + ATENCIÓN DE MAYRA — solo para ADMIN (lado a lado) */}
        {!isAssistant && (
        <div className={`grid grid-cols-1 xl:grid-cols-2 gap-5 items-start`}>
          {/* Tareas Pendientes */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                  <CheckSquare className="text-[#166BA3]" size={18} />
                  Tareas Pendientes
                </h2>
                <p className="text-xs text-gray-400">
                  {isAdmin ? 'Tus tareas personales pendientes' : 'Tus tareas asignadas'}
                </p>
              </div>

            </div>

            {tasksLoading ? (
              <div className="text-xs text-gray-400 py-4 text-center">Cargando tareas...</div>
            ) : pendingTasks.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-medium">
                <span className="flex items-center gap-2">
                  <CheckCheck size={15} className="text-[#166BA3]" /> Sin tareas pendientes por el momento.
                </span>
                <Link href="/configuracion?tab=TAREAS&action=new-task" className="underline font-semibold text-[#166BA3]">
                  + Crear Tarea
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingTasks.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          t.priority === 'URGENTE' ? 'bg-rose-100 text-rose-700' :
                          t.priority === 'ALTA' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-200/70 text-slate-700'
                        }`}>
                          {t.priority}
                        </span>
                        {t.dueDate && (
                          <span className="text-[10px] text-gray-400">
                            {new Date(t.dueDate).toLocaleDateString('es-EC')}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-[#1E2A3C] block truncate">{t.title}</h3>
                      {t.description && (
                        <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{t.description}</p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        Asignado: <strong className="text-slate-600">{t.assignedTo?.fullName || 'Mayra'}</strong>
                      </span>
                      <button
                        onClick={() => handleToggleTask(t.id, t.status)}
                        className="text-[10px] font-semibold text-[#166BA3] hover:text-emerald-700 flex items-center gap-1"
                      >
                        <CheckCheck size={11} /> Listo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Atención de Mayra Hoy (solo ADMIN, inline con Tareas) */}
          {isAdmin && (
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                  <ShieldAlert className="text-[#166BA3]" size={18} />
                  Atención de Mayra Hoy
                </h2>
              </div>

              {attentionLoading ? (
                <div className="animate-pulse h-16 bg-slate-100 rounded-xl" />
              ) : !mayraAttention ? (
                <p className="text-xs text-gray-400">Sin alertas para hoy.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    {mayraAttention.promises.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <CheckCheck size={15} className="text-[#166BA3]" /> Sin promesas de pago pendientes.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-rose-700 flex items-center gap-1 mb-2">
                          <Bell size={12} /> Prometieron pagar hoy:
                        </p>
                        {mayraAttention.promises.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 gap-3">
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-[#1E2A3C] block truncate">{p.clientName}</span>
                              <span className="text-[10px] text-slate-500">
                                ${p.amount.toFixed(2)} · {new Date(p.promisedDate).toLocaleDateString('es-EC')}
                                {p.isToday && <strong className="ml-1 text-rose-600">— HOY</strong>}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleMarkPromise(p.id, 'CUMPLIDA')}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                              >
                                Pagó
                              </button>
                              <button
                                onClick={() => handleMarkPromise(p.id, 'CANCELADA')}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                              >
                                No pagó
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Link href="/whatsapp" className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-[#166BA3]/40 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-[#166BA3]/10 text-[#166BA3] flex items-center justify-center shrink-0">
                        <MessageSquare size={16} />
                      </div>
                      <div>
                        <span className="text-xl font-extrabold font-mono text-[#1E2A3C]">
                          {mayraAttention.gerencialTicketsCount}
                        </span>
                        <span className="text-[11px] text-gray-500 block">asesorías en espera</span>
                      </div>
                    </Link>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div>
                        <span className="text-xl font-extrabold font-mono text-[#1E2A3C]">
                          {mayraAttention.docsTodayCount}
                        </span>
                        <span className="text-[11px] text-gray-500 block">docs subidos hoy</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* GRID INFERIOR (DIRECTORIO, FIRMAS Y ACCESOS):
            - Para ADMIN: 3 Columnas (Deudores + Directorio + Firmas)
            - Para ASISTENTE: 2 Columnas (Directorio + Firmas y Accesos) sin datos financieros */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Top Deudores (SOLO ADMIN / COBRADOR) */}
          {!isAssistant && (
            <div className="lg:col-span-4 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#1E2A3C] flex items-center gap-2">
                    <DollarSign className="text-rose-500" size={16} />
                    Top Deudores
                  </h2>
                  <p className="text-[11px] text-gray-500">Mayores saldos pendientes</p>
                </div>
                <Link href="/clientes" className="text-xs text-[#166BA3] hover:underline font-semibold flex items-center gap-1">
                  Ver cartera <ChevronRight size={12} />
                </Link>
              </div>

              {debtorsLoading ? (
                <div className="space-y-2 flex-1 animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-14 bg-slate-100 rounded-xl" />
                  ))}
                </div>
              ) : debtors.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-6 text-xs text-gray-400">
                  <CheckCircle size={24} className="mr-2 text-[#166BA3]" /> Todos los saldos al día
                </div>
              ) : (
                <div className="space-y-2 flex-1">
                  {debtors.slice(0, 5).map((d, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-[#1E2A3C] block truncate">{d.clientName}</span>
                        <span className="text-[10px] text-gray-400">
                          {d.daysOverdue > 0 ? `${d.daysOverdue}d vencido` : 'Al día'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-rose-600">
                          ${d.saldoPendiente.toFixed(2)}
                        </span>
                        <button
                          onClick={() => setReminderDebtor(d)}
                          className="p-1 rounded-lg text-[#166BA3] hover:bg-blue-50"
                          title="Recordatorio"
                        >
                          <Send size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Directorio Rápido (7 cols para asistente, 5 cols para admin) */}
          <div className={`${isAssistant ? 'lg:col-span-8' : 'lg:col-span-5'} bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#166BA3]/10 text-[#166BA3] flex items-center justify-center font-bold">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1E2A3C]">Directorio Rápido</h2>
                    <p className="text-xs text-gray-400">Búsqueda directa de contribuyentes</p>
                  </div>
                </div>
                <Link href="/clientes" className="text-xs font-semibold text-[#166BA3] hover:underline flex items-center gap-1">
                  Directorio ({clients.length}) <ChevronRight size={14} />
                </Link>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre, RUC o razón social..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-[#1E2A3C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166BA3]/40 transition-all"
                />
                {clientSearch && (
                  <button onClick={() => setClientSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <X size={14} />
                  </button>
                )}

                {clientSearch.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {filteredClients.slice(0, 8).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => router.push(`/clientes/${c.id}`)}
                        className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-xs font-bold text-[#1E2A3C] truncate">{c.fullName}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {c.taxpayers && c.taxpayers.length > 0
                              ? c.taxpayers.map((t) => t.razonSocial).join(', ')
                              : 'Sin empresas registradas'}
                          </p>
                        </div>
                        <span className="text-xs text-[#166BA3] font-semibold flex items-center gap-1 shrink-0">
                          Abrir <ArrowRight size={12} />
                        </span>
                      </div>
                    ))}
                    {filteredClients.length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-400">
                        Sin coincidencias para &quot;{clientSearch}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-gray-400">
              <span>Total contribuyentes: <strong className="text-slate-700">{clients.length}</strong></span>
              <span className="font-mono text-slate-400">CRM Mayra</span>
            </div>
          </div>

          {/* Firmas y Accesos (4 cols para asistente, 3 cols para admin) */}
          <div className={`${isAssistant ? 'lg:col-span-4' : 'lg:col-span-3'} flex flex-col gap-4`}>
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-[#1E2A3C] flex items-center gap-2">
                  <Key className="text-slate-500" size={15} />
                  Firmas p12
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-[#1E2A3C]">
                  {taxAlerts?.firmaAlerts.count ?? 0} activas
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mb-3">Vence ≤ 5 días</p>

              {!taxAlerts || taxAlerts.firmaAlerts.count === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                  <CheckCircle size={13} className="text-[#166BA3]" /> Todas vigentes
                </div>
              ) : (
                <div className="space-y-2">
                  {taxAlerts.firmaAlerts.items.map((f, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#1E2A3C] truncate">{f.razonSocial}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 ml-2">
                        {f.daysLeft <= 0 ? '¡Hoy!' : `${f.daysLeft}d`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
              <h2 className="text-sm font-bold text-[#1E2A3C] mb-3 flex items-center gap-2">
                <Zap className="text-[#166BA3]" size={15} />
                Accesos
              </h2>
              <div className="space-y-2">
                <Link
                  href="/clientes"
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1E2A3C] text-xs font-semibold transition-all"
                >
                  <Building2 size={14} /> Directorio
                </Link>
                <Link
                  href="/whatsapp"
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1E2A3C] text-xs font-semibold transition-all"
                >
                  <MessageSquare size={14} /> WhatsApp
                  {totalWaPending > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-bold">
                      {totalWaPending}
                    </span>
                  )}
                </Link>
                <Link
                  href="/supercias"
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1E2A3C] text-xs font-semibold transition-all"
                >
                  <ExternalLink size={14} /> Informes Supercias
                </Link>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* MODAL REGISTRAR ABONO */}
      {isAbonoOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative border border-gray-100">
            <button
              onClick={() => { setIsAbonoOpen(false); setAbonoError(''); setAbonoSuccess(false); }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <form onSubmit={handleSaveAbono} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                  <Wallet className="text-[#166BA3]" size={18} />
                  Registrar Abono / Pago
                </h3>
                <p className="text-xs text-gray-400">Ingreso directo a la cartera</p>
              </div>

              {abonoError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  <AlertCircle size={14} className="inline mr-1" /> {abonoError}
                </div>
              )}

              {abonoSuccess && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <CheckCheck size={14} className="text-[#166BA3]" /> ¡Abono registrado con éxito!
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contribuyente *</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                >
                  <option value="">Seleccione contribuyente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={abonoMonto}
                    onChange={(e) => setAbonoMonto(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono text-[#1E2A3C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cuenta Receptora *</label>
                  <select
                    value={abonoBanco}
                    onChange={(e) => setAbonoBanco(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white text-[#1E2A3C]"
                  >
                    <option value="BANCO_PICHINCHA">Banco Pichincha</option>
                    <option value="BANCO_DE_LOJA">Banco de Loja</option>
                    <option value="COOPERATIVA_JEP">Cooperativa JEP</option>
                    <option value="EFECTIVO">Efectivo / Caja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Referencia</label>
                <input
                  type="text"
                  value={abonoConcepto}
                  onChange={(e) => setAbonoConcepto(e.target.value)}
                  placeholder="Ej. Transferencia #98234"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAbonoOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAbono || abonoSuccess}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#166BA3] text-white"
                >
                  {savingAbono ? 'Registrando...' : 'Registrar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECORDATORIO WHATSAPP */}
      {reminderDebtor && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-sm font-bold text-[#1E2A3C] flex items-center gap-2 mb-2">
              <Send className="text-[#166BA3]" size={16} />
              Enviar recordatorio de cobro
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Se redirigirá a WhatsApp para contactar a{' '}
              <strong className="text-[#1E2A3C]">{reminderDebtor.clientName}</strong> con saldo pendiente de{' '}
              <strong className="text-rose-600">${reminderDebtor.saldoPendiente.toFixed(2)}</strong>.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setReminderDebtor(null)}
                className="px-3.5 py-2 rounded-xl text-xs text-gray-600"
              >
                Cancelar
              </button>
              <Link
                href="/whatsapp"
                onClick={() => setReminderDebtor(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#166BA3] text-white flex items-center gap-1.5"
              >
                <MessageSquare size={13} /> Ir a WhatsApp
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <DashboardView />
    </AuthProvider>
  );
}
