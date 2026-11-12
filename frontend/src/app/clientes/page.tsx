// frontend/src/app/clientes/page.tsx
'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { ClientOwnerItem, TaxpayerItem, TaxRegime } from '@/types/client';
import Link from 'next/link';
import {
  Search,
  Plus,
  Copy,
  Check,
  User,
  Building2,
  Calendar,
  Key,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  X,
  Phone,
  Sparkles,
  ExternalLink,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

const REGIME_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'MENSUAL', label: 'Mensuales' },
  { key: 'SEMESTRAL', label: 'Semestrales' },
  { key: 'ANUAL', label: 'Anuales' },
  { key: 'COMPANIA_SUPERCIAS', label: 'Supercias' },
  { key: 'DEVOLUCION_IVA_3RA_EDAD', label: 'Dev. IVA 3ra Edad' },
  { key: 'INACTIVO_CERRADO', label: 'Cerrados' },
];


const SRI_EXPIRATION_DAYS: Record<number, number> = {
  1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28,
};

function getAutoFechaDecla(ruc: string, regimen: string): string {
  const cleaned = ruc.trim().replace(/\D/g, '');
  if (cleaned.length < 9) return '';
  const noveno = parseInt(cleaned.charAt(8), 10);
  if (isNaN(noveno)) return '';
  const dia = SRI_EXPIRATION_DAYS[noveno] || 28;
  if (regimen === 'SEMESTRAL' || regimen === 'DEVOLUCION_IVA_3RA_EDAD') return `${dia} JU-EN`;
  if (regimen === 'ANUAL') return `${dia} MARZO`;
  return `${dia}C/MES`;
}

const SRI_DAYS = [
  { digit: 1, day: 10 },
  { digit: 2, day: 12 },
  { digit: 3, day: 14 },
  { digit: 4, day: 16 },
  { digit: 5, day: 18 },
  { digit: 6, day: 20 },
  { digit: 7, day: 22 },
  { digit: 8, day: 24 },
  { digit: 9, day: 26 },
  { digit: 0, day: 28 },
];

