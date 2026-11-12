// frontend/src/app/whatsapp/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { io } from 'socket.io-client';
import {
  MessageSquare,
  Send,
  User,
  Building2,
  Clock,
  CheckCheck,
  Bot,
  Phone,
  FileText,
  Key,
  Shield,
  ArrowRight,
  Search,
  ExternalLink,
  Inbox,
  Lock,
} from 'lucide-react';

interface ChatItem {
  id: number;
  whatsappPhone: string;
  queueType: string;
  subject: string;
  status: string;
  botPaused?: boolean;
  updatedAt: string;
  clientOwner?: {
    id: number;
    fullName: string;
    isVip: boolean;
    taxpayers: {
      id: number;
      razonSocial: string;
      ruc: string | null;
      claveSri: string | null;
      documents: {
        id: number;
        title: string;
        bunnyUrl: string;
      }[];
    }[];
  };
}

interface LiveMessage {
  id: string;
  sender: 'client' | 'bot' | 'agent';
  text: string;
  timestamp: string;
  mediaType?: 'AUDIO' | 'IMAGE' | 'DOCUMENT' | null;
  mediaUrl?: string | null;
  fileName?: string | null;
}

interface QueueStatus {
  totalPending: number;
  totalProcessing: number;
  totalSent: number;
  totalFailed: number;
  isWorkingHours: boolean;
  workerRunning: boolean;
}

