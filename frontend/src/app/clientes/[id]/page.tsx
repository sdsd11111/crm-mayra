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

type EditModalTab = 'OWNER' | 'TAXPAYER' | 'NEW_TAXPAYER' | 'COBROS';

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
  claveSercop: string;
  setClaveSercop: (v: string) => void;
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
  billServices?: Array<{ id: string; concepto: string; monto: string; freq?: string }>;
  setBillServices?: React.Dispatch<React.SetStateAction<Array<{ id: string; concepto: string; monto: string; freq?: string }>>>;
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
  claveSercop, setClaveSercop,
  autoBillFreq, setAutoBillFreq,
  autoBillAmount, setAutoBillAmount,
  appliesVat, setAppliesVat,
  checks, setChecks,
  details, setDetails,
  billServices, setBillServices,
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
              { label: 'SERCOP', val: claveSercop, set: setClaveSercop },
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
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-[#166BA3]" /> Regla de Cobro de Cartera y Servicios
            </h3>
            {setBillServices && (
              <button
                type="button"
                onClick={() =>
                  setBillServices((prev) => [
                    ...prev,
                    { id: Date.now().toString(), concepto: '', monto: '0.00' },
                  ])
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#166BA3] text-white text-xs font-semibold hover:bg-[#135887] shadow-xs active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Servicio
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Frecuencia Facturación</label>
              <select
                value={autoBillFreq}
                onChange={e => setAutoBillFreq(e.target.value as BillingFrequency)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
              >
                <option value="NONE">Sin cobro automático</option>
                <option value="MENSUAL">Mensual</option>
                <option value="SEMESTRAL">Semestral</option>
                <option value="ANUAL">Anual</option>
              </select>
            </div>
          </div>

          {/* Desglose de servicios dinámicos con botón + */}
          {billServices && setBillServices ? (
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Servicios y Honorarios Divididos:
              </div>
              {billServices.map((service, index) => (
                <div key={service.id} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Servicio #{index + 1}
                    </label>
                    <input
                      type="text"
                      value={service.concepto}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBillServices((prev) =>
                          prev.map((s) => (s.id === service.id ? { ...s, concepto: val } : s))
                        );
                      }}
                      placeholder="Ej: Honorarios Contables, Declaración SRI..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:ring-1 focus:ring-[#166BA3]"
                    />
                  </div>

                  <div className="w-28">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Frecuencia
                    </label>
                    <select
                      value={service.freq || 'MENSUAL'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBillServices((prev) =>
                          prev.map((s) => (s.id === service.id ? { ...s, freq: val } : s))
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white font-medium focus:ring-1 focus:ring-[#166BA3]"
                    >
                      <option value="MENSUAL">Mensual</option>
                      <option value="SEMESTRAL">Semestral</option>
                      <option value="ANUAL">Anual</option>
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Monto ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={service.monto}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBillServices((prev) =>
                          prev.map((s) => (s.id === service.id ? { ...s, monto: val } : s))
                        );
                      }}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold font-mono text-slate-800 focus:ring-1 focus:ring-[#166BA3]"
                    />
                  </div>

                  {billServices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setBillServices((prev) => prev.filter((s) => s.id !== service.id))}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 mt-4 transition-colors"
                      title="Eliminar servicio"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <div className="pt-2 flex items-center justify-between text-xs bg-white px-3 py-2 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-semibold">Total a Cobrar Cartera:</span>
                <span className="font-mono font-bold text-sm text-[#166BA3]">
                  ${billServices.reduce((acc, s) => acc + (Number(s.monto) || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Honorario Total ($)</label>
              <input
                type="number"
                step="0.01"
                value={autoBillAmount}
                onChange={e => setAutoBillAmount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
              />
            </div>
          )}
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
  const [editBillServices, setEditBillServices] = useState<Array<{ id: string; concepto: string; monto: string; freq?: string }>>([
    { id: '1', concepto: 'Honorarios Contables Mensuales', monto: '0.00', freq: 'MENSUAL' },
  ]);
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
  const [newClaveSercop, setNewClaveSercop] = useState('');
  const [newAutoBillFreq, setNewAutoBillFreq] = useState<BillingFrequency>('MENSUAL');
  const [newAutoBillAmount, setNewAutoBillAmount] = useState('0.00');
  const [newBillServices, setNewBillServices] = useState<Array<{ id: string; concepto: string; monto: string; freq?: string }>>([
    { id: '1', concepto: 'Honorarios Contables Mensuales', monto: '0.00', freq: 'MENSUAL' },
  ]);
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

  // ─── Modales para Bóveda y Contabilidad ───────────────────────────────────
  // Modal Subir Documento a Bóveda
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('DECLARACION_IVA');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadYear, setUploadYear] = useState<string>(String(new Date().getFullYear()));
  const [uploadMonth, setUploadMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [uploadTaxpayerId, setUploadTaxpayerId] = useState<string>('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal Registrar Abono
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [abonoMonto, setAbonoMonto] = useState('');
  const [abonoBanco, setAbonoBanco] = useState<'BANCO_PICHINCHA' | 'BANCO_DE_LOJA' | 'COOPERATIVA_JEP' | 'EFECTIVO'>('BANCO_PICHINCHA');
  const [abonoConcepto, setAbonoConcepto] = useState('');
  const [savingAbono, setSavingAbono] = useState(false);
  const [abonoError, setAbonoError] = useState<string | null>(null);

  // Modal Agregar Cargo
  const [isCargoModalOpen, setIsCargoModalOpen] = useState(false);
  const [cargoTaxpayerId, setCargoTaxpayerId] = useState<string>('');
  const [cargoConcepto, setCargoConcepto] = useState('');
  const [cargoMonto, setCargoMonto] = useState('');
  const [cargoPeriodo, setCargoPeriodo] = useState('');
  const [cargoFreq, setCargoFreq] = useState<string>('NINGUNA');
  const [savingCargo, setSavingCargo] = useState(false);
  const [cargoError, setCargoError] = useState<string | null>(null);

  // Modal rápido para editar servicios / cobro de una empresa
  const [quickServicesModalOpen, setQuickServicesModalOpen] = useState(false);
  const [quickTp, setQuickTp] = useState<TaxpayerItem | null>(null);
  const [quickBillFreq, setQuickBillFreq] = useState<BillingFrequency>('MENSUAL');
  const [quickBillServices, setQuickBillServices] = useState<Array<{ id: string; concepto: string; monto: string; freq?: string }>>([]);
  const [savingQuickServices, setSavingQuickServices] = useState(false);
  const [quickServicesError, setQuickServicesError] = useState<string | null>(null);

  // Modales de detalle rápido (Ficha de Razón Social y Desglose de Cobros)
  const [taxpayerDetailModalOpen, setTaxpayerDetailModalOpen] = useState(false);
  const [selectedTaxpayerDetail, setSelectedTaxpayerDetail] = useState<TaxpayerItem | null>(null);
  const [cobrosModalOpen, setCobrosModalOpen] = useState(false);

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

    // Parsear servicesBreakdown si existe
    let parsedSv: Array<{ id: string; concepto: string; monto: string; freq?: string }> = [];
    const rawBreakdown = tp.servicesBreakdown || tp.declaDetalle;
    if (rawBreakdown && rawBreakdown.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(rawBreakdown);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedSv = arr.map((item: any, idx: number) => ({
            id: String(idx + 1),
            concepto: item.concepto || '',
            monto: String(item.monto ?? '0.00'),
            freq: item.freq || 'MENSUAL',
          }));
        }
      } catch { }
    }
    if (parsedSv.length === 0) {
      parsedSv = [
        {
          id: '1',
          concepto: tp.declaDetalle && !tp.declaDetalle.startsWith('[') ? tp.declaDetalle : 'Honorarios Contables Mensuales',
          monto: String(tp.autoBillAmount ?? '0.00'),
          freq: (tp.autoBillFreq as string) || 'MENSUAL',
        },
      ];
    }
    setEditBillServices(parsedSv);
  };

  const handleOpenEditModal = (initialTab: EditModalTab = 'OWNER', targetTaxpayer?: TaxpayerItem | null) => {
    if (!client) return;
    setSaveError(null);

    // Prellenar Tab 1 (Owner)
    setOwnerName(client.fullName);
    setOwnerPhone(client.whatsappPhone);
    setOwnerPin(client.securityPin);
    setOwnerIsVip(client.isVip);
    setOwnerConsent(client.dataConsentSigned);
    setOwnerNotes(client.notes || '');

    // Prellenar Tab 2 con la empresa indicada o la activa
    const tpToEdit = targetTaxpayer || activeTaxpayer;
    if (tpToEdit) {
      fillEditForm(tpToEdit);
    }

    // Limpiar Tab 3
    setNewRazonSocial(''); setNewRuc(''); setNewRegimen('MENSUAL'); setNewEmail('');
    setNewClaveSri(''); setNewClaveFirma(''); setNewFirmaExpira('');
    setNewClaveIess(''); setNewClaveSut(''); setNewClaveSalar(''); setNewClaveSupercias('');
    setNewClaveSercop('');
    setNewAutoBillFreq('MENSUAL'); setNewAutoBillAmount('0.00'); setNewAppliesVat(false);
    setNewBillServices([{ id: '1', concepto: 'Honorarios Contables Mensuales', monto: '0.00' }]);
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
        const totalCalc = editBillServices.reduce((acc, s) => acc + (Number(s.monto) || 0), 0);
        const serializedServices = JSON.stringify(
          editBillServices.map(s => ({
            concepto: s.concepto.trim() || 'Servicio Contable',
            monto: Number(s.monto) || 0,
            freq: s.freq || 'MENSUAL',
          }))
        );

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
            servicesBreakdown: serializedServices,
            autoBillFreq: editAutoBillFreq,
            autoBillAmount: totalCalc,
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
      const totalCalc = newBillServices.reduce((acc, s) => acc + (Number(s.monto) || 0), 0);
      const serializedServices = JSON.stringify(
        newBillServices.map(s => ({
          concepto: s.concepto.trim() || 'Servicio Contable',
          monto: Number(s.monto) || 0,
          freq: s.freq || 'MENSUAL',
        }))
      );

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
          claveSercop: newClaveSercop || null,
          ...newChecks,
          ...newDetails,
          servicesBreakdown: serializedServices,
          autoBillFreq: newAutoBillFreq,
          autoBillAmount: totalCalc,
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
  // Subir Documento a Bóveda Digital
  // ─────────────────────────────────────────────────────────────────────────

  const handleUploadDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !uploadFile) {
      setUploadError('Por favor selecciona un archivo para subir.');
      return;
    }
    const targetTaxpayerId = uploadTaxpayerId || (activeTaxpayer?.id ? String(activeTaxpayer.id) : '');
    if (!targetTaxpayerId) {
      setUploadError('Por favor selecciona la Razón Social a la que pertenece el archivo.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('El título del documento es obligatorio.');
      return;
    }

    setUploadingDoc(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('taxpayerId', targetTaxpayerId);
      formData.append('category', uploadCategory);
      formData.append('title', uploadTitle.trim());
      formData.append('periodYear', uploadYear);
      if (uploadMonth) formData.append('periodMonth', uploadMonth);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al subir documento a la bóveda.');

      await fetchVaultDocuments();
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Registrar Abono / Pago
  // ─────────────────────────────────────────────────────────────────────────

  const handleRegisterAbonoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !client) return;
    const monto = parseFloat(abonoMonto);
    if (isNaN(monto) || monto <= 0) {
      setAbonoError('El monto del abono debe ser mayor a 0.');
      return;
    }

    setSavingAbono(true);
    setAbonoError(null);
    try {
      const res = await fetch('/api/ledger/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientOwnerId: client.id,
          amount: monto,
          bankAccount: abonoBanco,
          concept: abonoConcepto.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al registrar abono.');

      await fetchClient();
      setIsAbonoModalOpen(false);
      setAbonoMonto('');
      setAbonoConcepto('');
    } catch (err: any) {
      setAbonoError(err.message);
    } finally {
      setSavingAbono(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Registrar Cargo Manual
  // ─────────────────────────────────────────────────────────────────────────

  const handleRegisterCargoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !client) return;
    const monto = parseFloat(cargoMonto);
    if (isNaN(monto) || monto <= 0) {
      setCargoError('El monto del cargo debe ser mayor a 0.');
      return;
    }
    if (!cargoConcepto.trim()) {
      setCargoError('El concepto del cargo es obligatorio.');
      return;
    }

    setSavingCargo(true);
    setCargoError(null);
    try {
      const res = await fetch('/api/ledger/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientOwnerId: client.id,
          taxpayerId: cargoTaxpayerId ? parseInt(cargoTaxpayerId, 10) : undefined,
          concept: cargoConcepto.trim(),
          amount: monto,
          periodText: cargoPeriodo.trim() || undefined,
          recurringFreq: cargoFreq !== 'NINGUNA' ? cargoFreq : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al registrar cargo.');

      await fetchClient();
      setIsCargoModalOpen(false);
      setCargoConcepto('');
      setCargoMonto('');
      setCargoPeriodo('');
      setCargoFreq('NINGUNA');
    } catch (err: any) {
      setCargoError(err.message);
    } finally {
      setSavingCargo(false);
    }
  };

  // Abrir modal rápido para editar servicios y cobro
  const openQuickServicesModal = (tp: TaxpayerItem) => {
    setQuickTp(tp);
    setQuickBillFreq((tp.autoBillFreq as BillingFrequency) || 'MENSUAL');
    setQuickServicesError(null);

    let parsedSv: Array<{ id: string; concepto: string; monto: string; freq?: string }> = [];
    const rawBreakdown = tp.servicesBreakdown || tp.declaDetalle;
    if (rawBreakdown && rawBreakdown.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(rawBreakdown);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedSv = arr.map((item: any, idx: number) => ({
            id: String(idx + 1),
            concepto: item.concepto || '',
            monto: String(item.monto ?? '0.00'),
            freq: item.freq || 'MENSUAL',
          }));
        }
      } catch { }
    }
    if (parsedSv.length === 0) {
      parsedSv = [
        {
          id: '1',
          concepto: tp.declaDetalle && !tp.declaDetalle.startsWith('[') ? tp.declaDetalle : 'Honorarios Contables Mensuales',
          monto: String(tp.autoBillAmount ?? '0.00'),
          freq: (tp.autoBillFreq as string) || 'MENSUAL',
        },
      ];
    }
    setQuickBillServices(parsedSv);
    setQuickServicesModalOpen(true);
  };

  // Guardar cambios rápidos de servicios
  const handleSaveQuickServices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !quickTp) return;

    setSavingQuickServices(true);
    setQuickServicesError(null);
    try {
      const totalCalc = quickBillServices.reduce((acc, s) => acc + (Number(s.monto) || 0), 0);
      const serializedServices = JSON.stringify(
        quickBillServices.map(s => ({
          concepto: s.concepto.trim() || 'Servicio Contable',
          monto: Number(s.monto) || 0,
          freq: s.freq || 'MENSUAL',
        }))
      );

      const res = await fetch(`/api/clients/taxpayers/${quickTp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          servicesBreakdown: serializedServices,
          autoBillFreq: quickBillFreq,
          autoBillAmount: totalCalc,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al actualizar servicios.');

      await fetchClient();
      setQuickServicesModalOpen(false);
    } catch (err: any) {
      setQuickServicesError(err.message);
    } finally {
      setSavingQuickServices(false);
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

  // Total recaudado / ganado históricamente con este cliente
  const totalGanado = (client.ledgerEntries || [])
    .filter((e: any) => e.entryType === 'ABONO_PAGO' || e.entryType === 'DESCUENTO_CRUCE')
    .reduce((acc: number, e: any) => acc + Number(e.amount), 0);

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
    <div className="min-w-0">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5 truncate">{label}</p>
      <div className="text-sm font-semibold text-slate-800 break-all">{value || <span className="text-slate-400 italic font-normal">—</span>}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:pl-64 overflow-x-hidden max-w-full">
      <Navbar />

      {/* Toast de copia */}
      {copiedKey && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-pulse">
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span>Copiado: <strong>{copiedKey}</strong></span>
        </div>
      )}

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col w-full px-3 sm:px-6 lg:px-8 py-6 gap-4 overflow-x-hidden">

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

            {/* Acciones */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenEditModal('OWNER')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#166BA3] text-white text-sm font-semibold rounded-lg hover:bg-[#125989] transition-colors shadow-sm"
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
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${activeTaxpayerId === t.id
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
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSubTab === tab.key
                  ? 'bg-[#166BA3] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Buscador Rápido del Cliente (conecta con Bóveda, Contabilidad y Ficha) */}
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
                // Si el usuario empieza a escribir y está en la Ficha Técnica,
                // cambiar intuitivamente a la Bóveda para ver los resultados inmediatamente
                if (val.trim() && activeSubTab === 'FICHA') {
                  setActiveSubTab('BOVEDA');
                }
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

        {/* ── CONTENIDO SUB-TAB: FICHA TÉCNICA ── */}
        {activeSubTab === 'FICHA' && activeTaxpayer && (
          <div className="flex flex-col gap-4 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta 1: Expediente Fiscal y Datos de la Empresa (Click para ver Ficha Completa en modal) */}
              <div
                onClick={() => {
                  setSelectedTaxpayerDetail(activeTaxpayer);
                  setTaxpayerDetailModalOpen(true);
                }}
                className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 cursor-pointer hover:border-[#166BA3]/60 hover:shadow-md transition-all group flex flex-col justify-between"
                title="Click para ver la ficha completa de esta razón social"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#166BA3]">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-800 group-hover:text-[#166BA3] transition-colors leading-tight">
                          {activeTaxpayer.razonSocial}
                        </h2>
                        <span className="text-[11px] text-slate-400 font-medium">Expediente Contribuyente</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#166BA3] bg-blue-50/80 hover:bg-[#166BA3] hover:text-white px-3 py-1.5 rounded-lg border border-blue-200 transition-all flex items-center gap-1.5 flex-shrink-0">
                      Ver Ficha Completa <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">RUC / Identificación</p>
                      <p className="text-lg font-black font-mono text-slate-800 tracking-tight">{activeTaxpayer.ruc}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Fecha de Declaración</p>
                      <p className="text-base font-bold text-slate-800">{activeTaxpayer.fechaDecla || 'No asignada'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Régimen: <strong className="text-slate-700">{REGIMEN_LABEL[activeTaxpayer.regimen] || activeTaxpayer.regimen}</strong>
                  </span>
                  <span className="text-[#166BA3] font-medium group-hover:underline">Click para ver claves y obligaciones</span>
                </div>
              </div>

              {/* Tarjeta 2: Condiciones de Cobro y Cartera (Muestra Total Ganado y Saldo a Cobrar / Deuda) */}
              {!isAssistant && (
                <div
                  onClick={() => setCobrosModalOpen(true)}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 cursor-pointer hover:border-[#166BA3]/60 hover:shadow-md transition-all group flex flex-col justify-between"
                  title="Click para ver desglose de cobros y servicios"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 group-hover:text-[#166BA3] transition-colors leading-tight">
                            Condiciones de Cobro y Cartera
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium">Estado financiero del cliente</span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#166BA3] bg-blue-50/80 hover:bg-[#166BA3] hover:text-white px-3 py-1.5 rounded-lg border border-blue-200 transition-all flex items-center gap-1.5 flex-shrink-0">
                        Ver Servicios <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Total Ganado */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Total Ganado / Cobrado
                          </p>
                          <p className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                            {formatMoney(totalGanado)}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-2">
                          Ingresos recaudados
                        </p>
                      </div>

                      {/* Saldo a Cobrar (Deuda) */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {saldo > 0 ? 'Saldo a Cobrar (Deuda)' : saldo < 0 ? 'Saldo a Favor' : 'Estado de Cuenta'}
                          </p>
                          <p className={`text-2xl font-black font-mono tracking-tight ${
                            saldo > 0 ? 'text-red-600' : saldo < 0 ? 'text-emerald-600' : 'text-slate-700'
                          }`}>
                            {saldo < 0 ? `+${formatMoney(Math.abs(saldo))}` : formatMoney(saldo)}
                          </p>
                        </div>
                        <p className={`text-[11px] font-semibold mt-2 ${
                          saldo > 0 ? 'text-red-500' : saldo < 0 ? 'text-emerald-600' : 'text-slate-500'
                        }`}>
                          {saldo > 0 ? 'Saldo pendiente a cobrar' : saldo < 0 ? 'A favor del cliente' : 'Cuenta al día'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Honorario acordado: <strong className="text-slate-700">{formatMoney(activeTaxpayer.autoBillAmount)}</strong></span>
                    <span className="text-[#166BA3] font-medium group-hover:underline">Click para ver y editar servicios</span>
                  </div>
                </div>
              )}

              {/* Tarjeta 3: Acceso Directo a Bóveda Digital */}
              <div
                onClick={() => setActiveSubTab('BOVEDA')}
                className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 cursor-pointer hover:border-[#166BA3]/60 hover:shadow-md transition-all group flex flex-col justify-between"
                title="Ir a Bóveda Digital"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#166BA3]">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-[#166BA3] transition-colors leading-tight">
                          Bóveda Digital
                        </h3>
                        <span className="text-[11px] text-slate-400 font-medium">Expediente documental y declaraciones</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#166BA3] bg-blue-50/80 hover:bg-[#166BA3] hover:text-white px-3 py-1.5 rounded-lg border border-blue-200 transition-all flex items-center gap-1.5 flex-shrink-0">
                      Abrir Bóveda <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Documentos en Bóveda</p>
                      <p className="text-2xl font-black font-mono text-slate-800 tracking-tight">{documents.length}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">Archivos archivados</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Empresas Vinculadas</p>
                      <p className="text-2xl font-black font-mono text-slate-800 tracking-tight">{client.taxpayers.length}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">Razones sociales</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Declaraciones IVA, Renta, Anexos y Facturas</span>
                  <span className="text-[#166BA3] font-medium group-hover:underline">Subir o consultar</span>
                </div>
              </div>

              {/* Tarjeta 4: Acceso Directo a Chat WhatsApp */}
              <div
                onClick={() => setActiveSubTab('CHAT')}
                className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 cursor-pointer hover:border-[#166BA3]/60 hover:shadow-md transition-all group flex flex-col justify-between"
                title="Ir a Chat WhatsApp"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-[#166BA3] transition-colors leading-tight">
                          Chat WhatsApp
                        </h3>
                        <span className="text-[11px] text-slate-400 font-medium">Atención y seguimiento directo</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg border border-emerald-200 transition-all flex items-center gap-1.5 flex-shrink-0">
                      Abrir Chat <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">WhatsApp Registrado</p>
                      <p className="text-base font-bold font-mono text-slate-800 tracking-tight truncate">
                        {client.whatsappPhone || 'No registrado'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">Canal verificado</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tickets de Conversación</p>
                      <p className="text-2xl font-black font-mono text-slate-800 tracking-tight">{chatTickets.length}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">Interacciones activas</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Envío de estados de cuenta y recordatorios</span>
                  <span className="text-emerald-600 font-medium group-hover:underline">Iniciar mensaje</span>
                </div>
              </div>
            </div>

            {/* Notas del titular (si existen) */}
            {client.notes && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <h3 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1.5">Notas del Titular</h3>
                <p className="text-sm text-amber-800">{client.notes}</p>
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

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setUploadError(null);
                    setUploadFile(null);
                    setUploadTitle('');
                    setUploadTaxpayerId(activeTaxpayer?.id ? String(activeTaxpayer.id) : '');
                    setIsUploadModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#166BA3] text-white text-xs md:text-sm font-semibold rounded-lg hover:bg-[#125989] transition-colors shadow-sm"
                >
                  <Upload className="w-4 h-4" /> Subir Documento
                </button>
                <div className="hidden sm:flex text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{client.taxpayers.length} empresa(s)</span>
                </div>
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

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setAbonoError(null);
                    setAbonoMonto('');
                    setAbonoConcepto('');
                    setIsAbonoModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white text-xs md:text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Registrar Abono
                </button>
                <button
                  onClick={() => {
                    setCargoError(null);
                    setCargoMonto('');
                    setCargoConcepto('');
                    setCargoPeriodo('');
                    setCargoTaxpayerId(activeTaxpayer?.id ? String(activeTaxpayer.id) : '');
                    setIsCargoModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white text-xs md:text-sm font-semibold rounded-lg hover:bg-slate-900 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Agregar Cargo
                </button>
                <div className="flex items-center gap-3">
                  <div className="text-right bg-emerald-50/70 border border-emerald-200 rounded-xl px-3.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-emerald-800 font-bold">
                      Total Ganado
                    </p>
                    <p className="text-lg font-black text-emerald-700 font-mono">
                      {formatMoney(totalGanado)}
                    </p>
                  </div>
                  <div className="text-right bg-slate-50 border border-slate-200 rounded-xl px-4 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                      {saldo > 0 ? 'Saldo a Cobrar (Deuda)' : saldo < 0 ? 'Saldo a Favor' : 'Al Día'}
                    </p>
                    <p className={`text-lg font-black ${saldo > 0
                      ? 'text-red-600'
                      : saldo < 0
                        ? 'text-emerald-600'
                        : 'text-slate-700'
                      }`}>
                      {saldo < 0 ? `+${formatMoney(Math.abs(saldo))}` : formatMoney(saldo)}
                    </p>
                  </div>
                </div>
              </div>
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
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${isPayment ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {isPayment ? 'ABONO' : 'CARGO'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{e.concept}</td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-xs">{e.bankAccount || 'NO_APLICA'}</td>
                            <td className={`py-3 px-4 text-right font-bold font-mono ${isPayment ? 'text-green-600' : 'text-red-600'
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
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                          ? 'bg-white border-[#166BA3] shadow-sm ring-1 ring-[#166BA3]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] font-bold text-slate-800">
                            Ticket #{t.id}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.status === 'ABIERTO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
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
                                  className={`rounded-2xl px-4 py-2.5 max-w-[85%] sm:max-w-[70%] text-xs shadow-sm ${isClient
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
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${editModalTab === 'OWNER'
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
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${editModalTab === 'TAXPAYER' && editingTaxpayerId === tp.id
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
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${editModalTab === 'NEW_TAXPAYER'
                  ? 'border-green-500 text-green-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white'
                  }`}
              >
                <Plus className="w-3.5 h-3.5" /> Nueva Razón Social
              </button>

              {/* Tab Resumen de Cobros */}
              <button
                onClick={() => { setSaveError(null); setEditModalTab('COBROS'); }}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${editModalTab === 'COBROS'
                  ? 'border-amber-500 text-amber-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white'
                  }`}
              >
                <DollarSign className="w-3.5 h-3.5" /> Resumen de Cobros
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
                      claveSercop={editClaveSercop} setClaveSercop={setEditClaveSercop}
                      autoBillFreq={editAutoBillFreq} setAutoBillFreq={setEditAutoBillFreq}
                      autoBillAmount={editAutoBillAmount} setAutoBillAmount={setEditAutoBillAmount}
                      appliesVat={editAppliesVat} setAppliesVat={setEditAppliesVat}
                      checks={editChecks} setChecks={setEditChecks}
                      details={editDetails} setDetails={setEditDetails}
                      billServices={editBillServices} setBillServices={setEditBillServices}
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
                      claveSercop={newClaveSercop} setClaveSercop={setNewClaveSercop}
                      autoBillFreq={newAutoBillFreq} setAutoBillFreq={setNewAutoBillFreq}
                      autoBillAmount={newAutoBillAmount} setAutoBillAmount={setNewAutoBillAmount}
                      appliesVat={newAppliesVat} setAppliesVat={setNewAppliesVat}
                      checks={newChecks} setChecks={setNewChecks}
                      details={newDetails} setDetails={setNewDetails}
                      billServices={newBillServices} setBillServices={setNewBillServices}
                    />
                  </form>
                )}

                {/* TAB 4: RESUMEN DE COBROS */}
                {editModalTab === 'COBROS' && (() => {
                  // Calcular totales globales del historial de cuenta corriente
                  const allEntries: any[] = client.ledgerEntries || [];
                  const totalCargosFacturados = allEntries
                    .filter((e: any) => ['CARGO_AUTOMATICO', 'CARGO_MANUAL', 'CARGO_COMISION_DEV'].includes(e.entryType))
                    .reduce((s: number, e: any) => s + Number(e.amount), 0);
                  const totalAbonos = allEntries
                    .filter((e: any) => ['ABONO_PAGO', 'DESCUENTO_CRUCE'].includes(e.entryType))
                    .reduce((s: number, e: any) => s + Number(e.amount), 0);
                  const saldoContable = totalCargosFacturados - totalAbonos;

                  // Total de servicios configurados en cartera (lo que se cobra periódicamente)
                  const totalServiciosConfigurados = client.taxpayers.reduce((acc: number, tp: any) => {
                    let services: Array<{ concepto: string; monto: number }> = [];
                    const raw = tp.servicesBreakdown || tp.declaDetalle;
                    if (raw && raw.trim().startsWith('[')) {
                      try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) services = parsed.filter((s: any) => s.concepto && Number(s.monto) > 0);
                      } catch { }
                    }
                    if (services.length === 0 && Number(tp.autoBillAmount) > 0) {
                      services = [{ concepto: 'Honorario', monto: Number(tp.autoBillAmount) }];
                    }
                    return acc + services.reduce((s, sv) => s + Number(sv.monto), 0);
                  }, 0);

                  return (
                    <div className="space-y-6">
                      {/* KPI Row explicativo */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3.5 text-center">
                          <p className="text-[11px] text-red-500 font-bold uppercase tracking-wider mb-0.5">Total de Cargos (Deuda)</p>
                          <p className="text-xl font-bold text-red-700 font-mono">{formatMoney(totalCargosFacturados)}</p>
                          <span className="text-[10px] text-red-400">Total a pagar por servicios</span>
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-3.5 text-center">
                          <p className="text-[11px] text-green-600 font-bold uppercase tracking-wider mb-0.5">Total Abonos Realizados</p>
                          <p className="text-xl font-bold text-green-700 font-mono">{formatMoney(totalAbonos)}</p>
                          <span className="text-[10px] text-green-500">Pagos recibidos del cliente</span>
                        </div>
                        <div className={`border rounded-xl p-3.5 text-center ${saldoContable > 0 ? 'bg-orange-50 border-orange-200' : saldoContable < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                          <p className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${saldoContable > 0 ? 'text-orange-600' : saldoContable < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {saldoContable > 0 ? 'Saldo a Cobrar (Pendiente)' : saldoContable < 0 ? 'Saldo a Favor' : 'Al Día'}
                          </p>
                          <p className={`text-xl font-bold font-mono ${saldoContable > 0 ? 'text-orange-700' : saldoContable < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {saldoContable < 0 ? '+' : ''}{formatMoney(Math.abs(saldoContable))}
                          </p>
                          <span className="text-[10px] text-slate-400">{saldoContable > 0 ? 'Deuda actual del cliente' : saldoContable < 0 ? 'Abono a favor' : 'Sin deuda pendiente'}</span>
                        </div>
                      </div>

                      {/* Servicios desglosados por razón social */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#166BA3]" />
                            Servicios y Reglas de Cobro por Empresa
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCargoTaxpayerId(client.taxpayers[0]?.id ? String(client.taxpayers[0].id) : '');
                                setCargoConcepto(
                                  client.taxpayers[0] ? `Honorarios Contables - ${client.taxpayers[0].razonSocial}` : 'Honorarios Contables'
                                );
                                setCargoMonto(String(totalServiciosConfigurados > 0 ? totalServiciosConfigurados : ''));
                                setCargoPeriodo(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
                                setCargoFreq('MENSUAL');
                                setIsCargoModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition-colors shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" /> Registrar Cargo a Cuenta
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {client.taxpayers.map((tp: any) => {
                            let services: Array<{ concepto: string; monto: number; freq?: string }> = [];
                            const raw = tp.servicesBreakdown || tp.declaDetalle;
                            if (raw && raw.trim().startsWith('[')) {
                              try {
                                const parsed = JSON.parse(raw);
                                if (Array.isArray(parsed)) {
                                  services = parsed
                                    .filter((s: any) => s.concepto && Number(s.monto) > 0)
                                    .map((s: any) => ({
                                      concepto: s.concepto,
                                      monto: Number(s.monto),
                                      freq: s.freq || tp.autoBillFreq || 'MENSUAL',
                                    }));
                                }
                              } catch { /* ignore */ }
                            }
                            if (services.length === 0 && Number(tp.autoBillAmount) > 0) {
                              services = [{
                                concepto: tp.declaDetalle && !tp.declaDetalle.startsWith('[') ? tp.declaDetalle : 'Honorario mensual',
                                monto: Number(tp.autoBillAmount),
                                freq: tp.autoBillFreq || 'MENSUAL',
                              }];
                            }
                            const tpTotal = services.reduce((s, sv) => s + sv.monto, 0);
                            return (
                              <div key={tp.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-sm font-bold text-slate-700">{tp.razonSocial}</span>
                                    <span className="text-xs text-slate-400 font-mono">{tp.ruc}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                                      {tp.autoBillFreq || 'MENSUAL'}
                                    </span>
                                    {tpTotal > 0 && (
                                      <span className="px-2.5 py-0.5 bg-[#166BA3] text-white text-xs font-bold rounded-full font-mono">
                                        {formatMoney(tpTotal)}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => openQuickServicesModal(tp)}
                                      className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#166BA3] bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors"
                                      title="Modificar servicios, frecuencia y montos de cobro de esta empresa"
                                    >
                                      <Edit2 className="w-3 h-3" /> Editar Cobro y Servicios
                                    </button>
                                  </div>
                                </div>
                                {services.length > 0 ? (
                                  <div className="divide-y divide-slate-100">
                                    {services.map((sv, i) => (
                                      <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          <span className="text-slate-700 font-medium">{sv.concepto}</span>
                                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                            {sv.freq || 'MENSUAL'}
                                          </span>
                                        </div>
                                        <span className="font-bold font-mono text-slate-800">{formatMoney(sv.monto)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="px-4 py-3 text-xs text-slate-400 italic flex items-center justify-between">
                                    <span>Sin servicios configurados aún</span>
                                    <button
                                      type="button"
                                      onClick={() => openQuickServicesModal(tp)}
                                      className="text-xs text-[#166BA3] font-semibold hover:underline"
                                    >
                                      + Agregar servicios y configurar cobro
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Historial de movimientos */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-[#166BA3]" />
                            Historial Completo de Movimientos
                            <span className="text-xs font-normal text-slate-400">({allEntries.length} movimientos)</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setIsAbonoModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                          >
                            <Plus className="w-3 h-3" /> Registrar Abono
                          </button>
                        </div>

                        {allEntries.length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                            Sin movimientos registrados aún
                          </div>
                        ) : (
                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                  <th className="py-2.5 px-3">Fecha</th>
                                  <th className="py-2.5 px-3">Tipo</th>
                                  <th className="py-2.5 px-3">Concepto</th>
                                  <th className="py-2.5 px-3 text-right">Monto</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {[...allEntries]
                                  .sort((a: any, b: any) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
                                  .map((e: any) => {
                                    const isPay = e.entryType === 'ABONO_PAGO' || e.entryType === 'DESCUENTO_CRUCE';
                                    return (
                                      <tr key={e.id} className="hover:bg-slate-50/60">
                                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{new Date(e.entryDate).toLocaleDateString('es-EC')}</td>
                                        <td className="py-2 px-3">
                                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${isPay ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {isPay ? 'ABONO' : 'CARGO'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-slate-700 max-w-[200px] truncate">{e.concept}</td>
                                        <td className={`py-2 px-3 text-right font-bold font-mono ${isPay ? 'text-green-600' : 'text-red-600'}`}>
                                          {isPay ? '-' : '+'}{formatMoney(Number(e.amount))}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                                  <td colSpan={3} className="py-2.5 px-3 text-sm text-slate-600">Saldo Global</td>
                                  <td className={`py-2.5 px-3 text-right text-sm font-mono ${saldoContable > 0 ? 'text-red-600' : saldoContable < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                                    {saldoContable > 0 ? '+' : ''}{formatMoney(saldoContable)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer fijo del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {editModalTab === 'COBROS' ? 'Cerrar' : 'Cancelar'}
              </button>
              {editModalTab !== 'COBROS' && (
                <button
                  type="submit"
                  form={
                    editModalTab === 'OWNER' ? 'modalOwnerForm'
                      : editModalTab === 'TAXPAYER' ? 'modalTaxpayerForm'
                        : 'modalNewTaxForm'
                  }
                  disabled={saving}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg text-white transition-all shadow-sm disabled:opacity-50 ${editModalTab === 'NEW_TAXPAYER' ? 'bg-green-600 hover:bg-green-700' : 'bg-[#166BA3] hover:bg-[#125989]'
                    }`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editModalTab === 'NEW_TAXPAYER' ? 'Guardar Nueva Empresa' : 'Guardar Expediente'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL — SUBIR DOCUMENTO A BÓVEDA DIGITAL
      ════════════════════════════════════════════════════════════════════ */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setIsUploadModalOpen(false); }}
        >
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#1E2A3C] text-white">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-base">Subir Documento a la Bóveda</h3>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadDocumentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Social *</label>
                <select
                  value={uploadTaxpayerId}
                  onChange={e => setUploadTaxpayerId(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                >
                  <option value="">Seleccionar empresa...</option>
                  {client.taxpayers.map(t => (
                    <option key={t.id} value={String(t.id)}>{t.razonSocial} ({t.ruc || 'Sin RUC'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría del Documento *</label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                >
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título o Descripción *</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Ej. Declaración IVA Octubre 2024"
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Año Fiscal *</label>
                  <input
                    type="number"
                    value={uploadYear}
                    onChange={e => setUploadYear(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mes (Opcional)</label>
                  <select
                    value={uploadMonth}
                    onChange={e => setUploadMonth(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                  >
                    <option value="">Anual / Sin mes</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>Mes {i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Archivo * (PDF, p12, ZIP, etc.)</label>
                <input
                  type="file"
                  onChange={e => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                    if (f && !uploadTitle) {
                      setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  required
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#166BA3] hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingDoc || !uploadFile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#166BA3] text-white text-xs font-bold rounded-lg hover:bg-[#125989] transition-all disabled:opacity-50"
                >
                  {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Subir Documento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL — REGISTRAR ABONO / PAGO
      ════════════════════════════════════════════════════════════════════ */}
      {isAbonoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setIsAbonoModalOpen(false); }}
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-emerald-800 text-white">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">Registrar Abono / Pago</h3>
              </div>
              <button onClick={() => setIsAbonoModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {abonoError && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{abonoError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterAbonoSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monto del Abono ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={abonoMonto}
                  onChange={e => setAbonoMonto(e.target.value)}
                  placeholder="0.00"
                  required
                  autoFocus
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Banco / Destino del Pago *</label>
                <select
                  value={abonoBanco}
                  onChange={e => setAbonoBanco(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="BANCO_PICHINCHA">Banco Pichincha</option>
                  <option value="BANCO_DE_LOJA">Banco de Loja</option>
                  <option value="COOPERATIVA_JEP">Cooperativa JEP</option>
                  <option value="EFECTIVO">Efectivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Concepto / Nota (Opcional)</label>
                <input
                  type="text"
                  value={abonoConcepto}
                  onChange={e => setAbonoConcepto(e.target.value)}
                  placeholder="Ej. Transferencia abono mensualidad honorarios"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAbonoModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAbono || !abonoMonto}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {savingAbono ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Guardar Abono</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL — AGREGAR CARGO MANUAL
      ════════════════════════════════════════════════════════════════════ */}
      {isCargoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setIsCargoModalOpen(false); }}
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-base">Agregar Cargo a la Cuenta</h3>
              </div>
              <button onClick={() => setIsCargoModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {cargoError && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cargoError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterCargoSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Social Imputada (Opcional)</label>
                <select
                  value={cargoTaxpayerId}
                  onChange={e => setCargoTaxpayerId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                >
                  <option value="">A la cuenta global del Titular</option>
                  {client.taxpayers.map(t => (
                    <option key={t.id} value={String(t.id)}>{t.razonSocial}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Concepto del Cargo *</label>
                <input
                  type="text"
                  value={cargoConcepto}
                  onChange={e => setCargoConcepto(e.target.value)}
                  placeholder="Ej. Honorario adicional balances Supercias"
                  required
                  autoFocus
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={cargoMonto}
                    onChange={e => setCargoMonto(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Periodo (Opcional)</label>
                  <input
                    type="text"
                    value={cargoPeriodo}
                    onChange={e => setCargoPeriodo(e.target.value)}
                    placeholder="Ej. 2024-10"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">🔁 Recurrencia del Cargo</label>
                <select
                  value={cargoFreq}
                  onChange={e => setCargoFreq(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                >
                  <option value="NINGUNA">Cargo único (sin recurrencia)</option>
                  <option value="MENSUAL">Mensual (cada mes)</option>
                  <option value="SEMESTRAL">Semestral (cada 6 meses)</option>
                  <option value="ANUAL">Anual (cada año)</option>
                </select>
                {cargoFreq !== 'NINGUNA' && (
                  <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                    <span>⏰</span>
                    <span>El sistema creará un recordatorio automático cuando llegue la próxima fecha.</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCargoModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCargo || !cargoMonto || !cargoConcepto}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition-all disabled:opacity-50"
                >
                  {savingCargo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Agregar Cargo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL RÁPIDO — EDITAR COBRO Y SERVICIOS DE EMPRESA
      ════════════════════════════════════════════════════════════════════ */}
      {quickServicesModalOpen && quickTp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setQuickServicesModalOpen(false); }}
        >
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#1E2A3C] text-white">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base">Editar Cobro y Servicios</h3>
                  <p className="text-xs text-slate-300 font-mono">{quickTp.razonSocial} ({quickTp.ruc || 'Sin RUC'})</p>
                </div>
              </div>
              <button
                onClick={() => setQuickServicesModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickServicesError && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{quickServicesError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuickServices} className="p-6 space-y-4">
              {/* Frecuencia de Cobro */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  📅 ¿Cuándo se cobrará? (Frecuencia / Recurrencia) *
                </label>
                <select
                  value={quickBillFreq}
                  onChange={e => setQuickBillFreq(e.target.value as BillingFrequency)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                >
                  <option value="MENSUAL">Mensual (cobro recurrente cada mes)</option>
                  <option value="SEMESTRAL">Semestral (cada 6 meses)</option>
                  <option value="ANUAL">Anual (cada año)</option>
                  <option value="NONE">Sin cobro automático</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  El sistema generará automáticamente la cuota según la frecuencia elegida.
                </p>
              </div>

              {/* Lista dinámica de servicios con botón + */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Servicios Divididos / Honorarios
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickBillServices(prev => [
                        ...prev,
                        { id: Date.now().toString(), concepto: '', monto: '0.00' },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#166BA3] text-white text-xs font-semibold hover:bg-[#135887] shadow-xs active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Servicio (+)
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {quickBillServices.map((service, index) => (
                    <div
                      key={service.id}
                      className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                    >
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Servicio #{index + 1}
                        </label>
                        <input
                          type="text"
                          value={service.concepto}
                          onChange={e => {
                            const val = e.target.value;
                            setQuickBillServices(prev =>
                              prev.map(s => (s.id === service.id ? { ...s, concepto: val } : s))
                            );
                          }}
                          placeholder="Ej: Honorarios Contables, Declaración SRI, IESS..."
                          required
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-[#166BA3]"
                        />
                      </div>

                      <div className="w-28">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Frecuencia
                        </label>
                        <select
                          value={service.freq || 'MENSUAL'}
                          onChange={e => {
                            const val = e.target.value;
                            setQuickBillServices(prev =>
                              prev.map(s => (s.id === service.id ? { ...s, freq: val } : s))
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white font-medium focus:ring-1 focus:ring-[#166BA3]"
                        >
                          <option value="MENSUAL">Mensual</option>
                          <option value="SEMESTRAL">Semestral</option>
                          <option value="ANUAL">Anual</option>
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Monto ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={service.monto}
                          onChange={e => {
                            const val = e.target.value;
                            setQuickBillServices(prev =>
                              prev.map(s => (s.id === service.id ? { ...s, monto: val } : s))
                            );
                          }}
                          placeholder="0.00"
                          required
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold font-mono text-slate-800 bg-white focus:ring-1 focus:ring-[#166BA3]"
                        />
                      </div>

                      {quickBillServices.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuickBillServices(prev => prev.filter(s => s.id !== service.id))
                          }
                          className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 mt-4 transition-colors"
                          title="Eliminar servicio"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between text-xs bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-700 font-bold">Total Tarifa por Periodo:</span>
                  <span className="font-mono font-black text-sm text-[#166BA3]">
                    ${quickBillServices.reduce((acc, s) => acc + (Number(s.monto) || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickServicesModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingQuickServices}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#166BA3] text-white text-xs font-bold rounded-lg hover:bg-[#135887] transition-all disabled:opacity-50"
                >
                  {savingQuickServices ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Guardar Cobro y Servicios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DETALLE COMPLETO DE RAZÓN SOCIAL ── */}
      {taxpayerDetailModalOpen && selectedTaxpayerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#166BA3]" />
                <div>
                  <h3 className="text-base font-bold text-[#1E2A3C]">{selectedTaxpayerDetail.razonSocial}</h3>
                  <p className="text-xs text-slate-500">Expediente fiscal y obligaciones registradas</p>
                </div>
              </div>
              <button
                onClick={() => setTaxpayerDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Datos Generales */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Datos Tributarios</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <DataField label="RUC" value={selectedTaxpayerDetail.ruc} />
                  <DataField label="Fecha Declaración" value={selectedTaxpayerDetail.fechaDecla} />
                  <DataField label="Régimen" value={REGIMEN_LABEL[selectedTaxpayerDetail.regimen] || selectedTaxpayerDetail.regimen} />
                  <DataField label="Email Contribuyente" value={selectedTaxpayerDetail.email} />
                </div>
              </div>

              {/* Obligaciones Tributarias y Laborales */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Obligaciones Tributarias y Laborales</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OBLIGACIONES.map(({ key, detalleKey, label }) => {
                    const checked = selectedTaxpayerDetail[key as keyof TaxpayerItem] as boolean;
                    let detalle = selectedTaxpayerDetail[detalleKey as keyof TaxpayerItem] as string | null;
                    if (detalle && (detalle.startsWith('[') || detalle.startsWith('{'))) {
                      detalle = null;
                    }
                    return (
                      <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${checked ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${checked ? 'bg-[#166BA3]' : 'bg-slate-300'}`} />
                        <span className={`text-xs font-bold w-24 ${checked ? 'text-[#166BA3]' : 'text-slate-400'}`}>{label}</span>
                        {detalle && <span className="text-xs text-slate-700 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 truncate">{detalle}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Claves Sensibles */}
              {!isAssistant && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> Claves y Accesos
                  </h4>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <ClaveField label="SRI" value={selectedTaxpayerDetail.claveSri} />
                    <ClaveField label="Firma pt2" value={selectedTaxpayerDetail.claveFirma} />
                    <ClaveField label="IESS Patronal" value={selectedTaxpayerDetail.claveIess} />
                    <ClaveField label="SUT (Ministerio)" value={selectedTaxpayerDetail.claveSut} />
                    <ClaveField label="Salarios (SALAR)" value={selectedTaxpayerDetail.claveSalar} />
                    <ClaveField label="Supercias" value={selectedTaxpayerDetail.claveSupercias} />
                    {selectedTaxpayerDetail.expSupercias && (
                      <div className="py-2">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Exp. Supercias</p>
                        <p className="text-sm font-mono font-semibold text-slate-800">{selectedTaxpayerDetail.expSupercias}</p>
                      </div>
                    )}
                    <ClaveField label="SERCOP" value={selectedTaxpayerDetail.claveSercop} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 p-3.5 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setTaxpayerDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setTaxpayerDetailModalOpen(false);
                  handleOpenEditModal('TAXPAYER', selectedTaxpayerDetail);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#166BA3] text-white text-xs font-bold rounded-lg hover:bg-[#135887] transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar Esta Razón Social
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DESGLOSE DE COBROS Y SERVICIOS DE TODAS LAS RAZONES SOCIALES ── */}
      {cobrosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#166BA3]" />
                <div>
                  <h3 className="text-base font-bold text-[#1E2A3C]">Condiciones de Cobro y Servicios</h3>
                  <p className="text-xs text-slate-500">Servicios acordados, tarifas por empresa y estado de cartera</p>
                </div>
              </div>
              <button
                onClick={() => setCobrosModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Tarjetas resumen de saldo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Total Ganado / Cobrado</p>
                  <p className="text-2xl font-black text-emerald-700 font-mono mt-0.5">{formatMoney(totalGanado)}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Ingresos recaudados históricamente</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    {saldo > 0 ? 'Saldo a Cobrar (Deuda)' : saldo < 0 ? 'Saldo a Favor' : 'Al Día'}
                  </p>
                  <p className={`text-2xl font-black font-mono mt-0.5 ${saldo > 0 ? 'text-red-600' : saldo < 0 ? 'text-emerald-600' : 'text-slate-700'
                    }`}>
                    {saldo < 0 ? `+${formatMoney(Math.abs(saldo))}` : formatMoney(saldo)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Estado actual de cartera</p>
                </div>
              </div>

              {/* Desglose por Razón Social */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Servicios y Tarifas por Razón Social ({client.taxpayers.length})
                </h4>

                {client.taxpayers.map(tp => {
                  let servicesList: Array<{ concepto: string; monto: number; freq?: string }> = [];
                  if (tp.servicesBreakdown) {
                    try {
                      const parsed = JSON.parse(tp.servicesBreakdown);
                      if (Array.isArray(parsed)) servicesList = parsed;
                    } catch { }
                  }

                  return (
                    <div key={tp.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-slate-50/70 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-[#166BA3]" />
                            {tp.razonSocial}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">RUC: {tp.ruc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#166BA3] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            Total: {formatMoney(tp.autoBillAmount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCobrosModalOpen(false);
                              openQuickServicesModal(tp);
                            }}
                            className="text-xs font-semibold text-[#166BA3] hover:underline flex items-center gap-1 ml-1"
                          >
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                        </div>
                      </div>

                      <div className="p-3">
                        {servicesList.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {servicesList.map((svc, sIdx) => (
                              <div key={sIdx} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between">
                                <div>
                                  <p className="text-xs font-semibold text-slate-700 truncate" title={svc.concepto}>
                                    {svc.concepto || 'Servicio'}
                                  </p>
                                  {svc.freq && (
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                      {svc.freq}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-bold font-mono text-[#166BA3] mt-2">
                                  {formatMoney(Number(svc.monto))}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span>Honorario Base ({tp.autoBillFreq || 'MENSUAL'})</span>
                            <span className="font-mono font-bold text-sm text-[#166BA3]">{formatMoney(tp.autoBillAmount)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end p-3.5 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setCobrosModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cerrar
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