function ClientesView() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<ClientOwnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [selectedDigit, setSelectedDigit] = useState<number | null>(null);

  // Toast de clave copiada
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Semáforo tributario por taxpayerId (mapa)
  const [taxAlertMap, setTaxAlertMap] = useState<Record<number, { estado: 'VERDE' | 'AMARILLO' | 'ROJO'; dueDay: number }>>({});

  // Modal para nuevo cliente / empresa / editar cliente dueño
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'CLIENT' | 'TAXPAYER' | 'EDIT_OWNER'>('CLIENT');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  // Modal de confirmación para eliminar cliente
  const [clientToDelete, setClientToDelete] = useState<ClientOwnerItem | null>(null);
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState<1 | 2>(1);
  const [deleteInputName, setDeleteInputName] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Formulario de Cliente Dueño
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientPin, setNewClientPin] = useState('0000');
  const [newClientIsVip, setNewClientIsVip] = useState(false);

  // Formulario Unificado en 3 Pasos (Excel Mayra)
  const [clientMode, setClientMode] = useState<'NEW_OWNER' | 'EXISTING_OWNER'>('NEW_OWNER');
  const [newRazonSocial, setNewRazonSocial] = useState('');
  const [newRuc, setNewRuc] = useState('');
  const [newFechaDecla, setNewFechaDecla] = useState('');
  const [newRegimen, setNewRegimen] = useState<TaxRegime>('MENSUAL');
  const [newEmail, setNewEmail] = useState('');
  // Claves
  const [newClaveSri, setNewClaveSri] = useState('');
  const [newClaveFirma, setNewClaveFirma] = useState('');
  const [newFirmaExpira, setNewFirmaExpira] = useState('');
  const [newClaveIess, setNewClaveIess] = useState('');
  const [newClaveSut, setNewClaveSut] = useState('');
  const [newClaveSalar, setNewClaveSalar] = useState('');
  const [newClaveSupercias, setNewClaveSupercias] = useState('');
  // Obligaciones (Checks y valores en texto o número del Excel)
  const [newCheckDecla, setNewCheckDecla] = useState(true);
  const [newCheckIce, setNewCheckIce] = useState(false);
  const [newCheckAnexo, setNewCheckAnexo] = useState(false);
  const [newCheckIva, setNewCheckIva] = useState(true);
  const [newCheckSalar, setNewCheckSalar] = useState(false);
  const [newCheckSut, setNewCheckSut] = useState(false);
  const [newCheckIess, setNewCheckIess] = useState(false);
  const [newCheckSupercias, setNewCheckSupercias] = useState(false);
  const [newCheckPatente, setNewCheckPatente] = useState(false);
  // Detalles de texto o número
  const [newDeclaDetalle, setNewDeclaDetalle] = useState('');
  const [newIceDetalle, setNewIceDetalle] = useState('');
  const [newAnexoDetalle, setNewAnexoDetalle] = useState('');
  const [newIvaDetalle, setNewIvaDetalle] = useState('');
  const [newSalarDetalle, setNewSalarDetalle] = useState('');
  const [newSutDetalle, setNewSutDetalle] = useState('');
  const [newIessDetalle, setNewIessDetalle] = useState('');
  const [newSuperciasDetalle, setNewSuperciasDetalle] = useState('');
  const [newPatenteDetalle, setNewPatenteDetalle] = useState('');
  // Paso 3: Cobro (Solo Mayra)
  const [newAutoBillFreq, setNewAutoBillFreq] = useState<'NONE' | 'MENSUAL' | 'SEMESTRAL' | 'ANUAL'>('MENSUAL');
  const [newAutoBillAmount, setNewAutoBillAmount] = useState('0.00');
  const [newAppliesVat, setNewAppliesVat] = useState(false);
  const [newDevIvaPercent, setNewDevIvaPercent] = useState('10.00');
  const [saving, setSaving] = useState(false);

  const isAssistant = user?.role === 'ASISTENTE';

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Si viene del Dashboard con ?action=new, abrir el modal de nuevo cliente automáticamente
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setModalType('CLIENT');
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const fetchClients = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al obtener clientes.');
      }
      setClients(data.data || []);

      // Cargar semáforo tributario en paralelo
      try {
        const alertRes = await fetch('/api/clients/tax-alerts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const alertData = await alertRes.json();
        if (alertRes.ok && alertData.success && alertData.semaforo?.items) {
          const map: Record<number, { estado: 'VERDE' | 'AMARILLO' | 'ROJO'; dueDay: number }> = {};
          alertData.semaforo.items.forEach((item: any) => {
            map[item.taxpayerId] = { estado: item.estado, dueDay: item.dueDay };
          });
          setTaxAlertMap(map);
        }
      } catch (errAlert) {
        console.error('Error cargando alertas tributarias:', errAlert);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchClients();
    }
  }, [token]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(`${label}: ${text}`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2200);
  };

  // Filtrado reactivo en Frontend
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // Filtro de texto
      const q = search.toLowerCase().trim();
      const matchOwner =
        client.fullName.toLowerCase().includes(q) ||
        client.whatsappPhone.includes(q);

      const matchTaxpayer = client.taxpayers.some((t) => {
        const matchName = t.razonSocial.toLowerCase().includes(q);
        const matchRuc = t.ruc?.toLowerCase().includes(q);
        return matchName || matchRuc;
      });

      if (q && !matchOwner && !matchTaxpayer) return false;

      // Filtro de pestaña de régimen
      if (activeTab !== 'ALL') {
        const hasRegime = client.taxpayers.some((t) => t.regimen === activeTab);
        if (!hasRegime) return false;
      }

      // Filtro de 9no dígito
      if (selectedDigit !== null) {
        const hasDigit = client.taxpayers.some((t) => t.novenoDigito === selectedDigit);
        if (!hasDigit) return false;
      }

      return true;
    });
  }, [clients, search, activeTab, selectedDigit]);

  // Manejo de creación
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      let clientOwnerId = selectedClientId;

      // 1. Si es Dueño Nuevo, crearlo primero
      if (clientMode === 'NEW_OWNER') {
        const resOwner = await fetch('/api/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: newClientName,
            whatsappPhone: newClientPhone,
            securityPin: newClientPin,
            isVip: newClientIsVip,
          }),
        });
        const dataOwner = await resOwner.json();
        if (!resOwner.ok || !dataOwner.success) {
          throw new Error(dataOwner.message || 'Error al guardar cliente.');
        }
        clientOwnerId = dataOwner.data.id;
      }

      if (!clientOwnerId) {
        throw new Error('Debe seleccionar o registrar un dueño titular.');
      }

      // 2. Si ingresó datos de Razón Social / RUC, registrar su empresa de una vez
      if (newRazonSocial && newRazonSocial.trim()) {
        const resTax = await fetch(`/api/clients/${clientOwnerId}/taxpayers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            razonSocial: newRazonSocial.trim(),
            ruc: newRuc ? newRuc.trim() : null,
            fechaDecla: newFechaDecla || null,
            regimen: newRegimen,
            email: newEmail || null,
            claveSri: newClaveSri || null,
            claveFirma: newClaveFirma || null,
            firmaExpira: newFirmaExpira || null,
            claveIess: newClaveIess || null,
            claveSut: newClaveSut || null,
            claveSalar: newClaveSalar || null,
            claveSupercias: newClaveSupercias || null,
            checkDecla: newCheckDecla,
            checkIce: newCheckIce,
            checkAnexo: newCheckAnexo,
            checkIva: newCheckIva,
            checkSalar: newCheckSalar,
            checkSut: newCheckSut,
            checkIess: newCheckIess,
            checkSupercias: newCheckSupercias,
            checkPatente: newCheckPatente,
            declaDetalle: newDeclaDetalle || null,
            iceDetalle: newIceDetalle || null,
            anexoDetalle: newAnexoDetalle || null,
            ivaDetalle: newIvaDetalle || null,
            salarDetalle: newSalarDetalle || null,
            sutDetalle: newSutDetalle || null,
            iessDetalle: newIessDetalle || null,
            superciasDetalle: newSuperciasDetalle || null,
            patenteDetalle: newPatenteDetalle || null,
            autoBillFreq: newAutoBillFreq,
            autoBillAmount: Number(newAutoBillAmount || 0),
            appliesVat: newAppliesVat,
            devIvaPercent: Number(newDevIvaPercent || 10),
          }),
        });
        const dataTax = await resTax.json();
        if (!resTax.ok || !dataTax.success) {
          throw new Error(dataTax.message || 'El cliente se creó pero falló el registro de su RUC.');
        }
      }

      setIsModalOpen(false);
      // Resetear campos
      setNewClientName('');
      setNewClientPhone('');
      setNewClientPin('0000');
      setNewClientIsVip(false);
      setNewRazonSocial('');
      setNewRuc('');
      setNewClaveSri('');
      setNewClaveFirma('');
      setNewClaveIess('');
      setNewClaveSut('');
      setNewClaveSalar('');
      setNewClaveSupercias('');
      setNewEmail('');
      setNewAutoBillAmount('0.00');

      await fetchClients();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Manejo de edición de Cliente Dueño
  const handleEditOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedClientId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${selectedClientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: newClientName,
          whatsappPhone: newClientPhone,
          securityPin: newClientPin,
          isVip: newClientIsVip,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al actualizar cliente.');
      }
      setIsModalOpen(false);
      setSelectedClientId(null);
      await fetchClients();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Manejo de eliminación definitiva con doble confirmación
  const handleDeleteClient = async () => {
    if (!token || !clientToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al eliminar cliente.');
      }
      setClientToDelete(null);
      setDeleteConfirmationStep(1);
      setDeleteInputName('');
      await fetchClients();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveTaxpayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedClientId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${selectedClientId}/taxpayers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          razonSocial: newRazonSocial,
          ruc: newRuc,
          regimen: newRegimen,
          email: newEmail,
          claveSri: newClaveSri,
          claveIess: newClaveIess,
          claveSut: newClaveSut,
          claveFirma: newClaveFirma,
          autoBillAmount: Number(newAutoBillAmount),
          appliesVat: newAppliesVat,
          devIvaPercent: Number(newDevIvaPercent),
          checkDecla: true,
          checkIva: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al registrar empresa.');
      }
      setIsModalOpen(false);
      setNewRazonSocial('');
      setNewRuc('');
      await fetchClients();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] pb-16 md:pl-64">
      <Navbar />

      {/* Toast flotante de copiado de clave */}
      {copiedKey && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E2A3C] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-bounce border border-emerald-400/40">
          <Check size={16} className="text-emerald-400" />
          <span>¡Copiado con éxito! ({copiedKey})</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Cabecera del Directorio */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1E2A3C] flex items-center gap-2.5">
              <Building2 className="text-[#166BA3]" size={26} />
              Directorio Maestro de Clientes
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              Tabla fija unificada con claves protegidas, 9no dígito automático y modo operativo.
            </p>
          </div>

          <button
            onClick={() => {
              setModalType('CLIENT');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-[#166BA3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-md hover:bg-[#166BA3]/90 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus size={18} />
            Nuevo Cliente Dueño
          </button>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white/85 backdrop-blur-md border border-white/60 shadow-sm rounded-3xl p-5 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar por Dueño, Razón Social o RUC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200/80 bg-white/70 text-[#1E2A3C] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]/40"
              />
            </div>

            {/* Contador de resultados */}
            <div className="text-xs font-semibold text-gray-500 self-end md:self-center">
              Mostrando <strong className="text-[#166BA3]">{filteredClients.length}</strong> de {clients.length} clientes
            </div>
          </div>

          {/* Pestañas de Régimen */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {REGIME_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#1E2A3C] text-white shadow-sm'
                      : 'bg-white/60 text-gray-600 hover:bg-white hover:text-[#1E2A3C]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>


        </div>

        {/* Listado de Clientes y Tabla de Empresas */}
        {loading ? (
          <div className="bg-white/80 rounded-3xl p-12 text-center shadow-sm">
            <div className="w-8 h-8 border-3 border-[#166BA3] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-xs font-medium">Cargando directorio de clientes...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-3xl p-6 text-center text-sm">
            <AlertCircle className="mx-auto mb-2" size={24} />
            <p className="font-semibold">{error}</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="bg-white/80 rounded-3xl p-12 text-center shadow-sm">
            <p className="text-gray-400 text-sm">No se encontraron clientes con los filtros aplicados.</p>
          </div>
        ) : viewMode === 'GRID' ? (
            /* ═══════════════ VISTA EN CUADRÍCULA COMPACTA (TARJETAS CUADRADAS ORDENADAS) ═══════════════ */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredClients.map((client) => {
                const totalDebt = client.saldoPendienteTotal || 0;
                return (
                  <div
                    key={client.id}
                    onClick={() => router.push(`/clientes/${client.id}`)}
                    className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xs rounded-2xl p-3.5 hover:shadow-md transition-all flex flex-col justify-between hover:border-[#166BA3]/60 group cursor-pointer"
                  >
                    <div>
                      {/* Cabecera de la Tarjeta Cuadrada Compacta */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#166BA3] to-[#1E2A3C] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                            {client.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <Link
                                href={`/clientes/${client.id}`}
                                className="font-bold text-xs text-[#1E2A3C] hover:text-[#166BA3] transition-colors truncate block"
                                title={client.fullName}
                              >
                                {client.fullName}
                              </Link>
                              {client.isVip && (
                                <span className="bg-amber-100 text-amber-700 text-[8px] font-extrabold px-1 py-0.2 rounded-full shrink-0">
                                  VIP
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone size={10} className="text-gray-400" />
                              {client.whatsappPhone}
                            </span>
                          </div>
                        </div>

                        {/* Saldo deudor badge y botón eliminar */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!isAssistant && client.saldoPendienteTotal !== undefined && (
                            <div className="text-right">
                              <span className="text-[8px] uppercase font-bold text-gray-400 block">Saldo</span>
                              <span
                                className={`text-[11px] font-extrabold ${
                                  totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                                }`}
                              >
                                ${totalDebt.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClientToDelete(client);
                              setDeleteConfirmationStep(1);
                              setDeleteInputName('');
                            }}
                            className="p-1 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Eliminar Cliente"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Lista de Empresas / Taxpayers adentro del cuadrado */}
                      <div className="py-2.5 space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                            {client.taxpayers.length} Empresa{client.taxpayers.length !== 1 ? 's' : ''} / RUC
                          </span>
                          {client.taxpayers.length > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-[#166BA3] font-bold text-[9px]">
                              +{client.taxpayers.length - 1} más en perfil
                            </span>
                          )}
                        </div>

                        {client.taxpayers.length === 0 ? (
                          <div className="p-2 bg-gray-50 rounded-xl text-center text-[10px] text-gray-400">
                            Sin RUCs registrados aún.
                          </div>
                        ) : (
                          client.taxpayers.slice(0, 1).map((t) => {
                            const semaforo = taxAlertMap[t.id];
                            return (
                              <div
                                key={t.id}
                                className="p-2.5 bg-gray-50/70 hover:bg-blue-50/40 rounded-xl border border-gray-100 transition-colors space-y-1.5"
                              >
                                {/* Línea 1: Razón Social + Semáforo */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-bold text-[11px] text-[#1E2A3C] truncate" title={t.razonSocial}>
                                    {t.razonSocial}
                                  </span>
                                  {semaforo?.estado === 'VERDE' && (
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-bold shrink-0">
                                      🟢 Al día
                                    </span>
                                  )}
                                  {semaforo?.estado === 'ROJO' && (
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[8px] font-bold shrink-0">
                                      🔴 Vence
                                    </span>
                                  )}
                                  {(!semaforo || semaforo?.estado === 'AMARILLO') && (
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[8px] font-bold shrink-0">
                                      🟡 Pendiente
                                    </span>
                                  )}
                                </div>

                                {/* Línea 2: RUC + Fecha Decla */}
                                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                                  <span className="truncate max-w-[120px]">{t.ruc || 'Sin RUC'}</span>
                                  <span className="px-1 py-0.2 rounded bg-blue-50 text-[#166BA3] font-semibold text-[9px]">
                                    {t.fechaDecla || '10C/MES'}
                                  </span>
                                </div>

                                {/* Línea 3: Claves Rápidas en 1 clic */}
                                <div className="flex flex-wrap items-center gap-1 pt-0.5 border-t border-gray-200/50">
                                  {t.claveSri && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopy(t.claveSri!, 'SRI');
                                      }}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-white border border-gray-200 rounded hover:border-[#166BA3] hover:text-[#166BA3] font-mono text-[9px]"
                                      title="Copiar Clave SRI"
                                    >
                                      <Key size={9} className="text-amber-500" />
                                      <span>SRI</span>
                                      <Copy size={8} className="text-gray-400" />
                                    </button>
                                  )}
                                  {t.claveIess && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopy(t.claveIess!, 'IESS');
                                      }}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-white border border-gray-200 rounded hover:border-[#166BA3] hover:text-[#166BA3] font-mono text-[9px]"
                                      title="Copiar Clave IESS"
                                    >
                                      <Key size={9} className="text-emerald-500" />
                                      <span>IESS</span>
                                      <Copy size={8} className="text-gray-400" />
                                    </button>
                                  )}
                                  {t.claveFirma && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopy(t.claveFirma!, 'Firma');
                                      }}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-white border border-gray-200 rounded hover:border-[#166BA3] hover:text-[#166BA3] font-mono text-[9px]"
                                      title="Copiar Clave de Firma"
                                    >
                                      <ShieldCheck size={9} className="text-blue-500" />
                                      <span>Firma</span>
                                      <Copy size={8} className="text-gray-400" />
                                    </button>
                                  )}
                                  {!t.claveSri && !t.claveIess && !t.claveFirma && (
                                    <span className="text-gray-300 text-[9px]">Sin claves</span>
                                  )}
                                </div>

                                {/* Línea 4: Badges de Obligaciones */}
                                <div className="flex flex-wrap items-center gap-1 text-[8px] pt-0.5">
                                  {t.checkDecla && <span className="px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold">DECLA</span>}
                                  {t.checkIva && <span className="px-1 py-0.2 rounded bg-blue-50 text-blue-700 font-bold">IVA</span>}
                                  {t.checkAnexo && <span className="px-1 py-0.2 rounded bg-purple-50 text-purple-700 font-bold">ANX</span>}
                                  {t.checkIess && <span className="px-1 py-0.2 rounded bg-amber-50 text-amber-700 font-bold">IESS</span>}
                                  {t.checkSut && <span className="px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold">SUT</span>}
                                  {t.checkSupercias && <span className="px-1 py-0.2 rounded bg-gray-100 text-gray-700 font-bold">SUP</span>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Footer de la tarjeta con tarifa o estado */}
                    {!isAssistant && client.taxpayers[0]?.autoBillAmount && Number(client.taxpayers[0].autoBillAmount) > 0 && (
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-end">
                        <span className="text-[10px] font-semibold text-gray-500">
                          ${Number(client.taxpayers[0].autoBillAmount).toFixed(2)}/mes
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ═══════════════ VISTA EN TABLA HORIZONTAL (MODO LISTA) ═══════════════ */
            <div className="space-y-6">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="bg-white/85 backdrop-blur-md border border-white/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all hover:shadow-md"
                >
                  {/* Cabecera del Cliente Dueño */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#166BA3] to-[#1E2A3C] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {client.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/clientes/${client.id}`}
                            className="text-base font-bold text-[#1E2A3C] hover:text-[#166BA3] transition-colors"
                          >
                            {client.fullName}
                          </Link>
                          {client.isVip && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone size={12} />
                            {client.whatsappPhone}
                          </span>
                          <span>•</span>
                          <span>{client.taxpayers.length} empresa(s)</span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones y Saldo de Dueño */}
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {!isAssistant && client.saldoPendienteTotal !== undefined && (
                        <div className="bg-gray-50 border border-gray-200/80 px-3 py-1.5 rounded-xl text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block">
                            Saldo Total Pendiente
                          </span>
                          <span
                            className={`text-sm font-bold ${
                              client.saldoPendienteTotal > 0
                                ? 'text-red-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            ${client.saldoPendienteTotal.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setModalType('TAXPAYER');
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-[#166BA3] hover:text-white text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                      >
                        <Plus size={14} />
                        + Agregar Empresa / RUC
                      </button>
                    </div>
                  </div>

                  {/* Tabla de Empresas */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-gray-400 font-bold border-b border-gray-100">
                          <th className="pb-2.5 font-semibold">Semáforo</th>
                          <th className="pb-2.5 font-semibold">Razón Social</th>
                          <th className="pb-2.5 font-semibold">RUC</th>
                          <th className="pb-2.5 font-semibold">Fecha Decla</th>
                          <th className="pb-2.5 font-semibold">Régimen</th>
                          <th className="pb-2.5 font-semibold">Claves Rápidas (1 Clic)</th>
                          <th className="pb-2.5 font-semibold">Obligaciones</th>
                          {!isAssistant && <th className="pb-2.5 font-semibold text-right">Cobro Config.</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {client.taxpayers.map((t) => (
                          <tr key={t.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-3">
                              {taxAlertMap[t.id]?.estado === 'VERDE' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold" title="Declaración del mes subida">
                                  🟢 Al día
                                </span>
                              )}
                              {taxAlertMap[t.id]?.estado === 'ROJO' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold" title="Vence hoy/mañana o vencido sin declaración">
                                  🔴 Vence/Venció
                                </span>
                              )}
                              {(!taxAlertMap[t.id] || taxAlertMap[t.id]?.estado === 'AMARILLO') && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold" title="Pendiente de declaración">
                                  🟡 Pendiente
                                </span>
                              )}
                            </td>
                            <td className="py-3 font-semibold text-[#1E2A3C]">
                              {t.razonSocial}
                            </td>
                            <td className="py-3 font-mono text-gray-600">
                              {t.ruc || <span className="text-gray-300">Sin RUC</span>}
                            </td>
                            <td className="py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-50 text-[#166BA3] font-semibold text-[11px]">
                                {t.fechaDecla || '10C/MES'}
                              </span>
                            </td>
                            <td className="py-3">
                              <span className="text-[11px] font-medium text-gray-600">
                                {t.regimen}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {t.claveSri && (
                                  <button
                                    onClick={() => handleCopy(t.claveSri!, 'SRI')}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg hover:border-[#166BA3] hover:text-[#166BA3] transition-all font-mono text-[10px]"
                                    title="Copiar Clave SRI"
                                  >
                                    <Key size={11} className="text-amber-500" />
                                    <span>SRI</span>
                                    <Copy size={10} className="text-gray-400" />
                                  </button>
                                )}
                                {t.claveIess && (
                                  <button
                                    onClick={() => handleCopy(t.claveIess!, 'IESS')}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg hover:border-[#166BA3] hover:text-[#166BA3] transition-all font-mono text-[10px]"
                                    title="Copiar Clave IESS"
                                  >
                                    <Key size={11} className="text-emerald-500" />
                                    <span>IESS</span>
                                    <Copy size={10} className="text-gray-400" />
                                  </button>
                                )}
                                {t.claveFirma && (
                                  <button
                                    onClick={() => handleCopy(t.claveFirma!, 'Firma')}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg hover:border-[#166BA3] hover:text-[#166BA3] transition-all font-mono text-[10px]"
                                    title="Copiar Clave de Firma"
                                  >
                                    <ShieldCheck size={11} className="text-blue-500" />
                                    <span>Firma</span>
                                    <Copy size={10} className="text-gray-400" />
                                  </button>
                                )}
                                {!t.claveSri && !t.claveIess && !t.claveFirma && (
                                  <span className="text-gray-300 text-[11px]">Sin claves</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1 text-[10px]">
                                {t.checkDecla && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">DECLA</span>}
                                {t.checkIva && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">IVA</span>}
                                {t.checkAnexo && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">ANX</span>}
                                {t.checkIess && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">IESS</span>}
                                {t.checkSut && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">SUT</span>}
                              </div>
                            </td>
                            {!isAssistant && (
                              <td className="py-3 text-right">
                                {t.regimen === 'DEVOLUCION_IVA_3RA_EDAD' ? (
                                  <span className="text-xs font-bold text-[#166BA3]">
                                    {t.devIvaPercent || 10}% Dev.
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-[#1E2A3C]">
                                    ${Number(t.autoBillAmount || 0).toFixed(2)}
                                    {t.appliesVat && (
                                      <span className="text-[10px] text-gray-400 ml-1">+IVA</span>
                                    )}
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
      </main>

      {/* Modal para Crear Cliente o Empresa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            {modalType === 'CLIENT' ? (
              <form onSubmit={handleSaveClient} className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-[#1E2A3C] flex items-center gap-2">
                    <User className="text-[#166BA3]" size={22} />
                    Ficha de Creación de Cliente
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configura el Dueño, la Ficha Tributaria y las Reglas de Cartera en una sola vista.
                  </p>
                </div>

                {/* ═══════════════ PASO 1: CONTACTO / DUEÑO PAGADOR ═══════════════ */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                      🟢 PASO 1: ¿Quién es el Dueño que paga? (Contacto WhatsApp)
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setClientMode('NEW_OWNER')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          clientMode === 'NEW_OWNER'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-gray-600 hover:bg-emerald-100'
                        }`}
                      >
                        + Nuevo Dueño
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientMode('EXISTING_OWNER')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          clientMode === 'EXISTING_OWNER'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-gray-600 hover:bg-emerald-100'
                        }`}
                      >
                        Dueño Existente
                      </button>
                    </div>
                  </div>

                  {clientMode === 'NEW_OWNER' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Nombre del Dueño / Contacto *
                        </label>
                        <input
                          type="text"
                          required
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          placeholder="Ej. Pedro Rojas / Juan Pérez"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          WhatsApp de Cobro y Bot *
                        </label>
                        <input
                          type="text"
                          required
                          value={newClientPhone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewClientPhone(val);
                            // Auto-llenar PIN con los últimos 4 dígitos si está en default
                            const digits = val.replace(/\D/g, '');
                            if (digits.length >= 4 && (newClientPin === '0000' || !newClientPin)) {
                              setNewClientPin(digits.slice(-4));
                            }
                          }}
                          placeholder="Ej. 0991234567 / 593991234567"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                          <span>PIN de Seguridad</span>
                          <span className="text-[10px] text-emerald-700 font-medium">Asignación automática</span>
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={newClientPin}
                          onChange={(e) => setNewClientPin(e.target.value)}
                          placeholder="4 dígitos"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none bg-white font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          id="vipCheck"
                          checked={newClientIsVip}
                          onChange={(e) => setNewClientIsVip(e.target.checked)}
                          className="rounded text-[#166BA3] focus:ring-[#166BA3]"
                        />
                        <label htmlFor="vipCheck" className="text-xs font-semibold text-gray-700">
                          Cliente Prioritario VIP (Atención directa)
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Selecciona el Dueño Existente *
                      </label>
                      <select
                        value={selectedClientId || ''}
                        onChange={(e) => setSelectedClientId(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                      >
                        <option value="">-- Elige un dueño pagador registrado --</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} ({c.whatsappPhone})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* ═══════════════ PASO 2: LA FICHA DEL EXCEL DE MAYRA ═══════════════ */}
                <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 space-y-3.5">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wide block">
                    🔵 PASO 2: La Ficha del Excel (Datos, RUC, Claves y Checks)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        1. RAZÓN SOCIAL / NOMBRE EMPRESA *
                      </label>
                      <input
                        type="text"
                        value={newRazonSocial}
                        onChange={(e) => setNewRazonSocial(e.target.value)}
                        placeholder="Ej. DHARMA COSMETICS S.A.S. (o dejar vacío para usar nombre del dueño)"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        2. RUC (13 dígitos)
                      </label>
                      <input
                        type="text"
                        value={newRuc}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewRuc(val);
                          // 🤖 ¡SE LLENA SOLO! Al escribir el 9no dígito se calcula la fecha SRI
                          const autoFecha = getAutoFechaDecla(val, newRegimen);
                          if (autoFecha) setNewFechaDecla(autoFecha);
                        }}
                        placeholder="1191797243001"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white font-mono focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                        <span>3. FECHA DECLARACIÓN (SRI)</span>
                        <span className="text-[10px] text-blue-700 font-normal">🤖 9no dígito</span>
                      </label>
                      <input
                        type="text"
                        value={newFechaDecla}
                        onChange={(e) => setNewFechaDecla(e.target.value)}
                        placeholder="Ej. 16C/MES"
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs bg-blue-50/50 font-bold text-blue-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        4. RÉGIMEN (Frecuencia Declaración)
                      </label>
                      <select
                        value={newRegimen}
                        onChange={(e) => {
                          const reg = e.target.value as TaxRegime;
                          setNewRegimen(reg);
                          if (newRuc) setNewFechaDecla(getAutoFechaDecla(newRuc, reg));
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                      >
                        <option value="MENSUAL">Mensual</option>
                        <option value="SEMESTRAL">Semestral</option>
                        <option value="ANUAL">Anual</option>
                        <option value="COMPANIA_SUPERCIAS">Compañía Supercias</option>
                        <option value="DEVOLUCION_IVA_3RA_EDAD">Devolución IVA 3ra Edad</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        5. Email del Cliente
                      </label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="cliente@correo.com"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 6. Las Claves (SRI, FIRMA, IESS, SUT, SALARIO, SUPERCIAS) */}
                  <div className="pt-2 border-t border-blue-200/60">
                    <span className="text-[11px] font-bold text-gray-700 block mb-2">
                      🔑 6. Las Claves de Acceso (Opcionales - se copian con 1 clic en la tabla)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Clave SRI</label>
                        <input
                          type="text"
                          value={newClaveSri}
                          onChange={(e) => setNewClaveSri(e.target.value)}
                          placeholder="Clave SRI"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Clave Firma .p12</label>
                        <input
                          type="text"
                          value={newClaveFirma}
                          onChange={(e) => setNewClaveFirma(e.target.value)}
                          placeholder="Clave firma"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Firma Caduca El</label>
                        <input
                          type="date"
                          value={newFirmaExpira}
                          onChange={(e) => setNewFirmaExpira(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Clave IESS</label>
                        <input
                          type="text"
                          value={newClaveIess}
                          onChange={(e) => setNewClaveIess(e.target.value)}
                          placeholder="Clave IESS"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Clave SUT</label>
                        <input
                          type="text"
                          value={newClaveSut}
                          onChange={(e) => setNewClaveSut(e.target.value)}
                          placeholder="Clave SUT"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Clave Supercias / Salario</label>
                        <input
                          type="text"
                          value={newClaveSupercias}
                          onChange={(e) => setNewClaveSupercias(e.target.value)}
                          placeholder="Supercias"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 7. Las Obligaciones con Check y Valor/Detalle editable (texto o número) */}
                  <div className="pt-2 border-t border-blue-200/60">
                    <span className="text-[11px] font-bold text-gray-700 block mb-0.5">
                      ☑️ 7. Obligaciones Tributarias y Laborales
                    </span>
                    <p className="text-[10px] text-gray-400 mb-2">
                      Marca la obligación y/o ingresa el valor de la columna (ej: año &quot;2022&quot;, monto &quot;30&quot;, &quot;SI&quot;)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {[
                        { label: 'DECLA', check: newCheckDecla, setCheck: setNewCheckDecla, val: newDeclaDetalle, setVal: setNewDeclaDetalle },
                        { label: 'IVA', check: newCheckIva, setCheck: setNewCheckIva, val: newIvaDetalle, setVal: setNewIvaDetalle },
                        { label: 'ANEXO (ATS)', check: newCheckAnexo, setCheck: setNewCheckAnexo, val: newAnexoDetalle, setVal: setNewAnexoDetalle },
                        { label: 'ICE', check: newCheckIce, setCheck: setNewCheckIce, val: newIceDetalle, setVal: setNewIceDetalle },
                        { label: 'IESS', check: newCheckIess, setCheck: setNewCheckIess, val: newIessDetalle, setVal: setNewIessDetalle },
                        { label: 'SUT', check: newCheckSut, setCheck: setNewCheckSut, val: newSutDetalle, setVal: setNewSutDetalle },
                        { label: 'SALARIO', check: newCheckSalar, setCheck: setNewCheckSalar, val: newSalarDetalle, setVal: setNewSalarDetalle },
                        { label: 'SUPERCIAS', check: newCheckSupercias, setCheck: setNewCheckSupercias, val: newSuperciasDetalle, setVal: setNewSuperciasDetalle },
                        { label: 'PATENTE', check: newCheckPatente, setCheck: setNewCheckPatente, val: newPatenteDetalle, setVal: setNewPatenteDetalle },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="p-2 rounded-xl bg-white border border-gray-200 flex flex-col gap-1 focus-within:border-[#166BA3] transition-colors"
                        >
                          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700 text-[11px]">
                            <input
                              type="checkbox"
                              checked={item.check}
                              onChange={(e) => item.setCheck(e.target.checked)}
                              className="rounded text-[#166BA3]"
                            />
                            <span>{item.label}</span>
                          </label>
                          <input
                            type="text"
                            value={item.val}
                            onChange={(e) => item.setVal(e.target.value)}
                            placeholder="Valor / Año..."
                            className="w-full px-2 py-0.5 rounded border border-gray-100 bg-slate-50 text-[10px] font-mono focus:bg-white focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ═══════════════ PASO 3: CUÁNTO Y CÓMO SE COBRA (SOLO MAYRA) ═══════════════ */}
                {!isAssistant && (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wide block">
                      🟡 PASO 3: Regla de Cobro de Cartera (Solo lo ve Mayra)
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Cobro Automático por Cron
                        </label>
                        <select
                          value={newAutoBillFreq}
                          onChange={(e) => setNewAutoBillFreq(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                        >
                          <option value="MENSUAL">Mensual (Día 1 de cada mes)</option>
                          <option value="SEMESTRAL">Semestral (Enero y Julio)</option>
                          <option value="ANUAL">Anual (Marzo / Abril)</option>
                          <option value="NONE">Sin cobro automático</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Honorario Mensual ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newAutoBillAmount}
                          onChange={(e) => setNewAutoBillAmount(e.target.value)}
                          placeholder="69.00"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none font-bold text-[#1E2A3C]"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          id="vatCheckModal"
                          checked={newAppliesVat}
                          onChange={(e) => setNewAppliesVat(e.target.checked)}
                          className="rounded text-[#166BA3]"
                        />
                        <label htmlFor="vatCheckModal" className="text-xs font-semibold text-gray-700">
                          + IVA 15% automático
                        </label>
                      </div>

                      {newRegimen === 'DEVOLUCION_IVA_3RA_EDAD' && (
                        <div className="sm:col-span-3 pt-2">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            % Comisión de Devolución IVA (3ra Edad)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={newDevIvaPercent}
                            onChange={(e) => setNewDevIvaPercent(e.target.value)}
                            placeholder="10.00"
                            className="w-full sm:w-48 px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#166BA3] text-white hover:bg-[#166BA3]/90 shadow-md active:scale-95 transition-all"
                  >
                    {saving ? 'Guardando en Bóveda...' : 'Guardar Cliente'}
                  </button>
                </div>
              </form>
            ) : modalType === 'TAXPAYER' ? (
              <form onSubmit={handleSaveTaxpayer} className="space-y-4">
                <h3 className="text-lg font-bold text-[#1E2A3C] flex items-center gap-2">
                  <Building2 className="text-[#166BA3]" size={20} />
                  Agregar Empresa / RUC
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRazonSocial}
                    onChange={(e) => setNewRazonSocial(e.target.value)}
                    placeholder="Ej. Dharma Comercial SAS"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      RUC (13 dígitos)
                    </label>
                    <input
                      type="text"
                      value={newRuc}
                      onChange={(e) => setNewRuc(e.target.value)}
                      placeholder="1191797001001"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Régimen
                    </label>
                    <select
                      value={newRegimen}
                      onChange={(e) => setNewRegimen(e.target.value as TaxRegime)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none bg-white"
                    >
                      <option value="MENSUAL">Mensual</option>
                      <option value="SEMESTRAL">Semestral</option>
                      <option value="ANUAL">Anual</option>
                      <option value="COMPANIA_SUPERCIAS">Supercias</option>
                      <option value="DEVOLUCION_IVA_3RA_EDAD">Dev. IVA 3ra Edad</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Clave SRI
                    </label>
                    <input
                      type="text"
                      value={newClaveSri}
                      onChange={(e) => setNewClaveSri(e.target.value)}
                      placeholder="SRI..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Clave Firma
                    </label>
                    <input
                      type="text"
                      value={newClaveFirma}
                      onChange={(e) => setNewClaveFirma(e.target.value)}
                      placeholder="Firma..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                    />
                  </div>
                </div>

                {!isAssistant && (
                  <div className="pt-2 border-t border-gray-100 space-y-3">
                    <span className="text-[11px] font-bold text-[#166BA3] block">
                      Configuración de Cartera (Solo Mayra)
                    </span>

                    {newRegimen === 'DEVOLUCION_IVA_3RA_EDAD' ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          % Comisión de Devolución
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newDevIvaPercent}
                          onChange={(e) => setNewDevIvaPercent(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Monto Cobro ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={newAutoBillAmount}
                            onChange={(e) => setNewAutoBillAmount(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-4">
                          <input
                            type="checkbox"
                            id="vatCheck"
                            checked={newAppliesVat}
                            onChange={(e) => setNewAppliesVat(e.target.checked)}
                          />
                          <label htmlFor="vatCheck" className="text-xs text-gray-700">
                            + IVA 15%
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#166BA3] text-white hover:bg-[#166BA3]/90 shadow-sm"
                  >
                    {saving ? 'Guardando...' : 'Guardar Empresa'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEditOwnerSubmit} className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                    <Edit2 className="text-[#166BA3]" size={18} />
                    Editar Cliente Dueño
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Modifica los datos del pagador / contacto titular.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nombre Completo / Titular *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    WhatsApp de Cobro *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    PIN de Seguridad (4 dígitos para entrega de claves)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={newClientPin}
                    onChange={(e) => setNewClientPin(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#166BA3]/40 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="editOwnerVip"
                    checked={newClientIsVip}
                    onChange={(e) => setNewClientIsVip(e.target.checked)}
                    className="rounded text-[#166BA3] focus:ring-[#166BA3]"
                  />
                  <label htmlFor="editOwnerVip" className="text-xs font-semibold text-gray-700">
                    Cliente Prioritario VIP (Atención directa)
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#166BA3] text-white hover:bg-[#166BA3]/90 shadow-sm"
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Modal con DOBLE AVISO para eliminar cliente y todo su expediente */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative border border-gray-100 animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => {
                setClientToDelete(null);
                setDeleteConfirmationStep(1);
                setDeleteInputName('');
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            {deleteConfirmationStep === 1 ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#1E2A3C]">
                    ¿Eliminar a {clientToDelete.fullName}?
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Esta acción eliminará al cliente titular y todas sus empresas registradas ({clientToDelete.taxpayers.length} RUCs), sus documentos en la bóveda, claves y registros de cartera.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">Aviso 1 de 2: Acción Destructiva</p>
                  <p className="text-[11px] opacity-90">
                    Al confirmar, se te solicitará escribir el nombre del cliente para evitar borrados accidentales.
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setClientToDelete(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmationStep(2)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
                  >
                    Continuar al Paso 2
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Trash2 size={24} />
                </div>

                <div>
                  <h3 className="text-base font-bold text-rose-600">
                    Aviso 2 de 2: Confirmación Definitiva
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Para confirmar la eliminación total, escribe exactamente el nombre del cliente a continuación:
                  </p>
                  <p className="text-xs font-bold font-mono text-[#1E2A3C] mt-2 select-all bg-slate-50 p-2 rounded-lg border border-slate-200">
                    {clientToDelete.fullName}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Escribe el nombre aquí:
                  </label>
                  <input
                    type="text"
                    value={deleteInputName}
                    onChange={(e) => setDeleteInputName(e.target.value)}
                    placeholder="Escribe el nombre para desbloquear"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmationStep(1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Regresar
                  </button>
                  <button
                    type="button"
                    disabled={deleteInputName.trim().toLowerCase() !== clientToDelete.fullName.trim().toLowerCase() || deleting}
                    onClick={handleDeleteClient}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar Definitivamente'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientesPage() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-[#166BA3] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <ClientesView />
      </Suspense>
    </AuthProvider>
  );
}