function WhatsAppView() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // ASISTENTE: solo ve OPERATIVA_CHICAS
  const isAsistente = user?.role === 'ASISTENTE';
  const [activeQueue, setActiveQueue] = useState<'ALL' | 'OPERATIVA_CHICAS' | 'GERENCIAL_MAYRA' | 'COBRANZA'>(
    isAsistente ? 'OPERATIVA_CHICAS' : 'ALL'
  );
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Mensajes en vivo del chat seleccionado
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);

  // Consultar estado de la cola de envíos masivos (solo si no es ASISTENTE)
  const fetchQueueStatus = async () => {
    if (!token || isAsistente) return;
    try {
      const res = await fetch('/api/whatsapp/queue-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQueueStatus(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token && !isAsistente) {
      fetchQueueStatus();
      const interval = setInterval(fetchQueueStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [token, isAsistente]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  // Consultar chats desde el backend
  const fetchChats = async () => {
    if (!token) return;
    try {
      const q = activeQueue !== 'ALL' ? `?queue=${activeQueue}` : '';
      const res = await fetch(`/api/whatsapp/chats${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChats(data.data || []);
        if (!selectedChat && data.data?.length > 0) {
          setSelectedChat(data.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) fetchChats();
  }, [token, activeQueue]);

  // Conexión WebSocket para tiempo real
  useEffect(() => {
    const socket = io('http://localhost:4000', {
      transports: ['websocket', 'polling'],
    });

    socket.on('whatsapp:new-message', (data: any) => {
      // Si el mensaje corresponde al chat abierto
      if (selectedChat && selectedChat.whatsappPhone.includes(data.phone.slice(-8))) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            sender: 'client',
            text: data.incomingMessage,
            timestamp: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
          },
          {
            id: String(Date.now() + 1),
            sender: 'bot',
            text: data.botReply,
            timestamp: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }

      fetchChats();
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedChat]);

  // Cargar mensajes reales desde la BD al seleccionar un chat
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (!selectedChat || !token) return;

    let isMounted = true;
    setLoadingMessages(true);

    fetch(`/api/whatsapp/messages/${selectedChat.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const mapped: LiveMessage[] = data.data.map((m: any) => ({
            id: String(m.id),
            sender: m.senderType === 'CLIENT' ? 'client' : m.senderType === 'BOT' ? 'bot' : 'agent',
            text: m.content,
            timestamp: new Date(m.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
            mediaType: m.mediaType,
            mediaUrl: m.mediaUrl,
            fileName: m.fileName,
          }));
          setMessages(mapped);
        } else {
          // Fallback al extracto inicial si aún no hay mensajes en ChatMessage
          setMessages([
            {
              id: '1',
              sender: 'client',
              text: selectedChat.subject.replace(/^.*?: "/, '').replace(/"$/, ''),
              timestamp: new Date(selectedChat.updatedAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      })
      .catch((err) => {
        console.error('Error cargando mensajes reales:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedChat, token]);

  // Enviar respuesta manual desde el CRM
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedChat || !replyText.trim()) return;
    setSending(true);

    const textToSend = replyText.trim();
    setReplyText('');

    // Actualización optimista
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'agent',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    try {
      await fetch('/api/whatsapp/send-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: selectedChat.whatsappPhone,
          message: textToSend,
          ticketId: selectedChat.id,
        }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter((c) => {
    const q = searchFilter.toLowerCase();
    const name = c.clientOwner?.fullName.toLowerCase() || '';
    const phone = c.whatsappPhone;
    const subject = c.subject.toLowerCase();
    return name.includes(q) || phone.includes(q) || subject.includes(q);
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#166BA3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] pb-8 flex flex-col md:pl-64">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex-1 flex flex-col w-full">
        {/* Cabecera institucional limpia */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#1E2A3C] tracking-tight flex items-center gap-2">
              <MessageSquare className="text-[#166BA3]" size={22} />
              Bandeja de Atención WhatsApp
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Gestión de requerimientos y soporte continuo a contribuyentes
            </p>
          </div>

          <div className="flex items-center gap-2">
            {queueStatus && (
              <span
                title={queueStatus.isWorkingHours ? 'Horario laboral activo (08:30-19:00)' : 'Fuera de horario laboral (pausado)'}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  queueStatus.totalPending > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                <Clock size={12} />
                Cola: {queueStatus.totalPending} pendientes ({queueStatus.isWorkingHours ? '⚡ En curso' : '🌙 En espera'})
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Canal Oficial Activo
            </span>
          </div>
        </div>

        {/* Panel Estilo CRM Corporativo (3 Columnas Proporcionales) */}
        <div className="bg-white/95 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl overflow-hidden flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[640px]">
          
          {/* ═══════════════ COLUMNA 1: LISTA DE BANDEJAS Y CONVERSACIONES (4 Cols) ═══════════════ */}
          <div className="md:col-span-4 border-r border-gray-100 flex flex-col h-full bg-gray-50/40">
            {/* Filtros de colas operativas */}
            <div className="p-3.5 border-b border-gray-100 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Bandejas de Atención
                </span>
                <span className="text-[11px] font-mono font-bold bg-gray-100 text-[#1E2A3C] px-2 py-0.5 rounded-md">
                  {filteredChats.length} {filteredChats.length === 1 ? 'caso' : 'casos'}
                </span>
              </div>

              {/* Botones de Colas */}
              <div className={`grid gap-1.5 text-xs font-semibold ${isAsistente ? 'grid-cols-1' : 'grid-cols-3'}`}>
                <button
                  type="button"
                  onClick={() => setActiveQueue('OPERATIVA_CHICAS')}
                  className={`py-2 px-2.5 rounded-xl transition-all text-center ${
                    activeQueue === 'OPERATIVA_CHICAS'
                      ? 'bg-[#166BA3] text-white shadow-xs'
                      : 'bg-gray-100/80 text-gray-700 hover:bg-gray-200/80'
                  }`}
                >
                  Operativa
                </button>
                {!isAsistente && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveQueue('GERENCIAL_MAYRA')}
                      className={`py-2 px-2.5 rounded-xl transition-all text-center ${
                        activeQueue === 'GERENCIAL_MAYRA'
                          ? 'bg-[#1E2A3C] text-white shadow-xs'
                          : 'bg-gray-100/80 text-gray-700 hover:bg-gray-200/80'
                      }`}
                    >
                      Gerencia
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveQueue('COBRANZA')}
                      className={`py-2 px-2.5 rounded-xl transition-all text-center ${
                        activeQueue === 'COBRANZA'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-gray-100/80 text-gray-700 hover:bg-gray-200/80'
                      }`}
                    >
                      Cobranza
                    </button>
                  </>
                )}
              </div>

              {/* Buscador de cliente/teléfono */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar contribuyente o teléfono..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs text-[#1E2A3C] bg-white focus:outline-none focus:ring-1 focus:ring-[#166BA3]"
                />
              </div>
            </div>

            {/* Lista de Conversaciones */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredChats.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                  <Inbox size={28} className="mx-auto opacity-40" />
                  <p>No se encontraron conversaciones activas en esta sección.</p>
                </div>
              ) : (
                filteredChats.map((c) => {
                  const isSelected = selectedChat?.id === c.id;
                  const displayName = c.clientOwner?.fullName || c.whatsappPhone;
                  const firstLetter = displayName.charAt(0).toUpperCase();

                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedChat(c)}
                      className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 ${
                        isSelected
                          ? 'bg-blue-50/80 border-l-3 border-[#166BA3]'
                          : 'hover:bg-white/80'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-[#1E2A3C] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {firstLetter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold text-xs text-[#1E2A3C] truncate">
                            {displayName}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {new Date(c.updatedAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mb-1">
                          {c.subject}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {c.queueType === 'OPERATIVA_CHICAS' ? 'Operativa' : c.queueType === 'GERENCIAL_MAYRA' ? 'Gerencia' : 'Cobranza'}
                          </span>
                          <span className="text-[9px] font-mono text-gray-400">
                            {c.whatsappPhone}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ═══════════════ COLUMNA 2: CHAT ACTIVO (5 Cols) ═══════════════ */}
          <div className="md:col-span-5 flex flex-col h-full bg-[#F8FAFC]">
            {selectedChat ? (
              <>
                {/* Cabecera del Chat Activo */}
                <div className="p-3.5 px-5 bg-white border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#166BA3]/10 text-[#166BA3] flex items-center justify-center font-bold text-xs">
                      {selectedChat.clientOwner?.fullName.charAt(0) || 'C'}
                    </div>
                    <div>
                      {selectedChat.clientOwner?.id ? (
                        <Link
                          href={`/clientes/${selectedChat.clientOwner.id}`}
                          className="font-bold text-xs text-[#166BA3] hover:underline flex items-center gap-1"
                          title="Ver perfil completo del cliente"
                        >
                          {selectedChat.clientOwner.fullName}
                          <ExternalLink size={10} />
                        </Link>
                      ) : (
                        <h2 className="font-bold text-xs text-[#1E2A3C]">
                          {selectedChat.clientOwner?.fullName || selectedChat.whatsappPhone}
                        </h2>
                      )}
                      <p className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                        <Phone size={10} className="text-gray-400" />
                        {selectedChat.whatsappPhone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        selectedChat.botPaused
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {selectedChat.botPaused ? '👤 Atención Humana' : '🤖 Bot Activo'}
                    </span>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!token || !selectedChat) return;
                        const nextState = !selectedChat.botPaused;
                        await fetch(`/api/whatsapp/tickets/${selectedChat.id}/toggle-bot`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ botPaused: nextState }),
                        });
                        setSelectedChat({ ...selectedChat, botPaused: nextState });
                        fetchChats();
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all"
                    >
                      {selectedChat.botPaused ? 'Reactivar Bot' : 'Pausar Bot'}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!token || !selectedChat) return;
                        if (!confirm('¿Desea cerrar el ticket y reactivar el bot para futuros mensajes?')) return;
                        await fetch(`/api/whatsapp/tickets/${selectedChat.id}/toggle-bot`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ closeTicket: true }),
                        });
                        setSelectedChat(null);
                        fetchChats();
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#166BA3] text-white hover:bg-[#135887] transition-all"
                    >
                      ✓ Cerrar Ticket
                    </button>
                  </div>
                </div>

                {/* Historial de Mensajes */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.map((m) => {
                    const isClient = m.sender === 'client';
                    const isBot = m.sender === 'bot';

                    return (
                      <div
                        key={m.id}
                        className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-xl p-3 text-xs shadow-2xs ${
                            isClient
                              ? 'bg-white text-[#1E2A3C] border border-gray-200/70'
                              : isBot
                              ? 'bg-slate-50 text-[#1E2A3C] border border-slate-200'
                              : 'bg-[#1E2A3C] text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1 text-[10px] font-semibold mb-1 opacity-70">
                            {isClient ? (
                              <span>Contribuyente</span>
                            ) : isBot ? (
                              <span className="flex items-center gap-1 text-[#166BA3]">
                                <Bot size={11} /> Respuesta Automática
                              </span>
                            ) : (
                              <span>Estudio Contable</span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>

                          {/* Renderizado multimedia */}
                          {m.mediaType === 'AUDIO' && m.mediaUrl && (
                            <div className="mt-2 pt-2 border-t border-gray-100/60">
                              <p className="text-[10px] text-gray-500 font-semibold mb-1 flex items-center gap-1">
                                🎙️ Nota de voz recibida
                              </p>
                              <audio controls className="w-full h-8" preload="metadata">
                                <source src={m.mediaUrl} />
                                Su navegador no soporta reproducción de audio.
                              </audio>
                            </div>
                          )}

                          {m.mediaType === 'IMAGE' && m.mediaUrl && (
                            <div className="mt-2">
                              <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-gray-200 hover:opacity-95 transition-opacity">
                                <img
                                  src={m.mediaUrl}
                                  alt={m.fileName || 'Imagen adjunta'}
                                  className="max-h-56 w-auto object-cover rounded-lg"
                                />
                              </a>
                            </div>
                          )}

                          {m.mediaType === 'DOCUMENT' && m.mediaUrl && (
                            <div className="mt-2">
                              <a
                                href={m.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#166BA3] font-semibold text-[11px] transition-colors"
                              >
                                <FileText size={16} />
                                <span className="truncate">{m.fileName || 'Descargar Documento PDF'}</span>
                                <ExternalLink size={12} className="ml-auto opacity-70" />
                              </a>
                            </div>
                          )}

                          <div className="text-[9px] opacity-60 text-right mt-1.5 flex items-center justify-end gap-1">
                            <span className="font-mono">{m.timestamp}</span>
                            {!isClient && <CheckCheck size={11} className="text-blue-300" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Caja de Redacción de Mensaje */}
                <form
                  onSubmit={handleSendReply}
                  className="p-3 bg-white border-t border-gray-100 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escribir mensaje al contribuyente..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] placeholder:text-gray-400 focus:ring-1 focus:ring-[#166BA3] focus:border-[#166BA3] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className="bg-[#166BA3] text-white px-4 py-2.5 rounded-xl hover:bg-[#135887] active:scale-95 transition-all shadow-xs disabled:opacity-40 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Send size={14} />
                    <span>Enviar</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs space-y-2 p-6">
                <MessageSquare size={32} className="opacity-30" />
                <p>Selecciona una conversación del listado lateral para comenzar.</p>
              </div>
            )}
          </div>

          {/* ═══════════════ COLUMNA 3: EXPEDIENTE TRIBUTARIO DEL CLIENTE (3 Cols) ═══════════════ */}
          <div className="md:col-span-3 border-l border-gray-100 p-4 bg-white hidden lg:flex flex-col space-y-4">
            <h2 className="font-bold text-xs text-[#1E2A3C] flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <User size={14} className="text-[#166BA3]" />
              Ficha del Contribuyente
            </h2>

            {selectedChat?.clientOwner ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                    Cliente Titular
                  </span>
                  <p className="font-bold text-[#1E2A3C] mt-0.5">
                    {selectedChat.clientOwner.fullName}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">
                    Razón Social / RUC
                  </span>
                  <div className="space-y-2">
                    {selectedChat.clientOwner.taxpayers.map((t) => (
                      <div key={t.id} className="p-2.5 bg-gray-50/70 rounded-xl border border-gray-200/60 space-y-1">
                        <span className="font-semibold text-[#1E2A3C] block truncate text-xs">
                          {t.razonSocial}
                        </span>
                        <span className="text-[11px] font-mono text-gray-600 block">
                          RUC: {t.ruc || 'No registrado'}
                        </span>
                        {t.claveSri && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 mt-1">
                            <Key size={10} />
                            <span className="font-mono">Clave SRI: {t.claveSri}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">
                    Documentos en Bóveda
                  </span>
                  <div className="space-y-1.5">
                    {selectedChat.clientOwner.taxpayers.flatMap((t) => t.documents).slice(0, 4).map((d) => (
                      <a
                        key={d.id}
                        href={d.bunnyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-[11px] font-medium text-[#1E2A3C] border border-gray-200/60 flex items-center justify-between group transition-colors"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <FileText size={12} className="text-[#166BA3]" />
                          {d.title}
                        </span>
                        <ExternalLink size={11} className="text-gray-400 group-hover:text-[#166BA3]" />
                      </a>
                    ))}
                    {selectedChat.clientOwner.taxpayers.flatMap((t) => t.documents).length === 0 && (
                      <p className="text-[11px] text-gray-400 italic">Sin archivos adjuntos recientes.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-xs flex flex-col items-center justify-center py-10 text-center space-y-1">
                <Shield size={24} className="opacity-30" />
                <p>Número no vinculado a ficha permanente.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function WhatsAppPage() {
  return (
    <AuthProvider>
      <WhatsAppView />
    </AuthProvider>
  );
}
