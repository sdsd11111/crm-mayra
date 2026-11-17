// frontend/src/app/whatsapp/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { io } from 'socket.io-client';
import {
  MessageSquare,
  Send,
  User,
  Clock,
  CheckCheck,
  Bot,
  Phone,
  FileText,
  Key,
  Shield,
  Search,
  ExternalLink,
  Inbox,
  Sparkles,
  Info,
  ChevronLeft,
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

  const isAsistente = user?.role === 'ASISTENTE';
  const [activeQueue, setActiveQueue] = useState<'ALL' | 'OPERATIVA_CHICAS' | 'GERENCIAL_MAYRA' | 'COBRANZA'>(
    isAsistente ? 'OPERATIVA_CHICAS' : 'ALL'
  );
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  useEffect(() => {
    const socket = io('http://localhost:4000', {
      transports: ['websocket', 'polling'],
    });

    socket.on('whatsapp:new-message', (data: any) => {
      const phoneMatch =
        selectedChat &&
        (data.clientPhone?.includes(selectedChat.whatsappPhone.slice(-8)) ||
          data.phone?.includes(selectedChat.whatsappPhone.slice(-8)));

      if (phoneMatch) {
        if (data.message) {
          const m = data.message;
          const senderType =
            m.senderType === 'CLIENT' || m.sender === 'CLIENT'
              ? 'client'
              : m.senderType === 'BOT' || m.sender === 'BOT' || m.sender === 'SYSTEM'
              ? 'bot'
              : 'agent';

          setMessages((prev) => [
            ...prev,
            {
              id: String(m.id || Date.now()),
              sender: senderType,
              text: m.content || '',
              timestamp: new Date(m.createdAt || Date.now()).toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              mediaType: m.mediaType,
              mediaUrl: m.mediaUrl,
              fileName: m.fileName,
            },
          ]);
        } else if (data.incomingMessage || data.botReply) {
          if (data.incomingMessage) {
            setMessages((prev) => [
              ...prev,
              {
                id: String(Date.now()),
                sender: 'client',
                text: data.incomingMessage,
                timestamp: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
          if (data.botReply) {
            const botText = typeof data.botReply === 'string' ? data.botReply : data.botReply.content;
            if (botText) {
              setMessages((prev) => [
                ...prev,
                {
                  id: String(Date.now() + 1),
                  sender: 'bot',
                  text: botText,
                  timestamp: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
            }
          }
        }
      }

      fetchChats();
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedChat]);

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
            sender:
              m.senderType === 'CLIENT' || m.sender === 'CLIENT'
                ? 'client'
                : m.senderType === 'BOT' || m.sender === 'BOT' || m.sender === 'SYSTEM'
                ? 'bot'
                : 'agent',
            text: m.content,
            timestamp: new Date(m.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
            mediaType: m.mediaType,
            mediaUrl: m.mediaUrl,
            fileName: m.fileName,
          }));
          setMessages(mapped);
        } else {
          setMessages([
            {
              id: '1',
              sender: 'client',
              text: selectedChat.subject.replace(/^.*?: "/, '').replace(/"$/, ''),
              timestamp: new Date(selectedChat.updatedAt).toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
              }),
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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedChat || !replyText.trim()) return;
    setSending(true);

    const textToSend = replyText.trim();
    setReplyText('');

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
      <div className="h-screen bg-[#F0F2F5] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#00a884] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const clientName = selectedChat?.clientOwner?.fullName || selectedChat?.whatsappPhone || 'Chat';

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col md:pl-64 bg-[#EFEAE2]">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* ═══════════════ COLUMNA 1: LISTA DE CHATS (WhatsApp Web Style) ═══════════════ */}
        <aside className="w-80 sm:w-96 border-r border-[#E9EDEF] bg-white flex flex-col h-full shrink-0 z-10 shadow-xs">
          {/* Header Superior del Chat List */}
          <div className="p-3 bg-[#F0F2F5] border-b border-[#E9EDEF] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#166BA3] text-white flex items-center justify-center font-bold text-xs">
                {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'M'}
              </div>
              <span className="font-bold text-xs text-[#1E2A3C] tracking-tight">Centro WhatsApp</span>
            </div>

            {queueStatus && (
              <span
                title={queueStatus.isWorkingHours ? 'Horario laboral activo (08:30-19:00)' : 'Fuera de horario laboral'}
                className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
              >
                ● En Línea
              </span>
            )}
          </div>

          {/* Filtros de Bandejas */}
          <div className="p-2 border-b border-[#E9EDEF] bg-white">
            <div className={`grid gap-1 text-[11px] font-semibold ${isAsistente ? 'grid-cols-1' : 'grid-cols-3'}`}>
              <button
                type="button"
                onClick={() => setActiveQueue('OPERATIVA_CHICAS')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  activeQueue === 'OPERATIVA_CHICAS'
                    ? 'bg-[#00a884] text-white font-bold shadow-xs'
                    : 'bg-[#F0F2F5] text-gray-700 hover:bg-[#E9EDEF]'
                }`}
              >
                Operativa
              </button>
              {!isAsistente && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveQueue('GERENCIAL_MAYRA')}
                    className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                      activeQueue === 'GERENCIAL_MAYRA'
                        ? 'bg-[#1E2A3C] text-white font-bold shadow-xs'
                        : 'bg-[#F0F2F5] text-gray-700 hover:bg-[#E9EDEF]'
                    }`}
                  >
                    Gerencia
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveQueue('COBRANZA')}
                    className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                      activeQueue === 'COBRANZA'
                        ? 'bg-[#E59819] text-white font-bold shadow-xs'
                        : 'bg-[#F0F2F5] text-gray-700 hover:bg-[#E9EDEF]'
                    }`}
                  >
                    Cobranza
                  </button>
                </>
              )}
            </div>

            {/* Buscador */}
            <div className="relative mt-2">
              <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar o empezar un chat..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#F0F2F5] text-xs text-[#1E2A3C] placeholder:text-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884] transition-all"
              />
            </div>
          </div>

          {/* Listado de Contactos / Chats */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F0F2F5]">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                <Inbox size={28} className="mx-auto opacity-40" />
                <p>No hay conversaciones activas.</p>
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
                    className={`w-full p-3 text-left transition-colors flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[#F0F2F5] border-l-4 border-[#00a884]'
                        : 'hover:bg-[#F5F6F6] bg-white'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-[#DFE5E7] text-[#54656F] flex items-center justify-center font-bold text-sm shrink-0">
                      {firstLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs text-[#111B21] truncate">
                          {displayName}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(c.updatedAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {c.subject}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                          c.queueType === 'OPERATIVA_CHICAS' ? 'bg-emerald-50 text-emerald-700' :
                          c.queueType === 'GERENCIAL_MAYRA' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {c.queueType === 'OPERATIVA_CHICAS' ? 'Operativa' : c.queueType === 'GERENCIAL_MAYRA' ? 'Gerencia' : 'Cobranza'}
                        </span>
                        {c.botPaused && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                            Humano
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ═══════════════ COLUMNA 2: ÁREA DE MENSAJES (ESTILO CHAT REAL) ═══════════════ */}
        <main className="flex-1 flex flex-col h-full bg-[#EFEAE2] relative overflow-hidden">
          {selectedChat ? (
            <>
              {/* Header de la conversación */}
              <header className="h-14 px-4 bg-[#F0F2F5] border-b border-[#E9EDEF] flex items-center justify-between shrink-0 shadow-2xs z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#DFE5E7] text-[#54656F] flex items-center justify-center font-bold text-sm">
                    {clientName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-bold text-xs text-[#111B21] flex items-center gap-1.5">
                      {clientName}
                      {selectedChat.clientOwner?.isVip && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                          VIP
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                      <Phone size={10} className="text-gray-400" />
                      {selectedChat.whatsappPhone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                      selectedChat.botPaused
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    {selectedChat.botPaused ? '👤 Atención Humana' : '⚡ Asistente Virtual'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                    className="p-2 rounded-lg text-gray-600 hover:bg-[#E9EDEF] transition-colors"
                    title="Ver Ficha del Contribuyente"
                  >
                    <Info size={18} />
                  </button>
                </div>
              </header>

              {/* Contenedor de burbujas de chat con fondo de WhatsApp */}
              <div
                className="flex-1 p-4 overflow-y-auto space-y-2.5"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.03' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
                }}
              >
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  messages.map((m) => {
                    const isClient = m.sender === 'client';
                    const isBot = m.sender === 'bot';

                    return (
                      <div
                        key={m.id}
                        className={`flex w-full ${isClient ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-xs shadow-xs relative ${
                            isClient
                              ? 'bg-white text-[#111B21] rounded-tl-none'
                              : isBot
                              ? 'bg-[#E7F8E8] text-[#111B21] border border-[#C6ECC7] rounded-tr-none'
                              : 'bg-[#D9FDD3] text-[#111B21] rounded-tr-none'
                          }`}
                        >
                          {/* Etiqueta de quién envía */}
                          <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
                            {isClient ? (
                              <span className="text-[#166BA3] flex items-center gap-1">
                                <User size={10} /> {clientName}
                              </span>
                            ) : isBot ? (
                              <span className="text-[#00a884] flex items-center gap-1 font-bold">
                                <Bot size={11} /> Asistente Virtual (Bot)
                              </span>
                            ) : (
                              <span className="text-[#1E2A3C] flex items-center gap-1 font-bold">
                                <Sparkles size={10} /> Estudio Contable (Humano)
                              </span>
                            )}
                          </div>

                          <p className="whitespace-pre-wrap leading-relaxed text-[12px]">{m.text}</p>

                          {/* Media attachments */}
                          {m.mediaType === 'AUDIO' && m.mediaUrl && (
                            <div className="mt-2 pt-1 border-t border-gray-200">
                              <audio controls className="w-full h-8" preload="metadata">
                                <source src={m.mediaUrl} />
                              </audio>
                            </div>
                          )}

                          {m.mediaType === 'IMAGE' && m.mediaUrl && (
                            <div className="mt-2">
                              <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={m.mediaUrl}
                                  alt={m.fileName || 'Imagen'}
                                  className="max-h-60 w-auto object-cover rounded-md border border-gray-200 hover:opacity-90 transition-opacity"
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
                                className="flex items-center gap-2 p-2 rounded bg-white/80 hover:bg-white border border-gray-300 text-[#166BA3] font-semibold text-[11px]"
                              >
                                <FileText size={14} />
                                <span className="truncate">{m.fileName || 'Documento PDF'}</span>
                                <ExternalLink size={11} className="ml-auto opacity-70" />
                              </a>
                            </div>
                          )}

                          {/* Hora y ticks */}
                          <div className="text-[9px] text-[#667781] text-right mt-1 flex items-center justify-end gap-1 font-mono">
                            <span>{m.timestamp}</span>
                            {!isClient && <CheckCheck size={12} className="text-[#53bdeb]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra inferior de escritura de mensaje (Estilo WhatsApp) */}
              <footer className="p-2.5 bg-[#F0F2F5] border-t border-[#E9EDEF] flex items-center gap-2 shrink-0">
                <form onSubmit={handleSendReply} className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escribe un mensaje aquí..."
                    className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-transparent text-xs text-[#111B21] placeholder:text-gray-500 focus:outline-none focus:border-[#00a884] shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className="p-2.5 rounded-full bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95 disabled:opacity-40 transition-all shadow-xs"
                    title="Enviar Mensaje"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs space-y-2 p-6 bg-[#F0F2F5]">
              <MessageSquare size={48} className="opacity-20 text-[#1E2A3C]" />
              <p className="font-semibold text-gray-600 text-sm">WhatsApp Web · Estudio Contable Mayra Castillo</p>
              <p className="text-gray-400">Selecciona un chat del panel izquierdo para comenzar a responder.</p>
            </div>
          )}
        </main>

        {/* ═══════════════ COLUMNA 3: FICHA LATERAL RETRÁCTIL DEL CLIENTE ═══════════════ */}
        {showInfoSidebar && selectedChat && (
          <aside className="w-80 border-l border-[#E9EDEF] bg-white flex flex-col h-full shrink-0 shadow-xs z-10 animate-in slide-in-from-right duration-150">
            <div className="p-3 bg-[#F0F2F5] border-b border-[#E9EDEF] flex items-center justify-between">
              <span className="font-bold text-xs text-[#1E2A3C] flex items-center gap-1.5">
                <User size={14} className="text-[#166BA3]" />
                Datos del Contribuyente
              </span>
              <button
                type="button"
                onClick={() => setShowInfoSidebar(false)}
                className="p-1 rounded text-gray-500 hover:bg-[#E9EDEF]"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
              {selectedChat.clientOwner ? (
                <>
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                      Titular
                    </span>
                    <p className="font-bold text-sm text-[#1E2A3C] mt-0.5">
                      {selectedChat.clientOwner.fullName}
                    </p>
                    <Link
                      href={`/clientes/${selectedChat.clientOwner.id}`}
                      className="text-[11px] text-[#166BA3] font-semibold hover:underline flex items-center gap-1 mt-1"
                    >
                      Ver perfil completo <ExternalLink size={10} />
                    </Link>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">
                      RUCs Registrados
                    </span>
                    <div className="space-y-2">
                      {selectedChat.clientOwner.taxpayers.map((t) => (
                        <div key={t.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                          <span className="font-semibold text-[#1E2A3C] block truncate text-xs">
                            {t.razonSocial}
                          </span>
                          <span className="text-[11px] font-mono text-gray-600 block">
                            RUC: {t.ruc || 'No registrado'}
                          </span>
                          {t.claveSri && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1">
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
                      Archivos Recientes
                    </span>
                    <div className="space-y-1">
                      {selectedChat.clientOwner.taxpayers.flatMap((t) => t.documents).slice(0, 4).map((d) => (
                        <a
                          key={d.id}
                          href={d.bunnyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-gray-50 hover:bg-gray-100 rounded text-[11px] font-medium text-[#1E2A3C] border border-gray-200 flex items-center justify-between transition-colors"
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <FileText size={12} className="text-[#166BA3]" />
                            {d.title}
                          </span>
                          <ExternalLink size={10} className="text-gray-400 shrink-0 ml-1" />
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Shield size={28} className="mx-auto opacity-30 mb-2" />
                  <p>Número no registrado formalmente como cliente.</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  return <WhatsAppView />;
}
