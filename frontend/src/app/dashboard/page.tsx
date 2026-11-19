// frontend/src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  cancelNote?: string | null;
  createdAt?: string;
  assignedTo: { id: number; fullName: string };
  createdBy?: { id: number; fullName: string };
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
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [modalTaskTab, setModalTaskTab] = useState<'HOY' | 'AYER' | 'PENDIENTES'>('HOY');
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TaskItem | null>(null);
  const [dashCancelNote, setDashCancelNote] = useState('');
  const [dashShowCancelForm, setDashShowCancelForm] = useState(false);
  const [taskFilterTab, setTaskFilterTab] = useState<'HOY' | 'PASADAS' | 'TODAS'>('HOY');

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

  // Modal Tarifario Oficial de Firmas Electrónicas (Flyer Oficial de Mayra)
  const [isFirmaPricesOpen, setIsFirmaPricesOpen] = useState(false);
  const [copiedFirmaPrices, setCopiedFirmaPrices] = useState(false);

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

  // Separación temporal estricta de tareas
  const isDateToday = (dStr?: string | null) => {
    if (!dStr) return false;
    const d = new Date(dStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isDateYesterday = (dStr?: string | null) => {
    if (!dStr) return false;
    const d = new Date(dStr);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    );
  };

  const isDatePastOrYesterday = (dStr?: string | null) => {
    if (!dStr) return false;
    const d = new Date(dStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return target < today;
  };

  // Tareas de Hoy: Únicamente las que tienen dueDate de hoy (o creadas hoy si no tienen dueDate)
  const tasksToday = pendingTasks.filter((t) => (t.dueDate ? isDateToday(t.dueDate) : isDateToday(t.createdAt)));
  // Tareas de Ayer: Específicamente las del día de ayer
  const tasksYesterday = pendingTasks.filter((t) => (t.dueDate ? isDateYesterday(t.dueDate) : isDateYesterday(t.createdAt)));
  // Tareas Pasadas / Atrasadas: Las que tienen dueDate anterior a hoy (o creadas antes de hoy)
  const tasksPast = pendingTasks.filter((t) => (t.dueDate ? isDatePastOrYesterday(t.dueDate) : isDatePastOrYesterday(t.createdAt)));

  // Tareas filtradas para el modal "Ver todas" (excluye las completadas por requerimiento explícito)
  const modalFilteredTasks = modalTaskTab === 'HOY'
    ? tasksToday
    : modalTaskTab === 'AYER'
    ? tasksYesterday
    : pendingTasks; // Todas las pendientes acumuladas que quedaron sin hacer

  // Filtro estricto y exacto según la pestaña activa
  const displayedCardTasks = taskFilterTab === 'HOY'
    ? tasksToday
    : tasksPast;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-[#166BA3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-12 md:pl-64 overflow-x-hidden max-w-full">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 pt-5 space-y-5 overflow-x-hidden">
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
          {/* Tarjeta de Recaudación del Mes — Clickeable para abrir desglose de cuentas en popup */}
          {!isAssistant && (
            <div className="xl:col-span-4 flex flex-col">
              {summaryLoading ? (
                <KpiSkeleton />
              ) : (
                <div
                  onClick={() => setIsBankBreakdownOpen(true)}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full cursor-pointer hover:border-[#166BA3]/50 hover:shadow-md transition-all group relative overflow-hidden"
                  title="Haz clic para ver el desglose por banco"
                >
                  {/* Cabecera */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                        Recaudado (Mes)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Cuentas conciliadas
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#166BA3]/10 text-[#166BA3] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <TrendingUp size={20} />
                    </div>
                  </div>

                  {/* Métricas: Recaudado vs Saldo a Cobrar */}
                  <div className="flex-1 flex flex-col justify-center py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Total Ganado / Cobrado */}
                      <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                          Total Ganado / Cobrado
                        </span>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700 leading-tight mt-1">
                          +${summary?.totalRecaudadoMes.toFixed(2) ?? '0.00'}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                          Ingresos recaudados
                        </span>
                      </div>

                      {/* Saldo a Cobrar (Deuda) */}
                      <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
                          Saldo a Cobrar (Deuda)
                        </span>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono text-rose-700 leading-tight mt-1">
                          ${(summary?.totalCarteraPendiente ?? totalDebt).toFixed(2)}
                        </div>
                        <span className="text-[10px] text-rose-600 font-medium block mt-0.5">
                          Saldo pendiente a cobrar
                        </span>
                      </div>
                    </div>

                    <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-semibold border border-slate-200 self-center">
                      <CheckCircle size={13} className="text-emerald-600" /> Conciliación contable activa
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#166BA3] font-semibold">
                    <span className="flex items-center gap-1 group-hover:underline">
                      Ver desglose por banco (4 cuentas)
                    </span>
                    <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
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
        </div>

        {/* 4 CARDS ALINEADAS EN UNA SOLA FILA */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isAssistant ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-5 items-stretch`}>
          {/* CARD 1: TAREAS PENDIENTES */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-[390px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#166BA3]/10 text-[#166BA3] flex items-center justify-center">
                    <CheckSquare size={17} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#1E2A3C] leading-none">Tareas Pendientes</h2>
                    <span className="text-[10px] text-gray-400">
                      {isAdmin ? 'Tus pendientes' : 'Asignadas a ti'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTasksModalOpen(true)}
                  className="text-[11px] font-bold text-[#166BA3] hover:underline flex items-center gap-0.5 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100"
                >
                  Ver todas <ChevronRight size={12} />
                </button>
              </div>

              {/* Botoncitos para filtrar: Hoy vs Ayer / Pasadas */}
              <div className="flex items-center gap-1.5 mb-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setTaskFilterTab('HOY')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    taskFilterTab === 'HOY'
                      ? 'bg-[#166BA3] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Hoy ({tasksToday.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilterTab('PASADAS')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    taskFilterTab === 'PASADAS'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Ayer / Pasadas ({tasksPast.length})
                </button>
              </div>

              {tasksLoading ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-10 bg-slate-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : displayedCardTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-1.5">
                  <CheckCheck size={24} className="text-[#166BA3]" />
                  <span>
                    {taskFilterTab === 'HOY'
                      ? 'No hay tareas asignadas para hoy.'
                      : 'No hay tareas atrasadas de días anteriores.'}
                  </span>
                  <Link href="/configuracion?tab=TAREAS&action=new-task" className="text-[11px] text-[#166BA3] underline font-semibold mt-1">
                    + Crear tarea
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5 overflow-hidden">
                  {displayedCardTasks.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskDetail(t)}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2 text-xs hover:bg-blue-50/50 hover:border-[#166BA3]/40 cursor-pointer transition-all group"
                      title="Haz clic para ver la tarea completa con adjuntos"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded ${
                            t.priority === 'URGENTE' ? 'bg-rose-100 text-rose-700' :
                            t.priority === 'ALTA' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {t.priority}
                          </span>
                          <span className="text-[10px] text-gray-400 truncate">
                            {t.assignedTo?.fullName?.split(' ')[0] || 'Mayra'}
                          </span>
                          {t.fileUrl && (
                            <span className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1 rounded flex items-center gap-0.5">
                              📎 Adjunto
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-[#1E2A3C] truncate leading-tight group-hover:text-[#166BA3]">
                          {t.title}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTask(t.id, t.status);
                        }}
                        className="text-[10px] shrink-0 font-semibold text-slate-500 hover:text-emerald-700 p-1 rounded-lg hover:bg-emerald-50"
                        title="Marcar completada"
                      >
                        <CheckCheck size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-gray-400">
                Total: <strong className="text-slate-700">{pendingTasks.length} pendientes</strong>
              </span>
              {displayedCardTasks.length > 5 && (
                <button
                  type="button"
                  onClick={() => setIsTasksModalOpen(true)}
                  className="text-[11px] font-bold text-[#166BA3] hover:underline"
                >
                  +{displayedCardTasks.length - 5} más...
                </button>
              )}
            </div>
          </div>

          {/* CARD 2: TOP DEUDORES (SOLO ADMIN / COBRADOR) */}
          {!isAssistant && (
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-[390px]">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <DollarSign size={17} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#1E2A3C] leading-none">Top Deudores</h2>
                      <span className="text-[10px] text-gray-400">Saldos pendientes</span>
                    </div>
                  </div>
                  <Link href="/clientes" className="text-[11px] font-bold text-[#166BA3] hover:underline flex items-center gap-0.5">
                    Cartera <ChevronRight size={12} />
                  </Link>
                </div>

                {debtorsLoading ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-10 bg-slate-100 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : debtors.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-1">
                    <CheckCircle size={24} className="text-[#166BA3]" />
                    <span>Todos los saldos al día.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 overflow-hidden">
                    {debtors.slice(0, 5).map((d, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 pr-1">
                          <span className="text-xs font-bold text-[#1E2A3C] block truncate">{d.clientName}</span>
                          <span className="text-[10px] text-gray-400">
                            {d.daysOverdue > 0 ? `${d.daysOverdue}d vencido` : 'Al día'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-mono font-extrabold text-rose-600">
                            ${d.saldoPendiente.toFixed(2)}
                          </span>
                          <button
                            onClick={() => setReminderDebtor(d)}
                            className="p-1 rounded-lg text-[#166BA3] hover:bg-sky-50"
                            title="Recordatorio WhatsApp"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-gray-400">
                <span>Top 5 deudores</span>
                <span className="font-mono text-slate-500">Cobranza</span>
              </div>
            </div>
          )}

          {/* CARD 3: DIRECTORIO RÁPIDO */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-[390px]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#166BA3]/10 text-[#166BA3] flex items-center justify-center font-bold">
                    <Building2 size={17} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#1E2A3C] leading-none">Directorio Rápido</h2>
                    <span className="text-[10px] text-gray-400">Búsqueda directa</span>
                  </div>
                </div>
                <Link href="/clientes" className="text-[11px] font-bold text-[#166BA3] hover:underline flex items-center gap-0.5">
                  Ver ({clients.length}) <ChevronRight size={12} />
                </Link>
              </div>

              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre o RUC..."
                  className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#1E2A3C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166BA3]/30"
                />
                {clientSearch && (
                  <button onClick={() => setClientSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <X size={13} />
                  </button>
                )}

                {clientSearch.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredClients.slice(0, 6).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => router.push(`/clientes/${c.id}`)}
                        className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-[#1E2A3C] truncate">{c.fullName}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {c.taxpayers && c.taxpayers.length > 0
                              ? c.taxpayers.map((t) => t.razonSocial).join(', ')
                              : 'Sin empresas'}
                          </p>
                        </div>
                        <span className="text-[11px] text-[#166BA3] font-semibold flex items-center gap-0.5 shrink-0">
                          Abrir <ArrowRight size={11} />
                        </span>
                      </div>
                    ))}
                    {filteredClients.length === 0 && (
                      <div className="p-3 text-center text-xs text-gray-400">
                        Sin coincidencias
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Muestra rápida de clientes */}
              <div className="space-y-1.5 overflow-hidden">
                {clients.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/clientes/${c.id}`)}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-[#1E2A3C] truncate">{c.fullName}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {c.taxpayers?.[0]?.ruc || c.taxpayers?.[0]?.razonSocial || 'Cliente regular'}
                      </p>
                    </div>
                    <ArrowRight size={12} className="text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-gray-400">
              <span>Total contribuyentes: <strong className="text-slate-700">{clients.length}</strong></span>
              <span className="font-mono text-slate-400">CRM</span>
            </div>
          </div>

          {/* CARD 4: FIRMAS P12 */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-[390px]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <Key size={17} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#1E2A3C] leading-none">Firmas p12</h2>
                    <span className="text-[10px] text-gray-400">Vencimiento ≤ 30 días</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-[#1E2A3C]">
                  {taxAlerts?.firmaAlerts.count ?? 0} alertas
                </span>
              </div>

              {!taxAlerts || taxAlerts.firmaAlerts.count === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2 mb-3">
                  <CheckCircle size={15} className="text-[#166BA3]" /> Todas las firmas p12 vigentes
                </div>
              ) : (
                <div className="space-y-1.5 mb-3 overflow-hidden">
                  {taxAlerts.firmaAlerts.items.slice(0, 3).map((f, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1E2A3C] truncate">{f.razonSocial}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 ml-2 shrink-0">
                        {f.daysLeft <= 0 ? '¡Hoy!' : `${f.daysLeft}d`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Accesos rápidos */}
              <div className="space-y-1.5 pt-1">
                <Link
                  href="/whatsapp"
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-[#1E2A3C] text-xs font-semibold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare size={13} className="text-[#166BA3]" /> WhatsApp Chat
                  </span>
                  {totalWaPending > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-bold">
                      {totalWaPending}
                    </span>
                  )}
                </Link>
                <Link
                  href="/supercias"
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-[#1E2A3C] text-xs font-semibold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink size={13} className="text-[#166BA3]" /> Informes Supercias
                  </span>
                  <ChevronRight size={12} className="text-gray-400" />
                </Link>

                <button
                  type="button"
                  onClick={() => setIsFirmaPricesOpen(true)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-sky-50/70 hover:bg-sky-100/80 border border-sky-200/60 text-[#166BA3] text-xs font-bold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <DollarSign size={13} className="text-[#166BA3]" /> Tarifario Oficial de Firmas
                  </span>
                  <ChevronRight size={12} className="text-[#166BA3]" />
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-gray-400">
              <span>Certificados digitales</span>
              <span className="font-mono text-slate-400">Seguridad</span>
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

      {/* MODAL POPUP: TODAS LAS TAREAS */}
      {isTasksModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#166BA3]/10 text-[#166BA3] flex items-center justify-center">
                  <CheckSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E2A3C]">
                    Todas las Tareas
                  </h3>
                  <p className="text-xs text-gray-400">
                    {pendingTasks.length} pendientes · {tasks.filter(t => t.status === 'COMPLETADA').length} completadas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/configuracion?tab=TAREAS&action=new-task"
                  className="text-xs font-semibold text-[#166BA3] hover:underline px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-100"
                >
                  + Nueva Tarea
                </Link>
                <button
                  onClick={() => setIsTasksModalOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Pestañas de filtrado de tareas pendientes (Excluye las completadas) */}
            <div className="flex items-center gap-2 pt-3 pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setModalTaskTab('HOY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modalTaskTab === 'HOY'
                    ? 'bg-[#166BA3] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hoy ({tasksToday.length})
              </button>
              <button
                type="button"
                onClick={() => setModalTaskTab('AYER')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modalTaskTab === 'AYER'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ayer ({tasksYesterday.length})
              </button>
              <button
                type="button"
                onClick={() => setModalTaskTab('PENDIENTES')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modalTaskTab === 'PENDIENTES'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas Pendientes que Quedaron ({pendingTasks.length})
              </button>
            </div>

            {/* Lista de Tareas en el modal con scroll independiente */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1">
              {modalFilteredTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  <CheckCheck size={28} className="mx-auto text-emerald-600 mb-2" />
                  {modalTaskTab === 'HOY' ? 'No hay tareas asignadas para hoy.' :
                   modalTaskTab === 'AYER' ? 'No quedaron tareas pendientes de ayer.' :
                   '¡Excelente! No hay ninguna tarea pendiente acumulada.'}
                </div>
              ) : (
                modalFilteredTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskDetail(t)}
                    className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors cursor-pointer hover:border-[#166BA3]/50 bg-white border-slate-200 shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded ${
                          t.priority === 'URGENTE' ? 'bg-rose-100 text-rose-700' :
                          t.priority === 'ALTA' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {t.priority}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {t.status}
                        </span>
                        {t.dueDate && (
                          <span className="text-[10px] text-gray-500 font-semibold">
                            Límite: {new Date(t.dueDate).toLocaleDateString('es-EC')}
                          </span>
                        )}
                        {t.fileUrl && (
                          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                            📎 {t.fileName || 'Archivo adjunto'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-[#1E2A3C]">
                        {t.title}
                      </h4>
                      {t.description && (
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                      <div className="mt-1.5 text-[10px] text-gray-400 flex items-center gap-2">
                        <span>Asignado a: <strong className="text-slate-600">{t.assignedTo?.fullName || 'Mayra Castillo'}</strong></span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTask(t.id, t.status);
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        title="Marcar como realizada"
                      >
                        <CheckCheck size={14} />
                        Marcar lista
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-gray-400">
              <span>Haga clic en una tarea para cambiar su estado</span>
              <button
                onClick={() => setIsTasksModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP: DETALLE COMPLETO DE TAREA Y DESCARGA DE ARCHIVOS */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md ${
                  selectedTaskDetail.priority === 'URGENTE' ? 'bg-rose-100 text-rose-700' :
                  selectedTaskDetail.priority === 'ALTA' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {selectedTaskDetail.priority}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                  selectedTaskDetail.status === 'COMPLETADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-50 text-[#166BA3]'
                }`}>
                  {selectedTaskDetail.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedTaskDetail(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#1E2A3C] leading-snug">
                  {selectedTaskDetail.title}
                </h3>
                {selectedTaskDetail.dueDate && (
                  <p className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
                    <Calendar size={13} />
                    Fecha límite: {new Date(selectedTaskDetail.dueDate).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>

              {selectedTaskDetail.description && (
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedTaskDetail.description}
                </div>
              )}

              {/* Motivo de no realización */}
              {selectedTaskDetail.cancelNote && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 leading-relaxed">
                  <p className="font-bold mb-1">⚠ No se pudo realizar:</p>
                  <p className="whitespace-pre-wrap">{selectedTaskDetail.cancelNote}</p>
                </div>
              )}

              {/* Archivo adjunto descargable */}
              {selectedTaskDetail.fileUrl ? (
                <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-sky-100 text-[#166BA3] flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1E2A3C] truncate">{selectedTaskDetail.fileName || 'Documento adjunto'}</p>
                      <p className="text-[10px] text-gray-400">Archivo adjunto a esta tarea</p>
                    </div>
                  </div>
                  <a
                    href={selectedTaskDetail.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#166BA3] hover:bg-[#135887] text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                  >
                    Descargar <ExternalLink size={12} />
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 italic text-center">
                  Esta tarea no incluye archivos adjuntos.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Asignado a</span>
                  <span className="font-bold text-slate-700">{selectedTaskDetail.assignedTo?.fullName || 'Mayra Castillo'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Creado por</span>
                  <span className="font-bold text-slate-700">{selectedTaskDetail.createdBy?.fullName || 'Mayra Castillo'}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              {/* Formulario motivo */}
              {dashShowCancelForm && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-red-800">¿Por qué no se pudo realizar?</p>
                  <textarea
                    rows={2}
                    value={dashCancelNote}
                    onChange={(e) => setDashCancelNote(e.target.value)}
                    placeholder="Describe el inconveniente..."
                    className="w-full px-3 py-2 rounded-lg border border-red-200 text-xs text-slate-700 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setDashShowCancelForm(false); setDashCancelNote(''); }} className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button
                      onClick={async () => {
                        if (!token || !selectedTaskDetail) return;
                        const res = await fetch(`/api/tasks/${selectedTaskDetail.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ status: 'CANCELADA', cancelNote: dashCancelNote }),
                        });
                        if (res.ok) {
                          setTasks((prev) =>
                            prev.map((t) =>
                              t.id === selectedTaskDetail.id
                                ? { ...t, status: 'CANCELADA', cancelNote: dashCancelNote }
                                : t
                            )
                          );
                          setSelectedTaskDetail(null);
                          setDashShowCancelForm(false);
                          setDashCancelNote('');
                        }
                      }}
                      className="px-4 py-1 text-xs font-bold bg-red-600 text-white hover:bg-red-700 rounded-lg"
                    >Guardar</button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedTaskDetail.status !== 'COMPLETADA' && selectedTaskDetail.status !== 'CANCELADA' && (
                  <button
                    onClick={() => { handleToggleTask(selectedTaskDetail.id, selectedTaskDetail.status); setSelectedTaskDetail(null); }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                  >
                    ✓ Marcar como Completada
                  </button>
                )}
                {(selectedTaskDetail.status === 'COMPLETADA' || selectedTaskDetail.status === 'CANCELADA') && (
                  <button
                    onClick={() => { handleToggleTask(selectedTaskDetail.id, selectedTaskDetail.status); setSelectedTaskDetail(null); }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                  >
                    Reabrir Tarea
                  </button>
                )}
                {selectedTaskDetail.status !== 'COMPLETADA' && !dashShowCancelForm && (
                  <button
                    onClick={() => setDashShowCancelForm(true)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all"
                  >
                    ✗ No se pudo realizar
                  </button>
                )}
                <button
                  onClick={() => { setSelectedTaskDetail(null); setDashShowCancelForm(false); setDashCancelNote(''); }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-medium ml-auto"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP: DESGLOSE DE CUENTAS BANCARIAS Y EFECTIVO */}
      {isBankBreakdownOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#166BA3]/10 text-[#166BA3] flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E2A3C]">
                    Desglose de Recaudación (Mes)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Total conciliado: <strong className="text-emerald-700 font-mono font-bold">+${summary?.totalRecaudadoMes.toFixed(2) ?? '0.00'}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBankBreakdownOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-5 grid grid-cols-2 gap-3.5">
              {[
                { label: 'Pichincha', key: 'pichincha' as const, icon: <Landmark size={18} className="text-[#166BA3]" />, desc: 'Banco Pichincha' },
                { label: 'JEP',       key: 'jep'       as const, icon: <Landmark size={18} className="text-[#166BA3]" />, desc: 'Coop. JEP' },
                { label: 'Loja',      key: 'loja'      as const, icon: <Landmark size={18} className="text-[#166BA3]" />, desc: 'Banco de Loja' },
                { label: 'Efectivo',  key: 'efectivo'  as const, icon: <Banknote  size={18} className="text-slate-500" />, desc: 'Caja física' },
              ].map(({ label, key, icon, desc }) => (
                <div
                  key={key}
                  className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-xs text-gray-700 font-bold">
                      {icon} {label}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">{desc}</span>
                  </div>
                  <div>
                    <span className="text-2xl font-mono font-extrabold text-[#1E2A3C]">
                      ${summary?.banks[key].toFixed(2) ?? '0.00'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Saldo recaudado</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-gray-400">
              <span>Actualizado en tiempo real con cada abono</span>
              <button
                onClick={() => setIsBankBreakdownOpen(false)}
                className="px-4 py-2 bg-[#166BA3] text-white hover:bg-[#135887] rounded-xl font-semibold shadow-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL TARIFARIO OFICIAL DE FIRMAS ELECTRÓNICAS (FLYER MAYRA CASTILLO) ══ */}
      {isFirmaPricesOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            {/* Header del Flyer */}
            <div className="bg-gradient-to-r from-[#1E2A3C] via-[#166BA3] to-[#0A4B75] p-6 text-white relative">
              <button
                onClick={() => setIsFirmaPricesOpen(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                title="Cerrar"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-2 mb-1 text-sky-200 text-xs font-bold uppercase tracking-wider">
                <Key size={14} /> Distribuidor Autorizado
              </div>
              <h3 className="text-2xl font-black tracking-tight">Firma Electrónica</h3>
              <p className="text-xs text-sky-100/90 mt-0.5">Archivo digital .p12 para facturación SRI y trámites legales</p>
            </div>

            {/* Tabla de Precios Oficial */}
            <div className="p-6 space-y-4">
              <div className="bg-[#166BA3] rounded-2xl p-4 text-white shadow-md">
                <div className="text-center font-bold text-xs uppercase tracking-wider text-sky-200 mb-3">
                  Precios Incluidos IVA
                </div>
                <div className="divide-y divide-white/15 text-xs font-semibold">
                  {[
                    { vigencia: '1 mes',  precio: '$15' },
                    { vigencia: '1 año',  precio: '$21' },
                    { vigencia: '2 años', precio: '$32' },
                    { vigencia: '3 años', precio: '$47' },
                    { vigencia: '4 años', precio: '$67' },
                  ].map((row, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between px-2 hover:bg-white/5 rounded-lg transition-colors">
                      <span className="text-slate-100 text-sm font-medium">{row.vigencia}</span>
                      <span className="text-lg font-mono font-extrabold text-white">{row.precio}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Información de Ubicación y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Ubicación</span>
                  <p className="font-semibold text-slate-800 leading-tight">
                    Calle Juan José Peña entre 10 de Agosto y José Antonio Eguiguren
                  </p>
                  <span className="text-[10px] text-slate-400">Loja, Ecuador</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Contacto / WhatsApp</span>
                  <p className="font-mono font-bold text-slate-800 text-sm">
                    099 627 4187
                  </p>
                  <span className="text-[10px] text-emerald-600 font-semibold block">● Emisión inmediata</span>
                </div>
              </div>

              {/* Acciones: Copiar texto para WhatsApp */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const textoPrecios = 
                      `🔐 *Tarifario Oficial — Firma Electrónica (.p12)*\n` +
                      `_Estudio Contable Mayra Castillo_\n\n` +
                      `*Precios con IVA incluido:*\n` +
                      `• 1 mes: $15\n` +
                      `• 1 año: $21\n` +
                      `• 2 años: $32\n` +
                      `• 3 años: $47\n` +
                      `• 4 años: $67\n\n` +
                      `📍 *Oficina:* Calle Juan José Peña entre 10 de Agosto y José Antonio Eguiguren (Loja)\n` +
                      `📞 *Teléfono:* 099 627 4187\n\n` +
                      `_Requisitos Persona Natural: Foto de cédula ambos lados, selfie al mentón y correo._`;
                    navigator.clipboard.writeText(textoPrecios);
                    setCopiedFirmaPrices(true);
                    setTimeout(() => setCopiedFirmaPrices(false), 2500);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-2 transition-all"
                >
                  {copiedFirmaPrices ? (
                    <>
                      <CheckCheck size={14} className="text-emerald-600" />
                      <span className="text-emerald-600">¡Copiado para WhatsApp!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="text-slate-500" />
                      <span>Copiar texto para cliente</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsFirmaPricesOpen(false)}
                  className="py-2.5 px-5 bg-[#166BA3] text-white hover:bg-[#135887] rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardView />;
}
