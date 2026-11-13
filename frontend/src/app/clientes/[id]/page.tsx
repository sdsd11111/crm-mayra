// frontend/src/app/clientes/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { ClientOwnerItem, TaxpayerItem, TaxRegime, BillingFrequency } from '@/types/client';
import {
  ArrowLeft,
  Copy,
  Check,
  Edit2,
  Plus,
  Building2,
  User,
  Key,
  ShieldCheck,
  DollarSign,
  FileText,
  Phone,
  Sparkles,
  X,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Download,
  Upload,
  Calendar,
  Filter,
  MessageSquare,
  ExternalLink,
  Bot,
  UserCheck,
  ChevronRight,
  Image as ImageIcon,
  FileAudio,
  FileIcon,
  RefreshCw,
  Send,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REGIMEN_LABEL: Record<string, string> = {
  MENSUAL: 'Mensual',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
  COMPANIA_SUPERCIAS: 'Compañía Supercias',
  DEVOLUCION_IVA_3RA_EDAD: 'Dev. IVA 3ra Edad',
  INACTIVO_CERRADO: 'Inactivo / Cerrado',
};

const OBLIGACIONES = [
  { key: 'checkDecla', detalleKey: 'declaDetalle', label: 'DECLA' },
  { key: 'checkIva', detalleKey: 'ivaDetalle', label: 'IVA' },
  { key: 'checkIce', detalleKey: 'iceDetalle', label: 'ICE' },
  { key: 'checkAnexo', detalleKey: 'anexoDetalle', label: 'ANEXO' },
  { key: 'checkIess', detalleKey: 'iessDetalle', label: 'IESS' },
  { key: 'checkSut', detalleKey: 'sutDetalle', label: 'SUT' },
  { key: 'checkSalar', detalleKey: 'salarDetalle', label: 'SALAR' },
  { key: 'checkSupercias', detalleKey: 'superciasDetalle', label: 'SUPERCIAS' },
  { key: 'checkPatente', detalleKey: 'patenteDetalle', label: 'PATENTE' },
] as const;

type ObligacionCheckKey = typeof OBLIGACIONES[number]['key'];
type ObligacionDetalleKey = typeof OBLIGACIONES[number]['detalleKey'];

// ─── Tipos para el Chat ───────────────────────────────────────────────────────

interface ChatMessageItem {
  id: number;
  ticketId: number;
  sender: string;
  senderType: string; // CLIENT, BOT, HUMAN
  content: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  createdAt: string;
}

interface ChatTicketItem {
  id: number;
  whatsappPhone: string;
  queueType: string;
  subject: string;
  status: string;
  botPaused: boolean;
  assignedTo?: { id: number; fullName: string } | null;
  messages: ChatMessageItem[];
  createdAt: string;
  updatedAt: string;
}

function formatMoney(val: number | undefined | null): string {
  if (val == null) return '$0.00';
  return val.toLocaleString('es-EC', { style: 'currency', currency: 'USD' });
}

// ─── Tipos de estado del modal ────────────────────────────────────────────────

type EditModalTab = 'OWNER' | 'TAXPAYER' | 'NEW_TAXPAYER';

interface ChecksState {
  checkDecla: boolean;
  checkIva: boolean;
  checkIce: boolean;
  checkAnexo: boolean;
  checkIess: boolean;
  checkSut: boolean;
  checkSalar: boolean;
  checkSupercias: boolean;
  checkPatente: boolean;
}

interface DetallesState {
  declaDetalle: string;
  ivaDetalle: string;
  iceDetalle: string;
  anexoDetalle: string;
  iessDetalle: string;
  sutDetalle: string;
  salarDetalle: string;
  superciasDetalle: string;
  patenteDetalle: string;
}

// ─── Componentes estables fuera de ClientDetailView (evita perder foco al escribir) ───

interface TaxpayerFormFieldsProps {
  isAssistant: boolean;
  razonSocial: string;
  setRazonSocial: (v: string) => void;
  ruc: string;
  setRuc: (v: string) => void;
  regimen: TaxRegime;
  setRegimen: (v: TaxRegime) => void;
  email: string;
  setEmail: (v: string) => void;
  claveSri: string;
  setClaveSri: (v: string) => void;
  claveFirma: string;
  setClaveFirma: (v: string) => void;
  firmaExpira: string;
  setFirmaExpira: (v: string) => void;
  claveIess: string;
  setClaveIess: (v: string) => void;
  claveSut: string;
  setClaveSut: (v: string) => void;
  claveSalar: string;
  setClaveSalar: (v: string) => void;
  claveSupercias: string;
  setClaveSupercias: (v: string) => void;
  autoBillFreq: BillingFrequency;
  setAutoBillFreq: (v: BillingFrequency) => void;
  autoBillAmount: string;
  setAutoBillAmount: (v: string) => void;
  appliesVat: boolean;
  setAppliesVat: (v: boolean) => void;
  checks: ChecksState;
  setChecks: React.Dispatch<React.SetStateAction<ChecksState>>;
  details: DetallesState;
  setDetails: React.Dispatch<React.SetStateAction<DetallesState>>;
}

const ObligacionesForm = React.memo(function ObligacionesForm({
  checks,
  setChecks,
  details,
  setDetails,
}: {
  checks: ChecksState;
  setChecks: React.Dispatch<React.SetStateAction<ChecksState>>;
  details: DetallesState;
  setDetails: React.Dispatch<React.SetStateAction<DetallesState>>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {OBLIGACIONES.map(({ key, detalleKey, label }) => (
        <div key={key} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
          <input
            type="checkbox"
            id={`oblig-${key}`}
            checked={checks[key]}
            onChange={e => setChecks(prev => ({ ...prev, [key]: e.target.checked }))}
            className="w-4 h-4 rounded text-[#166BA3] accent-[#166BA3]"
          />
          <label htmlFor={`oblig-${key}`} className="text-xs font-bold text-slate-700 w-16 shrink-0">{label}</label>
          <input
            type="text"
            value={details[detalleKey]}
            onChange={e => setDetails(prev => ({ ...prev, [detalleKey]: e.target.value }))}
            placeholder="Valor / nota"
            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#166BA3] bg-white"
          />
        </div>
      ))}
    </div>
  );
});

const TaxpayerFormFields = React.memo(function TaxpayerFormFields({
  isAssistant,
  razonSocial, setRazonSocial,
  ruc, setRuc,
  regimen, setRegimen,
  email, setEmail,
  claveSri, setClaveSri,
  claveFirma, setClaveFirma,
  firmaExpira, setFirmaExpira,
  claveIess, setClaveIess,
  claveSut, setClaveSut,
  claveSalar, setClaveSalar,
  claveSupercias, setClaveSupercias,
  autoBillFreq, setAutoBillFreq,
  autoBillAmount, setAutoBillAmount,
  appliesVat, setAppliesVat,
  checks, setChecks,
  details, setDetails,
}: TaxpayerFormFieldsProps) {
  return (
    <div className="space-y-6">
      {/* Datos básicos */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" /> Datos Fiscales
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Razón Social *</label>
            <input
              type="text"
              value={razonSocial}
              onChange={e => setRazonSocial(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">RUC / Cédula</label>
            <input
              type="text"
              value={ruc}
              onChange={e => setRuc(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Régimen</label>
            <select
              value={regimen}
              onChange={e => setRegimen(e.target.value as TaxRegime)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
            >
              {Object.entries(REGIMEN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email Contribuyente</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
            />
          </div>
        </div>
      </div>

      {/* Claves */}
      {!isAssistant && (
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Key className="w-3.5 h-3.5" /> Claves Tributarias y Laborales
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Clave SRI', val: claveSri, set: setClaveSri },
              { label: 'Firma pt2', val: claveFirma, set: setClaveFirma },
              { label: 'IESS Patronal', val: claveIess, set: setClaveIess },
              { label: 'SUT (Ministerio)', val: claveSut, set: setClaveSut },
              { label: 'Salarios (SALAR)', val: claveSalar, set: setClaveSalar },
              { label: 'Supercias', val: claveSupercias, set: setClaveSupercias },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <input
                  type="text"
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Firma Electrónica Expira</label>
              <input
                type="date"
                value={firmaExpira}
                onChange={e => setFirmaExpira(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Obligaciones */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" /> Obligaciones Tributarias y Laborales
        </h3>
        <ObligacionesForm checks={checks} setChecks={setChecks} details={details} setDetails={setDetails} />
      </div>

      {/* Cobro — Solo ADMIN/COBRADOR */}
      {!isAssistant && (
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5" /> Condiciones de Cobro
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Frecuencia Facturación</label>
              <select
                value={autoBillFreq}
                onChange={e => setAutoBillFreq(e.target.value as BillingFrequency)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
              >
                <option value="NONE">Sin cobro automático</option>
                <option value="MENSUAL">Mensual</option>
                <option value="SEMESTRAL">Semestral</option>
                <option value="ANUAL">Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Honorario Base ($)</label>
              <input
                type="number"
                step="0.01"
                value={autoBillAmount}
                onChange={e => setAutoBillAmount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
              />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="appliesVatEdit"
                checked={appliesVat}
                onChange={e => setAppliesVat(e.target.checked)}
                className="w-4 h-4 accent-[#166BA3]"
              />
              <label htmlFor="appliesVatEdit" className="text-sm font-medium text-slate-700">Aplica IVA 15%</label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Componente principal ─────────────────────────────────────────────────────

function ClientDetailView() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const clientId = parseInt(params.id as string, 10);

  const isAssistant = user?.role === 'ASISTENTE';

  // ── Datos del cliente ─────────────────────────────────────────────────────
  const [client, setClient] = useState<ClientOwnerItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Empresa activa (seleccionada en pills) ─────────────────────────────────
  const [activeTaxpayerId, setActiveTaxpayerId] = useState<number | null>(null);

  // ── Sub-tab de la ficha ───────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<'FICHA' | 'BOVEDA' | 'CONTABILIDAD' | 'CHAT'>('FICHA');

  // ── Estado Chat ───────────────────────────────────────────────────────────
  const [chatTickets, setChatTickets] = useState<ChatTicketItem[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [clientReplyText, setClientReplyText] = useState('');
  const [sendingClientReply, setSendingClientReply] = useState(false);

  // ── Toast copiar clave ────────────────────────────────────────────────────
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Modal fullscreen de edición ──────────────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // ── Taxpayer seleccionado DENTRO del modal (para editar) ─────────────────
  const [editingTaxpayerId, setEditingTaxpayerId] = useState<number | null>(null);
  const [editModalTab, setEditModalTab] = useState<EditModalTab>('OWNER');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Formulario Tab 1: Titular (Owner) ────────────────────────────────────
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [ownerIsVip, setOwnerIsVip] = useState(false);
  const [ownerConsent, setOwnerConsent] = useState(false);
  const [ownerNotes, setOwnerNotes] = useState('');

  // ── Formulario Tab 2: Empresa activa (Taxpayer) ───────────────────────────
  const [editRazonSocial, setEditRazonSocial] = useState('');
  const [editRuc, setEditRuc] = useState('');
  const [editRegimen, setEditRegimen] = useState<TaxRegime>('MENSUAL');
  const [editEmail, setEditEmail] = useState('');
  const [editClaveSri, setEditClaveSri] = useState('');
  const [editClaveFirma, setEditClaveFirma] = useState('');
  const [editFirmaExpira, setEditFirmaExpira] = useState('');
  const [editClaveIess, setEditClaveIess] = useState('');
  const [editClaveSut, setEditClaveSut] = useState('');
  const [editClaveSalar, setEditClaveSalar] = useState('');
  const [editClaveSupercias, setEditClaveSupercias] = useState('');
  const [editExpSupercias, setEditExpSupercias] = useState('');
  const [editClaveSercop, setEditClaveSercop] = useState('');
  const [editAutoBillFreq, setEditAutoBillFreq] = useState<BillingFrequency>('MENSUAL');
  const [editAutoBillAmount, setEditAutoBillAmount] = useState('0.00');
  const [editAppliesVat, setEditAppliesVat] = useState(false);
  const [editChecks, setEditChecks] = useState<ChecksState>({
    checkDecla: false, checkIva: false, checkIce: false, checkAnexo: false,
    checkIess: false, checkSut: false, checkSalar: false, checkSupercias: false, checkPatente: false,
  });
  const [editDetails, setEditDetails] = useState<DetallesState>({
    declaDetalle: '', ivaDetalle: '', iceDetalle: '', anexoDetalle: '',
    iessDetalle: '', sutDetalle: '', salarDetalle: '', superciasDetalle: '', patenteDetalle: '',
  });

  // ── Formulario Tab 3: Nueva Razón Social ─────────────────────────────────
  const [newRazonSocial, setNewRazonSocial] = useState('');
  const [newRuc, setNewRuc] = useState('');
  const [newRegimen, setNewRegimen] = useState<TaxRegime>('MENSUAL');
  const [newEmail, setNewEmail] = useState('');
  const [newClaveSri, setNewClaveSri] = useState('');
  const [newClaveFirma, setNewClaveFirma] = useState('');
  const [newFirmaExpira, setNewFirmaExpira] = useState('');
  const [newClaveIess, setNewClaveIess] = useState('');
  const [newClaveSut, setNewClaveSut] = useState('');
  const [newClaveSalar, setNewClaveSalar] = useState('');
  const [newClaveSupercias, setNewClaveSupercias] = useState('');
  const [newAutoBillFreq, setNewAutoBillFreq] = useState<BillingFrequency>('MENSUAL');
  const [newAutoBillAmount, setNewAutoBillAmount] = useState('0.00');
  const [newAppliesVat, setNewAppliesVat] = useState(false);
  const [newChecks, setNewChecks] = useState<ChecksState>({
    checkDecla: true, checkIva: true, checkIce: false, checkAnexo: false,
    checkIess: false, checkSut: false, checkSalar: false, checkSupercias: false, checkPatente: false,
  });
  const [newDetails, setNewDetails] = useState<DetallesState>({
    declaDetalle: '', ivaDetalle: '', iceDetalle: '', anexoDetalle: '',
    iessDetalle: '', sutDetalle: '', salarDetalle: '', superciasDetalle: '', patenteDetalle: '',
  });

  // ─── Semáforo tributario ──────────────────────────────────────────────────
  const [taxAlert, setTaxAlert] = useState<{ estado: 'VERDE' | 'AMARILLO' | 'ROJO'; mensaje: string } | null>(null);

  // ─── Estado de la Bóveda Digital (Unificada por Cliente) ──────────────────
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultFilterCategory, setVaultFilterCategory] = useState<string>('ALL');
  const [vaultFilterTaxpayer, setVaultFilterTaxpayer] = useState<string>('ALL');
  const [vaultFilterYear, setVaultFilterYear] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState('');

  // ─── Estado de Contabilidad (Unificada por Cliente) ───────────────────────
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilterType, setLedgerFilterType] = useState<string>('ALL');
  const [ledgerFilterTaxpayer, setLedgerFilterTaxpayer] = useState<string>('ALL');

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers de copia
  // ─────────────────────────────────────────────────────────────────────────

  const handleCopy = (text: string | null | undefined, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch del cliente
  // ─────────────────────────────────────────────────────────────────────────

  const fetchClient = useCallback(async () => {
    if (!token || isNaN(clientId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al obtener cliente.');
      const c: ClientOwnerItem = data.data;
      setClient(c);
      if (c.taxpayers.length > 0 && activeTaxpayerId === null) {
        setActiveTaxpayerId(c.taxpayers[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, clientId]);

  // Semáforo
  const fetchTaxAlert = useCallback(async () => {
    if (!token || isNaN(clientId)) return;
    try {
      const res = await fetch('/api/clients/tax-alerts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.semaforo?.items) {
        const activeTp = client?.taxpayers.find(t => t.id === activeTaxpayerId);
        if (activeTp) {
          const item = data.semaforo.items.find((i: any) => i.taxpayerId === activeTp.id);
          if (item) setTaxAlert({ estado: item.estado, mensaje: item.mensaje });
        }
      }
    } catch { /* silencioso */ }
  }, [token, clientId, client, activeTaxpayerId]);

  // Historial de chat del cliente
  const fetchChatTickets = useCallback(async () => {
    if (!token || isNaN(clientId)) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch(`/api/whatsapp/client/${clientId}/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al cargar chats');
      setChatTickets(data.data || []);
      // Seleccionar automáticamente el primer ticket (el más reciente)
      if (data.data?.length > 0 && selectedTicketId === null) {
        setSelectedTicketId(data.data[0].id);
      }
    } catch (err: any) {
      setChatError(err.message);
    } finally {
      setChatLoading(false);
    }
  }, [token, clientId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  // Fetch de documentos de la Bóveda Digital (Unificada por Cliente)
  const fetchVaultDocuments = useCallback(async () => {
    if (!token || isNaN(clientId)) return;
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/documents/client/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDocuments(data.data || []);
      }
    } catch (err) {
      console.error('Error cargando documentos de la bóveda:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, [token, clientId]);

  useEffect(() => {
    if (token) {
      fetchClient();
      fetchVaultDocuments();
    }
  }, [token, fetchClient, fetchVaultDocuments]);

  useEffect(() => {
    if (client) fetchTaxAlert();
  }, [client, activeTaxpayerId]);

  // Cargar chats cuando se activa la pestaña CHAT
  useEffect(() => {
    if (activeSubTab === 'CHAT' && token) {
      fetchChatTickets();
    }
  }, [activeSubTab, token]);

  // ─────────────────────────────────────────────────────────────────────────
  // Empresa activa derivada
  // ─────────────────────────────────────────────────────────────────────────

  const activeTaxpayer = client?.taxpayers.find(t => t.id === activeTaxpayerId) ?? client?.taxpayers[0] ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // Abrir modal de edición
  // ─────────────────────────────────────────────────────────────────────────

  // Helper: prellenar formulario de edición con un taxpayer dado
  const fillEditForm = (tp: TaxpayerItem) => {
    setEditingTaxpayerId(tp.id);
    setEditRazonSocial(tp.razonSocial);
    setEditRuc(tp.ruc || '');
    setEditRegimen(tp.regimen);
    setEditEmail(tp.email || '');
    setEditClaveSri(tp.claveSri || '');
    setEditClaveFirma(tp.claveFirma || '');
    setEditFirmaExpira(tp.firmaExpira ? tp.firmaExpira.substring(0, 10) : '');
    setEditClaveIess(tp.claveIess || '');
    setEditClaveSut(tp.claveSut || '');
    setEditClaveSalar(tp.claveSalar || '');
    setEditClaveSupercias(tp.claveSupercias || '');
    setEditExpSupercias(tp.expSupercias || '');
    setEditClaveSercop(tp.claveSercop || '');
    setEditAutoBillFreq((tp.autoBillFreq as BillingFrequency) || 'MENSUAL');
    setEditAutoBillAmount(String(tp.autoBillAmount ?? '0.00'));
    setEditAppliesVat(tp.appliesVat ?? false);
    setEditChecks({
      checkDecla: tp.checkDecla, checkIva: tp.checkIva, checkIce: tp.checkIce,
      checkAnexo: tp.checkAnexo, checkIess: tp.checkIess, checkSut: tp.checkSut,
      checkSalar: tp.checkSalar, checkSupercias: tp.checkSupercias, checkPatente: tp.checkPatente,
    });
    setEditDetails({
      declaDetalle: tp.declaDetalle || '', ivaDetalle: tp.ivaDetalle || '',
      iceDetalle: tp.iceDetalle || '', anexoDetalle: tp.anexoDetalle || '',
      iessDetalle: tp.iessDetalle || '', sutDetalle: tp.sutDetalle || '',
      salarDetalle: tp.salarDetalle || '', superciasDetalle: tp.superciasDetalle || '',
      patenteDetalle: tp.patenteDetalle || '',
    });
  };

  const handleOpenEditModal = (initialTab: EditModalTab = 'OWNER') => {
    if (!client) return;
    setSaveError(null);

    // Prellenar Tab 1 (Owner)
    setOwnerName(client.fullName);
    setOwnerPhone(client.whatsappPhone);
    setOwnerPin(client.securityPin);
    setOwnerIsVip(client.isVip);
    setOwnerConsent(client.dataConsentSigned);
    setOwnerNotes(client.notes || '');

    // Prellenar Tab 2 con la empresa activa
    if (activeTaxpayer) {
      fillEditForm(activeTaxpayer);
    }

    // Limpiar Tab 3
    setNewRazonSocial(''); setNewRuc(''); setNewRegimen('MENSUAL'); setNewEmail('');
    setNewClaveSri(''); setNewClaveFirma(''); setNewFirmaExpira('');
    setNewClaveIess(''); setNewClaveSut(''); setNewClaveSalar(''); setNewClaveSupercias('');
    setNewAutoBillFreq('MENSUAL'); setNewAutoBillAmount('0.00'); setNewAppliesVat(false);
    setNewChecks({ checkDecla: true, checkIva: true, checkIce: false, checkAnexo: false, checkIess: false, checkSut: false, checkSalar: false, checkSupercias: false, checkPatente: false });
    setNewDetails({ declaDetalle: '', ivaDetalle: '', iceDetalle: '', anexoDetalle: '', iessDetalle: '', sutDetalle: '', salarDetalle: '', superciasDetalle: '', patenteDetalle: '' });

    setEditModalTab(initialTab);
    setIsEditModalOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Guardar Expediente (Tab 1 y 2)
  // ─────────────────────────────────────────────────────────────────────────

  const handleSaveFullProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !client) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Tab 1: actualizar Owner
      if (editModalTab === 'OWNER') {
        const res = await fetch(`/api/clients/${client.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            fullName: ownerName,
            whatsappPhone: ownerPhone,
            securityPin: ownerPin,
            isVip: ownerIsVip,
            dataConsentSigned: ownerConsent,
            notes: ownerNotes || null,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Error al guardar titular.');
      }

      // Tab 2: actualizar el taxpayer seleccionado en el modal
      if (editModalTab === 'TAXPAYER' && editingTaxpayerId) {
        const res = await fetch(`/api/clients/taxpayers/${editingTaxpayerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            razonSocial: editRazonSocial,
            ruc: editRuc || null,
            regimen: editRegimen,
            email: editEmail || null,
            claveSri: editClaveSri || null,
            claveFirma: editClaveFirma || null,
            firmaExpira: editFirmaExpira || null,
            claveIess: editClaveIess || null,
            claveSut: editClaveSut || null,
            claveSalar: editClaveSalar || null,
            claveSupercias: editClaveSupercias || null,
            expSupercias: editExpSupercias || null,
            claveSercop: editClaveSercop || null,
            ...editChecks,
            ...editDetails,
            autoBillFreq: editAutoBillFreq,
            autoBillAmount: parseFloat(editAutoBillAmount) || 0,
            appliesVat: editAppliesVat,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Error al guardar empresa.');
      }

      await fetchClient();
      setIsEditModalOpen(false);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Crear Nueva Razón Social (Tab 3)
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreateTaxpayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !client) return;
    if (!newRazonSocial.trim()) { setSaveError('La razón social es obligatoria.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/taxpayers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          razonSocial: newRazonSocial.trim(),
          ruc: newRuc || null,
          regimen: newRegimen,
          email: newEmail || null,
          claveSri: newClaveSri || null,
          claveFirma: newClaveFirma || null,
          firmaExpira: newFirmaExpira || null,
          claveIess: newClaveIess || null,
          claveSut: newClaveSut || null,
          claveSalar: newClaveSalar || null,
          claveSupercias: newClaveSupercias || null,
          ...newChecks,
          ...newDetails,
          autoBillFreq: newAutoBillFreq,
          autoBillAmount: parseFloat(newAutoBillAmount) || 0,
          appliesVat: newAppliesVat,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al crear empresa.');
      await fetchClient();
      setActiveTaxpayerId(data.data.id);
      setIsEditModalOpen(false);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#166BA3]" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-slate-700 font-medium">{error || 'Cliente no encontrado.'}</p>
        <button onClick={() => router.push('/clientes')} className="text-[#166BA3] underline text-sm">Volver al directorio</button>
      </div>
    );
  }

  const saldo = client.saldoPendienteTotal ?? 0;
  const saldoNegativo = saldo < 0;

  // ─── Semáforo badge ───────────────────────────────────────────────────────
  const semBadge = taxAlert
    ? taxAlert.estado === 'ROJO'
      ? { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="w-3 h-3" />, label: 'Urgente' }
      : taxAlert.estado === 'AMARILLO'
      ? { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-3 h-3" />, label: 'Próximo' }
      : { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Al día' }
    : null;

  // ─── Helper: campo de clave copiable ─────────────────────────────────────
  const ClaveField = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-mono font-semibold mt-0.5 ${value ? 'text-slate-800' : 'text-slate-400 italic'}`}>
          {value || 'No registrada'}
        </p>
      </div>
      {value && (
        <button
          onClick={() => handleCopy(value, label)}
          className="flex-shrink-0 p-1.5 rounded hover:bg-slate-100 transition-colors"
          title={`Copiar ${label}`}
        >
          {copiedKey === label ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
        </button>
      )}
    </div>
  );

  // ─── Helper: campo de dato simple ────────────────────────────────────────
  const DataField = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value || <span className="text-slate-400 italic font-normal">—</span>}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:pl-64">
      <Navbar />

      {/* Toast de copia */}
      {copiedKey && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-pulse">
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span>Copiado: <strong>{copiedKey}</strong></span>
        </div>
      )}

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-4">

        {/* Breadcrumb */}
        <button onClick={() => router.push('/clientes')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#166BA3] transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Volver al Directorio
        </button>

        {/* ── HEADER DEL CLIENTE ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Avatar + Info */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#166BA3] to-[#1E2A3C] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                {client.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-[#1E2A3C]">{client.fullName}</h1>
                  {client.isVip && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                      <Sparkles className="w-3 h-3" /> VIP
                    </span>
                  )}
                  {semBadge && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${semBadge.bg} ${semBadge.text}`}>
                      {semBadge.icon} {semBadge.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {client.whatsappPhone}</span>
                  {!isAssistant && (
                    <span className="flex items-center gap-1"><Key className="w-3.5 h-3.5" /> PIN: <span className="font-mono font-bold text-slate-800">{client.securityPin}</span></span>
                  )}
                  <span className="text-slate-400">• {client.taxpayers.length} empresa(s)</span>
                </div>
              </div>
            </div>

            {/* Saldo + Acciones */}
            <div className="flex items-center gap-3 flex-wrap">
              {!isAssistant && (
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Saldo Pendiente</p>
                  <p className={`text-2xl font-black ${saldoNegativo ? 'text-red-600' : 'text-green-600'}`}>
                    {formatMoney(saldo)}
                  </p>
                </div>
              )}
              <button
                onClick={() => handleOpenEditModal('OWNER')}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#166BA3] text-white text-sm font-semibold rounded-lg hover:bg-[#1259894] transition-colors shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar Todo
              </button>
            </div>
          </div>

          {/* Pills de empresas */}
          {client.taxpayers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 font-medium mr-1">Razón Social activa:</span>
                {client.taxpayers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTaxpayerId(t.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      activeTaxpayerId === t.id
                        ? 'bg-[#166BA3] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t.razonSocial}
                  </button>
                ))}
                <button
                  onClick={() => handleOpenEditModal('NEW_TAXPAYER')}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-1 border border-dashed border-slate-300"
                >
                  <Plus className="w-3 h-3" /> RUC
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── BARRA DE SUB-TABS Y BUSCADOR GENERAL DEL CLIENTE ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Sub-Tabs */}
          <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1 w-fit">
            {[
              { key: 'FICHA', label: 'Ficha Técnica', icon: <FileText className="w-3.5 h-3.5" /> },
              { key: 'BOVEDA', label: 'Bóveda Digital', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
              ...(!isAssistant
                ? [{ key: 'CONTABILIDAD', label: 'Contabilidad', icon: <DollarSign className="w-3.5 h-3.5" /> }]
                : []),
              { key: 'CHAT', label: 'Chat WhatsApp', icon: <MessageSquare className="w-3.5 h-3.5" /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSubTab === tab.key
                    ? 'bg-[#166BA3] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Buscador Rápido del Cliente (conecta con Bóveda y Contabilidad) */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={e => {
                const val = e.target.value;
                setGlobalSearch(val);
                setVaultSearch(val);
                setLedgerSearch(val);
              }}
              placeholder="Buscar en expediente / bóveda..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]/40"
            />
            {globalSearch && (
              <button
                onClick={() => {
                  setGlobalSearch('');
                  setVaultSearch('');
                  setLedgerSearch('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── CONTENIDO SUB-TAB ── */}
        {activeSubTab === 'FICHA' && activeTaxpayer && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">

            {/* Columna izquierda: Datos fiscales + Obligaciones */}
            <div className="lg:col-span-7 flex flex-col gap-4">

              {/* Empresa header */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-[#166BA3]" />
                  <h2 className="text-base font-bold text-[#1E2A3C]">{activeTaxpayer.razonSocial}</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DataField label="RUC" value={activeTaxpayer.ruc} />
                  <DataField label="Fecha Declaración" value={activeTaxpayer.fechaDecla} />
                  <DataField label="Régimen" value={REGIMEN_LABEL[activeTaxpayer.regimen] || activeTaxpayer.regimen} />
                  <DataField label="Email Contribuyente" value={activeTaxpayer.email} />
                </div>
              </div>

              {/* Condiciones de cobro */}
              {!isAssistant && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Condiciones de Cobro y Cartera</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Frecuencia</p>
                      <p className="text-sm font-bold text-slate-800">{activeTaxpayer.autoBillFreq || 'NONE'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Honorario Base</p>
                      <p className="text-sm font-bold text-slate-800">{formatMoney(activeTaxpayer.autoBillAmount)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Aplica IVA 15%</p>
                      <p className="text-sm font-bold text-slate-800">{activeTaxpayer.appliesVat ? 'Sí' : 'No'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Obligaciones */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Obligaciones Tributarias y Laborales
                </h3>
                <p className="text-xs text-slate-400 mb-3">Estado y valores asignados (modificables desde "Editar Todo")</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OBLIGACIONES.map(({ key, detalleKey, label }) => {
                    const checked = activeTaxpayer[key as keyof TaxpayerItem] as boolean;
                    const detalle = activeTaxpayer[detalleKey as keyof TaxpayerItem] as string | null;
                    return (
                      <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${checked ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${checked ? 'bg-[#166BA3]' : 'bg-slate-300'}`} />
                        <span className={`text-xs font-bold w-20 ${checked ? 'text-[#166BA3]' : 'text-slate-400'}`}>{label}</span>
                        {detalle && <span className="text-xs text-slate-700 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{detalle}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Columna derecha: Claves */}
            {!isAssistant && (
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Key className="w-3.5 h-3.5" /> Claves Tributarias, Laborales y Entidades
                  </h3>
                  <ClaveField label="SRI" value={activeTaxpayer.claveSri} />
                  <ClaveField label="Firma pt2" value={activeTaxpayer.claveFirma} />
                  <ClaveField label="IESS Patronal" value={activeTaxpayer.claveIess} />
                  <ClaveField label="SUT (Ministerio)" value={activeTaxpayer.claveSut} />
                  <ClaveField label="Salarios (SALAR)" value={activeTaxpayer.claveSalar} />
                  <ClaveField label="Supercias" value={activeTaxpayer.claveSupercias} />
                  {activeTaxpayer.expSupercias && (
                    <div className="py-2">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Exp. Supercias</p>
                      <p className="text-sm font-mono font-semibold text-slate-800">{activeTaxpayer.expSupercias}</p>
                    </div>
                  )}
                  <ClaveField label="SERCOP" value={activeTaxpayer.claveSercop} />
                  {activeTaxpayer.firmaExpira && (
                    <div className="py-2 border-t border-slate-100 mt-1">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Firma Electrónica Expira</p>
                      <p className="text-sm font-semibold text-slate-800">{new Date(activeTaxpayer.firmaExpira).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  )}
                </div>

                {/* Notas del titular */}
                {client.notes && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Notas del Titular</h3>
                    <p className="text-sm text-amber-800">{client.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CONTENIDO SUB-TAB: BÓVEDA DIGITAL (COMPARTIDA POR TODAS LAS RAZONES SOCIALES) ── */}
        {activeSubTab === 'BOVEDA' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
            {/* Header de la Bóveda */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#166BA3]" />
                  <h2 className="text-lg font-bold text-[#1E2A3C]">Bóveda Digital Unificada</h2>
                  <span className="text-xs bg-blue-100 text-[#166BA3] font-semibold px-2 py-0.5 rounded-full">
                    Expediente completo del Cliente
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Repositorio compartido de documentos, declaraciones, anexos y contratos de todas las razones sociales vinculadas a {client.fullName}.
                </p>
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{client.taxpayers.length} empresa(s) vinculadas</span>
              </div>
            </div>

            {/* Barra de Búsqueda Inteligente y Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={e => setVaultSearch(e.target.value)}
                  placeholder="Buscador inteligente: nombre, tipo, razón social, RUC..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3] bg-slate-50/50"
                />
              </div>

              <div className="md:col-span-3">
                <select
                  value={vaultFilterTaxpayer}
                  onChange={e => setVaultFilterTaxpayer(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3] bg-slate-50/50 text-slate-700"
                >
                  <option value="ALL">Todas las Razones Sociales ({client.taxpayers.length})</option>
                  {client.taxpayers.map(t => (
                    <option key={t.id} value={String(t.id)}>{t.razonSocial}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={vaultFilterCategory}
                  onChange={e => setVaultFilterCategory(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3] bg-slate-50/50 text-slate-700"
                >
                  <option value="ALL">Categoría: Todas</option>
                  <option value="DECLARACION_IVA">Declaración IVA</option>
                  <option value="DECLARACION_RENTA">Declaración Renta</option>
                  <option value="ANEXO_ATS">Anexo ATS</option>
                  <option value="DECLARACION_ICE">Declaración ICE</option>
                  <option value="SUPERCIAS_ESTADOS">Supercias</option>
                  <option value="RUC_CERTIFICADO">Certificado RUC</option>
                  <option value="NOMBRAMIENTO_ESCRITURA">Nombramiento / Escritura</option>
                  <option value="PLANILLA_IESS_SUT">IESS / SUT</option>
                  <option value="FACTURA_EMITIDA">Factura</option>
                  <option value="FIRMA_ELECTRONICA_P12">Firma .p12</option>
                  <option value="OTRO_DOCUMENTO">Otro Documento</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={vaultFilterYear}
                  onChange={e => setVaultFilterYear(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3] bg-slate-50/50 text-slate-700"
                >
                  <option value="ALL">Año: Todos</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                </select>
              </div>
            </div>

            {/* Listado de Documentos */}
            {loadingDocs ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-[#166BA3]" />
                <p className="text-xs">Consultando Bóveda Digital...</p>
              </div>
            ) : (() => {
              const filteredDocs = documents.filter(doc => {
                const q = vaultSearch.toLowerCase().trim();
                const matchQuery =
                  !q ||
                  doc.title?.toLowerCase().includes(q) ||
                  doc.category?.toLowerCase().includes(q) ||
                  doc.fileType?.toLowerCase().includes(q) ||
                  doc.taxpayer?.razonSocial?.toLowerCase().includes(q) ||
                  doc.taxpayer?.ruc?.toLowerCase().includes(q);

                const matchTaxpayer =
                  vaultFilterTaxpayer === 'ALL' ||
                  String(doc.taxpayerId) === vaultFilterTaxpayer;

                const matchCategory =
                  vaultFilterCategory === 'ALL' ||
                  doc.category === vaultFilterCategory;

                const matchYear =
                  vaultFilterYear === 'ALL' ||
                  String(doc.periodYear) === vaultFilterYear;

                return matchQuery && matchTaxpayer && matchCategory && matchYear;
              });

              if (filteredDocs.length === 0) {
                return (
                  <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <ShieldCheck className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">
                      {documents.length === 0
                        ? 'Aún no hay documentos en la Bóveda Digital de este cliente'
                        : 'No se encontraron documentos con los filtros aplicados'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-md">
                      Los archivos que subas en cualquiera de las razones sociales de este cliente aparecerán centralizados aquí.
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-3 px-4">Documento / Título</th>
                        <th className="py-3 px-4">Razón Social / RUC</th>
                        <th className="py-3 px-4">Categoría</th>
                        <th className="py-3 px-4">Periodo</th>
                        <th className="py-3 px-4">Fecha Subida</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDocs.map(doc => (
                        <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#166BA3] flex-shrink-0" />
                            <span className="truncate max-w-[220px]" title={doc.title}>{doc.title}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <span className="font-semibold block">{doc.taxpayer?.razonSocial || '—'}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{doc.taxpayer?.ruc || ''}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                              {doc.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {doc.periodMonth ? `${doc.periodMonth}/` : ''}{doc.periodYear}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-xs">
                            {new Date(doc.createdAt).toLocaleDateString('es-EC')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <a
                              href={doc.bunnyUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#166BA3] text-white text-xs font-semibold rounded-lg hover:bg-[#125989] transition-colors"
                            >
                              <Download className="w-3 h-3" /> Descargar
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── CONTENIDO SUB-TAB: CONTABILIDAD (COMPARTIDA / BOLSA DE DEUDA POR CLIENTE) ── */}
        {!isAssistant && activeSubTab === 'CONTABILIDAD' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
            {/* Header Contabilidad */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-[#1E2A3C]">Contabilidad y Cuenta Corriente Unificada</h2>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    Bolsa de Deuda Única del Cliente
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Movimientos consolidados, cargos mensuales y abonos de todas las razones sociales asociadas al pagador {client.fullName}.
                </p>
              </div>

              {!isAssistant && (
                <div className="text-right bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Saldo Global Pendiente</p>
                  <p className={`text-xl font-black ${saldoNegativo ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatMoney(saldo)}
                  </p>
                </div>
              )}
            </div>

            {/* Barra de Filtros de Contabilidad */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  placeholder="Buscar movimiento: concepto, periodo, banco..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3] bg-slate-50/50"
                />
              </div>

              <div className="md:col-span-3">
                <select
                  value={ledgerFilterTaxpayer}
                  onChange={e => setLedgerFilterTaxpayer(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3] bg-slate-50/50 text-slate-700"
                >
                  <option value="ALL">Todas las Razones Sociales ({client.taxpayers.length})</option>
                  {client.taxpayers.map(t => (
                    <option key={t.id} value={String(t.id)}>{t.razonSocial}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  value={ledgerFilterType}
                  onChange={e => setLedgerFilterType(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3] bg-slate-50/50 text-slate-700"
                >
                  <option value="ALL">Todos los Movimientos</option>
                  <option value="CARGO">Solo Cargos / Honorarios</option>
                  <option value="ABONO_PAGO">Solo Abonos / Pagos</option>
                  <option value="DESCUENTO_CRUCE">Descuentos / Cruces</option>
                </select>
              </div>
            </div>

            {/* Tabla de Movimientos */}
            {(() => {
              const ledgerEntries = (client as any).ledgerEntries || [];

              const filteredLedger = ledgerEntries.filter((item: any) => {
                const q = ledgerSearch.toLowerCase().trim();
                const matchQuery =
                  !q ||
                  item.concept?.toLowerCase().includes(q) ||
                  item.periodText?.toLowerCase().includes(q) ||
                  item.bankAccount?.toLowerCase().includes(q);

                const matchTaxpayer =
                  ledgerFilterTaxpayer === 'ALL' ||
                  String(item.taxpayerId) === ledgerFilterTaxpayer;

                const matchType =
                  ledgerFilterType === 'ALL' ||
                  (ledgerFilterType === 'CARGO'
                    ? item.entryType === 'CARGO_AUTOMATICO' || item.entryType === 'CARGO_MANUAL' || item.entryType === 'CARGO_COMISION_DEV'
                    : item.entryType === ledgerFilterType);

                return matchQuery && matchTaxpayer && matchType;
              });

              if (filteredLedger.length === 0) {
                return (
                  <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <DollarSign className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No hay movimientos registrados</p>
                    <p className="text-xs text-slate-400 max-w-md">
                      Los cobros automáticos mensuales, cargos manuales y pagos realizados por este cliente se registrarán en esta cuenta corriente única.
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Concepto</th>
                        <th className="py-3 px-4">Periodo</th>
                        <th className="py-3 px-4">Banco / Cuenta</th>
                        <th className="py-3 px-4 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLedger.map((e: any) => {
                        const isPayment = e.entryType === 'ABONO_PAGO' || e.entryType === 'DESCUENTO_CRUCE';
                        return (
                          <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(e.entryDate).toLocaleDateString('es-EC')}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                isPayment ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {isPayment ? 'ABONO' : 'CARGO'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{e.concept}</td>
                            <td className="py-3 px-4 text-slate-500 font-mono text-xs">{e.periodText || '—'}</td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-xs">{e.bankAccount || 'NO_APLICA'}</td>
                            <td className={`py-3 px-4 text-right font-bold font-mono ${
                              isPayment ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isPayment ? '-' : '+'}{formatMoney(Number(e.amount))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── SUB-TAB: CHAT DE WHATSAPP CON EL CLIENTE ── */}
        {activeSubTab === 'CHAT' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[550px]">
            {/* Header del módulo Chat */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#1E2A3C] flex items-center gap-2">
                    Historial de Conversaciones WhatsApp
                    <span className="text-[11px] font-normal text-slate-500 font-mono">({client.whatsappPhone})</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Mensajes intercambiados por WhatsApp entre el cliente, el bot de IA y el equipo contable.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchChatTickets()}
                  disabled={chatLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
                  title="Refrescar mensajes"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${chatLoading ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
                <button
                  onClick={() => router.push(`/whatsapp`)}
                  className="px-3 py-1.5 rounded-lg bg-[#166BA3] text-white hover:bg-[#125984] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ir al Centro WhatsApp
                </button>
              </div>
            </div>

            {/* Contenedor Split: Tickets a la izquierda (si hay más de 1) + Mensajes a la derecha */}
            {chatLoading && chatTickets.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#166BA3]" />
                  <p className="text-xs">Cargando conversaciones del cliente...</p>
                </div>
              </div>
            ) : chatError ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">{chatError}</p>
                <button
                  onClick={() => fetchChatTickets()}
                  className="mt-3 text-xs text-[#166BA3] underline font-semibold"
                >
                  Intentar nuevamente
                </button>
              </div>
            ) : chatTickets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Sin mensajes registrados aún</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Cuando este cliente escriba al WhatsApp oficial o el bot le envíe avisos/cobranza, todo el historial aparecerá registrado aquí.
                  </p>
                </div>
                <button
                  onClick={() => router.push('/whatsapp')}
                  className="mt-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#166BA3]" /> Abrir Centro WhatsApp
                </button>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* Panel de Tickets (3 cols) */}
                <div className="md:col-span-4 bg-slate-50/50 p-3 space-y-2 max-h-[600px] overflow-y-auto">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
                    Tickets ({chatTickets.length})
                  </p>
                  {chatTickets.map((t) => {
                    const isSelected = selectedTicketId === t.id;
                    const lastMsg = t.messages[t.messages.length - 1];
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicketId(t.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-white border-[#166BA3] shadow-sm ring-1 ring-[#166BA3]'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] font-bold text-slate-800">
                            Ticket #{t.id}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            t.status === 'ABIERTO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1 font-medium">
                          {t.subject || 'Consulta general'}
                        </p>
                        {lastMsg && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                            <span className="font-semibold text-slate-500">
                              {lastMsg.senderType === 'CLIENT' ? 'Cliente: ' : lastMsg.senderType === 'BOT' ? 'Bot: ' : 'Mayra: '}
                            </span>
                            {lastMsg.content}
                          </p>
                        )}
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{t.messages.length} mensajes</span>
                          <span>{new Date(t.updatedAt).toLocaleDateString('es-EC')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Panel de Conversación (8 cols) */}
                <div className="md:col-span-8 flex flex-col bg-slate-50/30">
                  {(() => {
                    const activeTicket = chatTickets.find(t => t.id === selectedTicketId) || chatTickets[0];
                    if (!activeTicket) return null;

                    return (
                      <>
                        {/* Cabecera del ticket activo */}
                        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                Ticket #{activeTicket.id}: {activeTicket.subject}
                              </span>
                              {activeTicket.botPaused ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                                  <UserCheck className="w-3 h-3" /> Humano al mando
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                                  <Bot className="w-3 h-3" /> Bot Activo
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Cola: {activeTicket.queueType} · Iniciado {new Date(activeTicket.createdAt).toLocaleDateString('es-EC')}
                            </span>
                          </div>

                          <button
                            onClick={() => router.push('/whatsapp')}
                            className="text-xs font-semibold text-[#166BA3] hover:underline flex items-center gap-1"
                          >
                            Responder en vivo <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Mensajes del Ticket */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[500px]">
                          {activeTicket.messages.map((m) => {
                            const isClient = m.senderType === 'CLIENT';
                            const isBot = m.senderType === 'BOT';

                            return (
                              <div
                                key={m.id}
                                className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}
                              >
                                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 px-1">
                                  {isClient ? (
                                    <span className="font-semibold text-slate-600">{client.fullName}</span>
                                  ) : isBot ? (
                                    <span className="font-semibold text-blue-600 flex items-center gap-1">
                                      <Bot className="w-3 h-3" /> Bot Mayra
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-emerald-600 flex items-center gap-1">
                                      <UserCheck className="w-3 h-3" /> Equipo Contable
                                    </span>
                                  )}
                                  <span>·</span>
                                  <span>{new Date(m.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>

                                <div
                                  className={`rounded-2xl px-4 py-2.5 max-w-[85%] sm:max-w-[70%] text-xs shadow-sm ${
                                    isClient
                                      ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                                      : isBot
                                      ? 'bg-blue-600 text-white rounded-tr-sm'
                                      : 'bg-emerald-600 text-white rounded-tr-sm'
                                  }`}
                                >
                                  {/* Renderizado Multimedia */}
                                  {m.mediaType === 'AUDIO' && m.mediaUrl && (
                                    <div className="mb-2">
                                      <audio controls src={m.mediaUrl} className="w-full max-w-[240px] h-8" />
                                    </div>
                                  )}
                                  {m.mediaType === 'IMAGE' && m.mediaUrl && (
                                    <div className="mb-2 rounded-lg overflow-hidden border border-black/10">
                                      <img src={m.mediaUrl} alt="Foto" className="max-h-60 w-auto object-contain" />
                                    </div>
                                  )}
                                  {m.mediaType === 'DOCUMENT' && m.mediaUrl && (
                                    <a
                                      href={m.mediaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2 rounded-lg bg-black/10 hover:bg-black/20 transition-colors mb-2"
                                    >
                                      <FileIcon className="w-4 h-4 shrink-0" />
                                      <span className="underline truncate text-[11px] font-semibold">{m.fileName || 'Descargar Documento PDF'}</span>
                                    </a>
                                  )}

                                  {/* Texto */}
                                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Input para responder directo desde la ficha */}
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!token || !client?.whatsappPhone || !clientReplyText.trim() || sendingClientReply) return;
                            const textToSend = clientReplyText.trim();
                            setSendingClientReply(true);
                            setClientReplyText('');

                            try {
                              const res = await fetch('/api/whatsapp/send-reply', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  phone: client.whatsappPhone,
                                  message: textToSend,
                                  ticketId: activeTicket.id,
                                }),
                              });
                              if (res.ok) {
                                await fetchChatTickets();
                              }
                            } catch (err) {
                              console.error('Error enviando mensaje desde ficha:', err);
                            } finally {
                              setSendingClientReply(false);
                            }
                          }}
                          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={clientReplyText}
                            onChange={(e) => setClientReplyText(e.target.value)}
                            placeholder={`Enviar mensaje de WhatsApp a ${client.fullName}...`}
                            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#166BA3] focus:border-[#166BA3]"
                          />
                          <button
                            type="submit"
                            disabled={sendingClientReply || !clientReplyText.trim()}
                            className="bg-[#166BA3] text-white px-3.5 py-2 rounded-xl hover:bg-[#135887] active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar</span>
                          </button>
                        </form>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL FULLSCREEN — EDITAR EXPEDIENTE COMPLETO
      ════════════════════════════════════════════════════════════════════ */}
      {isEditModalOpen && (
        /* Backdrop con margen — se ve como popup, no fullscreen */
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 px-3 md:px-6 md:pt-6 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setIsEditModalOpen(false); }}
        >
          <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">

            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#1E2A3C] text-white flex-shrink-0 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Edit2 className="w-5 h-5 text-blue-300" />
                <div>
                  <h2 className="text-base font-bold">Editar Expediente Completo</h2>
                  <p className="text-xs text-slate-300">{client.fullName}</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs del modal — Titular + cada Razón Social + Nueva */}
            <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0 overflow-x-auto">
              {/* Tab Titular */}
              <button
                onClick={() => { setSaveError(null); setEditModalTab('OWNER'); }}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                  editModalTab === 'OWNER'
                    ? 'border-[#166BA3] text-[#166BA3] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Titular
              </button>

              {/* Tab por cada Razón Social existente */}
              {client.taxpayers.map(tp => (
                <button
                  key={tp.id}
                  onClick={() => {
                    setSaveError(null);
                    setEditModalTab('TAXPAYER');
                    fillEditForm(tp);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                    editModalTab === 'TAXPAYER' && editingTaxpayerId === tp.id
                      ? 'border-[#166BA3] text-[#166BA3] bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="max-w-[140px] truncate">{tp.razonSocial}</span>
                </button>
              ))}

              {/* Tab Nueva Razón Social */}
              <button
                onClick={() => { setSaveError(null); setEditModalTab('NEW_TAXPAYER'); }}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                  editModalTab === 'NEW_TAXPAYER'
                    ? 'border-green-500 text-green-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Nueva Razón Social
              </button>
            </div>

            {/* Error banner */}
            {saveError && (
              <div className="flex items-center gap-2 px-6 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm flex-shrink-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
              </div>
            )}

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-6 py-6">

              {/* TAB 1: TITULAR */}
              {editModalTab === 'OWNER' && (
                <form id="modalOwnerForm" onSubmit={handleSaveFullProfile}>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> Datos del Titular Pagador
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo *</label>
                          <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} required
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp *</label>
                          <input type="text" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166BA3]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">PIN de Seguridad (4 dígitos)</label>
                          <input type="text" maxLength={4} value={ownerPin} onChange={e => setOwnerPin(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166BA3]" />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={ownerIsVip} onChange={e => setOwnerIsVip(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                            <span className="text-sm font-medium text-slate-700">Cliente VIP</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={ownerConsent} onChange={e => setOwnerConsent(e.target.checked)} className="w-4 h-4 accent-[#166BA3]" />
                            <span className="text-sm font-medium text-slate-700">Consentimiento firmado</span>
                          </label>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Notas internas</label>
                          <textarea rows={3} value={ownerNotes} onChange={e => setOwnerNotes(e.target.value)}
                            placeholder="Observaciones sobre el cliente..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3] resize-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB 2: EMPRESA ACTIVA */}
              {editModalTab === 'TAXPAYER' && (
                <form id="modalTaxpayerForm" onSubmit={handleSaveFullProfile}>
                  <TaxpayerFormFields
                    isAssistant={isAssistant}
                    razonSocial={editRazonSocial} setRazonSocial={setEditRazonSocial}
                    ruc={editRuc} setRuc={setEditRuc}
                    regimen={editRegimen} setRegimen={setEditRegimen}
                    email={editEmail} setEmail={setEditEmail}
                    claveSri={editClaveSri} setClaveSri={setEditClaveSri}
                    claveFirma={editClaveFirma} setClaveFirma={setEditClaveFirma}
                    firmaExpira={editFirmaExpira} setFirmaExpira={setEditFirmaExpira}
                    claveIess={editClaveIess} setClaveIess={setEditClaveIess}
                    claveSut={editClaveSut} setClaveSut={setEditClaveSut}
                    claveSalar={editClaveSalar} setClaveSalar={setEditClaveSalar}
                    claveSupercias={editClaveSupercias} setClaveSupercias={setEditClaveSupercias}
                    autoBillFreq={editAutoBillFreq} setAutoBillFreq={setEditAutoBillFreq}
                    autoBillAmount={editAutoBillAmount} setAutoBillAmount={setEditAutoBillAmount}
                    appliesVat={editAppliesVat} setAppliesVat={setEditAppliesVat}
                    checks={editChecks} setChecks={setEditChecks}
                    details={editDetails} setDetails={setEditDetails}
                  />
                </form>
              )}

              {/* TAB 3: NUEVA RAZÓN SOCIAL */}
              {editModalTab === 'NEW_TAXPAYER' && (
                <form id="modalNewTaxForm" onSubmit={handleCreateTaxpayer}>
                  <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">
                      Se creará una nueva empresa/RUC vinculada al titular <strong>{client.fullName}</strong>.
                    </p>
                  </div>
                  <TaxpayerFormFields
                    isAssistant={isAssistant}
                    razonSocial={newRazonSocial} setRazonSocial={setNewRazonSocial}
                    ruc={newRuc} setRuc={setNewRuc}
                    regimen={newRegimen} setRegimen={setNewRegimen}
                    email={newEmail} setEmail={setNewEmail}
                    claveSri={newClaveSri} setClaveSri={setNewClaveSri}
                    claveFirma={newClaveFirma} setClaveFirma={setNewClaveFirma}
                    firmaExpira={newFirmaExpira} setFirmaExpira={setNewFirmaExpira}
                    claveIess={newClaveIess} setClaveIess={setNewClaveIess}
                    claveSut={newClaveSut} setClaveSut={setNewClaveSut}
                    claveSalar={newClaveSalar} setClaveSalar={setNewClaveSalar}
                    claveSupercias={newClaveSupercias} setClaveSupercias={setNewClaveSupercias}
                    autoBillFreq={newAutoBillFreq} setAutoBillFreq={setNewAutoBillFreq}
                    autoBillAmount={newAutoBillAmount} setAutoBillAmount={setNewAutoBillAmount}
                    appliesVat={newAppliesVat} setAppliesVat={setNewAppliesVat}
                    checks={newChecks} setChecks={setNewChecks}
                    details={newDetails} setDetails={setNewDetails}
                  />
                </form>
              )}
            </div>
          </div>

          {/* Footer fijo del modal */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={
                editModalTab === 'OWNER' ? 'modalOwnerForm'
                : editModalTab === 'TAXPAYER' ? 'modalTaxpayerForm'
                : 'modalNewTaxForm'
              }
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg text-white transition-all shadow-sm disabled:opacity-50 ${
                editModalTab === 'NEW_TAXPAYER' ? 'bg-green-600 hover:bg-green-700' : 'bg-[#166BA3] hover:bg-[#125989]'
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editModalTab === 'NEW_TAXPAYER' ? 'Guardar Nueva Empresa' : 'Guardar Expediente'}
            </button>
          </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ClientDetailPage() {
  return <ClientDetailView />;
}
