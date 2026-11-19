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
  ChevronRight,
  Plus,
  Paperclip,
  Mic,
  Square,
  Video,
  X,
  Upload,
  Archive,
  Share2,
  Image as ImageIcon,
  Link2,
  Download,
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
  mediaType?: 'AUDIO' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | null;
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

  // Estados para grabación de voz PTT y subida de archivos
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Estado para la pestaña activa en el panel lateral de información (WhatsApp Web Style)
  const [sidebarTab, setSidebarTab] = useState<'MEDIA' | 'DOCS' | 'LINKS' | 'INFO'>('MEDIA');

  // Interfaz y Estado para Carrusel Multi-Archivo antes de Enviar (WhatsApp Web Multi-Media Carousel)
  const [pendingFiles, setPendingFiles] = useState<{
    id: string;
    file: File;
    previewUrl: string;
    mediaType: 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    caption: string;
  }[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  // Estado del modal "Guardar en Bóveda" (desde mensaje de chat)
  const [bovedaModal, setBovedaModal] = useState<{
    open: boolean;
    messageId: string | null;
    mediaUrl: string | null;
    fileName: string | null;
  }>({ open: false, messageId: null, mediaUrl: null, fileName: null });
  const [bovedaForm, setBovedaForm] = useState({
    taxpayerId: '',
    category: 'OTRO',
    title: '',
    periodYear: String(new Date().getFullYear()),
    periodMonth: '',
  });
  const [bovedaSaving, setBovedaSaving] = useState(false);
  const [bovedaError, setBovedaError] = useState<string | null>(null);

  // Estado para "Enviando por WhatsApp" desde sidebar Bóveda
  const [sendingBovedaDoc, setSendingBovedaDoc] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Enviar documento de Bóveda Digital por WhatsApp ──
  const handleSendBovedaDoc = async (docId: number, bunnyUrl: string, fileName: string) => {
    if (!selectedChat || !token) return;
    setSendingBovedaDoc(docId);
    try {
      const res = await fetch('/api/whatsapp/send-media-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: selectedChat.whatsappPhone,
          ticketId: selectedChat.id,
          mediaUrl: bunnyUrl,
          fileName,
          caption: `📂 Documento: ${fileName}`,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Error al enviar');
    } catch (err: any) {
      alert(`Error enviando documento: ${err.message}`);
    } finally {
      setSendingBovedaDoc(null);
    }
  };

  // ── Guardar archivo de chat en Bóveda Digital ──
  const handleSaveToBovedaSubmit = async () => {
    if (!bovedaModal.messageId || !token) return;
    if (!bovedaForm.taxpayerId || !bovedaForm.title) {
      setBovedaError('Debes seleccionar empresa y poner un título.');
      return;
    }
    setBovedaSaving(true);
    setBovedaError(null);
    try {
      const res = await fetch('/api/documents/from-chat-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatMessageId: bovedaModal.messageId,
          taxpayerId: bovedaForm.taxpayerId,
          category: bovedaForm.category,
          title: bovedaForm.title,
          periodYear: bovedaForm.periodYear,
          periodMonth: bovedaForm.periodMonth || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Error al guardar');
      setBovedaModal({ open: false, messageId: null, mediaUrl: null, fileName: null });
      setBovedaForm({ taxpayerId: '', category: 'OTRO', title: '', periodYear: String(new Date().getFullYear()), periodMonth: '' });
    } catch (err: any) {
      setBovedaError(err.message);
    } finally {
      setBovedaSaving(false);
    }
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

  // ── Grabación de Notas de Voz PTT ──
  const startRecording = async () => {
    if (!selectedChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Determinar mimeType compatible (ogg o webm con Opus)
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
        ? 'audio/ogg; codecs=opus'
        : 'audio/webm; codecs=opus';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleSendAudioBlob(audioBlob);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
      alert('No se pudo acceder al micrófono. Por favor habilita los permisos en tu navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const handleSendAudioBlob = async (blob: Blob) => {
    if (!selectedChat || !token) return;
    setSending(true);

    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    const fileName = `nota_voz_${Date.now()}.${ext}`;
    const file = new File([blob], fileName, { type: blob.type });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('phone', selectedChat.whatsappPhone);
    formData.append('ticketId', String(selectedChat.id));
    formData.append('isPtt', 'true');

    // Feedback visual optimista
    const localUrl = URL.createObjectURL(blob);
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'agent',
        text: '🎤 [Nota de voz enviada]',
        mediaType: 'AUDIO',
        mediaUrl: localUrl,
        timestamp: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    try {
      await fetch('/api/whatsapp/send-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    } catch (err) {
      console.error('Error enviando nota de voz:', err);
    } finally {
      setSending(false);
    }
  };

  // ── Preparar archivos para Carrusel de Previsualización (WhatsApp Multi-Media) ──
  const stageFilesForPreview = (files: FileList | File[]) => {
    if (!files || files.length === 0 || !selectedChat) return;

    const newItems = Array.from(files).map((file, idx) => {
      let detectedMediaType: 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'DOCUMENT';
      if (file.type.startsWith('image/')) detectedMediaType = 'IMAGE';
      else if (file.type.startsWith('video/')) detectedMediaType = 'VIDEO';
      else if (file.type.startsWith('audio/')) detectedMediaType = 'AUDIO';

      return {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType: detectedMediaType,
        caption: '',
      };
    });

    setPendingFiles((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0) {
        setActivePreviewIndex(0);
      } else {
        setActivePreviewIndex(prev.length); // enfocar el primer ítem recién añadido
      }
      return updated;
    });
  };

  // ── Cancelar todo el lote y revocar URLs ──
  const handleCancelAllPendingFiles = () => {
    pendingFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingFiles([]);
    setActivePreviewIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Eliminar un archivo específico del carrusel ──
  const handleRemoveSinglePendingFile = (indexToRemove: number) => {
    setPendingFiles((prev) => {
      const itemToRemove = prev[indexToRemove];
      if (itemToRemove) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      const nextList = prev.filter((_, idx) => idx !== indexToRemove);
      if (nextList.length === 0) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return [];
      }
      if (activePreviewIndex >= nextList.length) {
        setActivePreviewIndex(nextList.length - 1);
      }
      return nextList;
    });
  };

  // ── Actualizar el caption del archivo activo ──
  const handleUpdateActiveCaption = (caption: string) => {
    setPendingFiles((prev) =>
      prev.map((item, idx) => (idx === activePreviewIndex ? { ...item, caption } : item))
    );
  };

  // ── Confirmar y Enviar todos los archivos del carrusel en cola secuencial ──
  const handleConfirmSendPendingFiles = async () => {
    if (pendingFiles.length === 0 || !selectedChat || !token) return;

    const filesToSend = [...pendingFiles];
    // Cerrar modal y resetear estado
    setPendingFiles([]);
    setActivePreviewIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadingMedia(true);

    try {
      // Despacho secuencial para respetar orden y no saturar socket/API
      for (const item of filesToSend) {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('phone', selectedChat.whatsappPhone);
        formData.append('ticketId', String(selectedChat.id));
        if (item.caption.trim()) {
          formData.append('caption', item.caption.trim());
        }

        // Inserción optimista en el chat
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + Math.random()),
            sender: 'agent',
            text: item.caption.trim() ? item.caption.trim() : `[Archivo: ${item.file.name}]`,
            mediaType: item.mediaType,
            mediaUrl: item.previewUrl,
            fileName: item.file.name,
            timestamp: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        await fetch('/api/whatsapp/send-media', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        // Pausa breve de 250ms entre mensajes del lote
        if (filesToSend.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    } catch (err) {
      console.error('Error enviando archivos multimedia en lote:', err);
    } finally {
      setUploadingMedia(false);
      // Revocar blobs tras envío
      filesToSend.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    }
  };

  // ── Subida de Archivos Multimedia (Imágenes, Videos, PDFs) ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      stageFilesForPreview(files);
    }
  };

  // ── Drag & Drop de Archivos en el Chat ──
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      // Abre en carrusel los archivos arrastrados (soporta 1 o múltiples)
      stageFilesForPreview(files);
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

  // ── Extraer enlaces de los mensajes de texto ──
  const extractLinksFromMessages = () => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links: { url: string; timestamp: string; sender: string }[] = [];
    messages.forEach((m) => {
      const matches = m.text.match(urlRegex);
      if (matches) {
        matches.forEach((url) => {
          links.push({
            url,
            timestamp: m.timestamp,
            sender: m.sender,
          });
        });
      }
    });
    return links;
  };

  const clientName = selectedChat?.clientOwner?.fullName || selectedChat?.whatsappPhone || 'Chat';

  return (
    <>
      <div className="h-[100dvh] w-full overflow-hidden flex flex-col md:pl-64 bg-[#EFEAE2]">
        <Navbar />

        <div className="flex-1 flex overflow-hidden relative">
          {/* ═══════════════ COLUMNA 1: LISTA DE CHATS (WhatsApp Web Style) ═══════════════ */}
          <aside className={`
          ${selectedChat ? 'hidden md:flex' : 'flex'}
          w-full md:w-80 lg:w-96
          border-r border-[#E9EDEF] bg-white flex-col h-full shrink-0 z-10 shadow-xs
        `}>
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
                  className={`py-1.5 px-2 rounded-lg transition-all text-center ${activeQueue === 'OPERATIVA_CHICAS'
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
                      className={`py-1.5 px-2 rounded-lg transition-all text-center ${activeQueue === 'GERENCIAL_MAYRA'
                        ? 'bg-[#1E2A3C] text-white font-bold shadow-xs'
                        : 'bg-[#F0F2F5] text-gray-700 hover:bg-[#E9EDEF]'
                        }`}
                    >
                      Gerencia
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveQueue('COBRANZA')}
                      className={`py-1.5 px-2 rounded-lg transition-all text-center ${activeQueue === 'COBRANZA'
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
                      className={`w-full p-3 text-left transition-colors flex items-center gap-3 ${isSelected
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
                          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${c.queueType === 'OPERATIVA_CHICAS' ? 'bg-emerald-50 text-emerald-700' :
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
          <main
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
          ${selectedChat ? 'flex' : 'hidden md:flex'}
          flex-1 flex-col h-full bg-[#EFEAE2] relative overflow-hidden
        `}>
            {/* Overlay Drag & Drop visual cuando se arrastra un archivo */}
            {isDraggingFile && selectedChat && (
              <div className="absolute inset-0 z-40 bg-[#166BA3]/85 backdrop-blur-xs flex flex-col items-center justify-center text-white animate-in fade-in duration-150 border-4 border-dashed border-white/60 m-2 rounded-2xl pointer-events-none">
                <Upload size={54} className="mb-3 animate-bounce" />
                <h3 className="text-lg font-bold">Suelta los archivos aquí</h3>
                <p className="text-xs text-white/80 mt-1">Se enviarán automáticamente al WhatsApp del cliente</p>
              </div>
            )}
            {selectedChat ? (
              <>
                {/* Header de la conversación */}
                <header className="h-14 px-3 md:px-4 bg-[#F0F2F5] border-b border-[#E9EDEF] flex items-center justify-between shrink-0 shadow-2xs z-10">
                  <div className="flex items-center gap-2 md:gap-3">
                    {/* Botón volver — solo mobile */}
                    <button
                      type="button"
                      onClick={() => setSelectedChat(null)}
                      className="md:hidden p-1.5 -ml-1 rounded-full text-gray-600 hover:bg-[#E9EDEF] transition-colors"
                      aria-label="Volver a chats"
                    >
                      <ChevronLeft size={22} />
                    </button>
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
                      className={`text-[11px] font-semibold px-2 md:px-2.5 py-1 rounded-lg border transition-all ${selectedChat.botPaused
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                        }`}
                    >
                      <span className="hidden sm:inline">{selectedChat.botPaused ? '👤 Atención Humana' : '⚡ Asistente Virtual'}</span>
                      <span className="sm:hidden">{selectedChat.botPaused ? '👤' : '⚡'}</span>
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
                            className={`max-w-[88%] sm:max-w-[75%] rounded-lg px-3 py-2 text-xs shadow-xs relative ${isClient
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

                            {m.mediaType === 'VIDEO' && m.mediaUrl && (
                              <div className="mt-2">
                                <video
                                  controls
                                  className="max-h-64 w-full rounded-md border border-gray-300 bg-black"
                                  preload="metadata"
                                >
                                  <source src={m.mediaUrl} />
                                  Tu navegador no soporta reproducción de video.
                                </video>
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

                            {/* Botón Guardar en Bóveda — solo para mensajes entrantes del cliente con media */}
                            {m.mediaType && m.mediaType !== null && m.mediaUrl && m.sender === 'client' && selectedChat?.clientOwner && (
                              <div className="mt-1.5 flex justify-end">
                                <button
                                  onClick={() => setBovedaModal({
                                    open: true,
                                    messageId: m.id,
                                    mediaUrl: m.mediaUrl!,
                                    fileName: m.fileName || `archivo_${m.id}`,
                                  })}
                                  className="flex items-center gap-1 text-[10px] text-[#166BA3] hover:text-[#0d4f7a] font-semibold transition-colors"
                                  title="Guardar en Bóveda Digital"
                                >
                                  <Archive size={11} />
                                  Guardar en Bóveda
                                </button>
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

              {/* Barra inferior de escritura de mensaje (Estilo WhatsApp con Audio PTT y Adjuntos) */}
              <footer className="p-2.5 bg-[#F0F2F5] border-t border-[#E9EDEF] flex items-center gap-2 shrink-0">
                {/* Input file oculto para adjuntos (admite múltiples archivos) */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />

                  {isRecording ? (
                    // Barra de grabación de audio en vivo
                    <div className="flex-1 flex items-center justify-between px-4 py-2 bg-red-50 border border-red-200 rounded-lg animate-pulse">
                      <div className="flex items-center gap-2 text-red-600 font-semibold text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                        <span>Grabando audio: {recordingSeconds}s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelRecording}
                          className="p-1.5 rounded-full hover:bg-red-200 text-red-700 transition-colors"
                          title="Cancelar grabación"
                        >
                          <X size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                          title="Enviar nota de voz"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Barra normal de texto + adjunto + micrófono
                    <>
                      <button
                        type="button"
                        disabled={uploadingMedia || sending}
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-500 hover:text-[#1E2A3C] hover:bg-white rounded-full transition-colors disabled:opacity-40"
                        title="Adjuntar Imagen, Video o Documento"
                      >
                        <Paperclip size={18} />
                      </button>

                      <form onSubmit={handleSendReply} className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={uploadingMedia ? 'Subiendo archivo...' : 'Escribe un mensaje aquí...'}
                          disabled={uploadingMedia}
                          className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-transparent text-xs text-[#111B21] placeholder:text-gray-500 focus:outline-none focus:border-[#00a884] shadow-2xs"
                        />
                        {replyText.trim() ? (
                          <button
                            type="submit"
                            disabled={sending}
                            className="p-2.5 rounded-full bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95 disabled:opacity-40 transition-all shadow-xs"
                            title="Enviar Mensaje"
                          >
                            <Send size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={startRecording}
                            disabled={sending || uploadingMedia}
                            className="p-2.5 rounded-full bg-gray-200 hover:bg-[#00a884] hover:text-white text-gray-600 active:scale-95 transition-all shadow-xs"
                            title="Grabar Nota de Voz"
                          >
                            <Mic size={16} />
                          </button>
                        )}
                      </form>
                    </>
                  )}
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

          {/* ═══════════════ COLUMNA 3: PANEL MULTIMEDIA / DOCS / ENLACES / FICHA (ESTILO WHATSAPP WEB) ═══════════════ */}
          {showInfoSidebar && selectedChat && (
            <aside className="fixed inset-0 z-50 w-full sm:w-96 sm:left-auto md:relative md:inset-auto md:z-10 border-l border-[#E9EDEF] bg-white flex flex-col h-full shrink-0 shadow-lg md:shadow-xs animate-in slide-in-from-right duration-150">
              {/* Header del Panel */}
              <div className="p-3 bg-[#F0F2F5] border-b border-[#E9EDEF] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInfoSidebar(false)}
                    className="p-1 rounded-full text-gray-600 hover:bg-[#E9EDEF] transition-colors"
                    title="Cerrar panel"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="font-bold text-xs text-[#1E2A3C]">
                    Info. del contacto y archivos
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInfoSidebar(false)}
                  className="p-1 rounded text-gray-500 hover:bg-[#E9EDEF]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Pestañas estilo WhatsApp Web */}
              <div className="flex border-b border-[#E9EDEF] bg-white text-[11px] font-semibold text-gray-500 shrink-0">
                <button
                  onClick={() => setSidebarTab('MEDIA')}
                  className={`flex-1 py-2.5 text-center border-b-2 transition-all ${sidebarTab === 'MEDIA'
                    ? 'border-[#00a884] text-[#00a884] font-bold'
                    : 'border-transparent hover:text-[#111B21]'
                    }`}
                >
                  Multimedia
                </button>
                <button
                  onClick={() => setSidebarTab('DOCS')}
                  className={`flex-1 py-2.5 text-center border-b-2 transition-all ${sidebarTab === 'DOCS'
                    ? 'border-[#00a884] text-[#00a884] font-bold'
                    : 'border-transparent hover:text-[#111B21]'
                    }`}
                >
                  Documentos
                </button>
                <button
                  onClick={() => setSidebarTab('LINKS')}
                  className={`flex-1 py-2.5 text-center border-b-2 transition-all ${sidebarTab === 'LINKS'
                    ? 'border-[#00a884] text-[#00a884] font-bold'
                    : 'border-transparent hover:text-[#111B21]'
                    }`}
                >
                  Enlaces
                </button>
                <button
                  onClick={() => setSidebarTab('INFO')}
                  className={`flex-1 py-2.5 text-center border-b-2 transition-all ${sidebarTab === 'INFO'
                    ? 'border-[#00a884] text-[#00a884] font-bold'
                    : 'border-transparent hover:text-[#111B21]'
                    }`}
                >
                  Datos
                </button>
              </div>

              {/* Contenido según Pestaña Activa */}
              <div className="flex-1 overflow-y-auto p-4 text-xs">
                {/* ── 1. ARCHIVOS MULTIMEDIA (FOTOS Y VIDEOS EN CUADRÍCULA) ── */}
                {sidebarTab === 'MEDIA' && (() => {
                  const mediaItems = messages.filter(
                    (m) => m.mediaUrl && (m.mediaType === 'IMAGE' || m.mediaType === 'VIDEO')
                  );

                  if (mediaItems.length === 0) {
                    return (
                      <div className="text-center py-16 text-gray-400 space-y-2">
                        <ImageIcon size={36} className="mx-auto opacity-30 text-gray-400" />
                        <p className="font-semibold text-gray-600">No hay archivos multimedia</p>
                        <p className="text-[11px]">Las fotos y videos compartidos en este chat aparecerán aquí.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-3 gap-1.5">
                      {mediaItems.map((m) => (
                        <a
                          key={m.id}
                          href={m.mediaUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square bg-gray-100 rounded overflow-hidden border border-gray-200 hover:opacity-95 transition-all"
                        >
                          {m.mediaType === 'IMAGE' ? (
                            <img
                              src={m.mediaUrl!}
                              alt={m.fileName || 'Foto'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-black flex items-center justify-center text-white relative">
                              <Video size={20} className="text-white/80" />
                              <span className="absolute bottom-1 right-1 text-[8px] bg-black/60 px-1 rounded font-mono">
                                Video
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ExternalLink size={14} className="text-white" />
                          </div>
                        </a>
                      ))}
                    </div>
                  );
                })()}

                {/* ── 2. DOCUMENTOS (CHAT MEDIA + BÓVEDA DIGITAL) ── */}
                {sidebarTab === 'DOCS' && (() => {
                  const chatDocs = messages.filter(
                    (m) => m.mediaUrl && m.mediaType === 'DOCUMENT'
                  );
                  const bovedaDocs = selectedChat.clientOwner?.taxpayers.flatMap((t) => t.documents) || [];

                  if (chatDocs.length === 0 && bovedaDocs.length === 0) {
                    return (
                      <div className="text-center py-16 text-gray-400 space-y-2">
                        <FileText size={36} className="mx-auto opacity-30 text-gray-400" />
                        <p className="font-semibold text-gray-600">No hay documentos</p>
                        <p className="text-[11px]">Los PDFs compartidos o guardados en la Bóveda aparecerán aquí.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Documentos oficiales de Bóveda */}
                      {bovedaDocs.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                            Bóveda Digital (SRI / RUC)
                          </span>
                          <div className="space-y-1.5">
                            {bovedaDocs.map((d) => (
                              <div
                                key={d.id}
                                className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 space-y-1.5 transition-colors"
                              >
                                <a
                                  href={d.bunnyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium text-[#1E2A3C] flex items-center gap-1.5 hover:text-[#166BA3]"
                                >
                                  <FileText size={14} className="text-[#166BA3] shrink-0" />
                                  <span className="truncate flex-1">{d.title}</span>
                                  <ExternalLink size={10} className="text-gray-400 shrink-0 ml-1" />
                                </a>
                                <button
                                  onClick={() => handleSendBovedaDoc(d.id, d.bunnyUrl, d.title)}
                                  disabled={sendingBovedaDoc === d.id}
                                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-white bg-[#25D366] hover:bg-[#1da851] disabled:opacity-60 rounded px-2 py-1 transition-colors"
                                >
                                  <Share2 size={10} />
                                  {sendingBovedaDoc === d.id ? 'Enviando…' : 'Enviar por WhatsApp'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Archivos PDF recibidos o enviados por chat */}
                      {chatDocs.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                            Archivos del Chat
                          </span>
                          <div className="space-y-1.5">
                            {chatDocs.map((m) => (
                              <a
                                key={m.id}
                                href={m.mediaUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-between transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText size={14} className="text-red-500 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="truncate block font-medium text-[#111B21] text-[11px]">
                                      {m.fileName || 'Documento PDF'}
                                    </span>
                                    <span className="text-[9px] text-gray-400">{m.timestamp}</span>
                                  </div>
                                </div>
                                <ExternalLink size={11} className="text-gray-400 shrink-0 ml-1" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── 3. ENLACES (LINKS COMPARTIDOS) ── */}
                {sidebarTab === 'LINKS' && (() => {
                  const links = extractLinksFromMessages();

                  if (links.length === 0) {
                    return (
                      <div className="text-center py-16 text-gray-400 space-y-2">
                        <Link2 size={36} className="mx-auto opacity-30 text-gray-400" />
                        <p className="font-semibold text-gray-600">No hay enlaces</p>
                        <p className="text-[11px]">Los enlaces web enviados o recibidos aparecerán aquí.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 flex items-start gap-2 transition-colors group"
                        >
                          <div className="p-1.5 rounded-md bg-white border border-gray-200 text-[#166BA3] shrink-0 mt-0.5">
                            <Link2 size={12} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-medium text-[#166BA3] group-hover:underline truncate block">
                              {link.url}
                            </span>
                            <span className="text-[9px] text-gray-400 block mt-0.5">
                              {link.timestamp} · {link.sender === 'client' ? 'Cliente' : 'Estudio Contable'}
                            </span>
                          </div>
                          <ExternalLink size={10} className="text-gray-400 shrink-0 ml-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  );
                })()}

                {/* ── 4. DATOS DEL CONTRIBUYENTE ── */}
                {sidebarTab === 'INFO' && (
                  <div className="space-y-4">
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
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Shield size={28} className="mx-auto opacity-30 mb-2" />
                        <p>Número no registrado formalmente como cliente.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ══ MODAL CARRUSEL MULTI-ARCHIVO ANTES DE ENVIAR (WHATSAPP WEB STYLE) ══ */}
      {pendingFiles.length > 0 && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-[#111B21] text-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] border border-[#202C33]">
            {/* Header del Modal */}
            <div className="px-5 py-3.5 bg-[#202C33] flex items-center justify-between border-b border-gray-700 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-200 truncate">
                  {pendingFiles.length > 1
                    ? `Previsualización (${activePreviewIndex + 1} de ${pendingFiles.length})`
                    : 'Previsualización de envío'}
                </span>
                <span className="text-[11px] text-gray-400 truncate">
                  · {selectedChat.clientOwner?.fullName || selectedChat.whatsappPhone}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelAllPendingFiles}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Descartar todo"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo de Visualización con Flechas de Navegación Lateral */}
            <div className="relative flex-1 p-4 sm:p-6 flex items-center justify-center bg-[#0B141A] overflow-hidden min-h-[280px]">
              {/* Flecha Anterior */}
              {pendingFiles.length > 1 && (
                <button
                  type="button"
                  disabled={activePreviewIndex === 0}
                  onClick={() => setActivePreviewIndex((prev) => Math.max(0, prev - 1))}
                  className="absolute left-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  title="Anterior"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* Contenido del archivo activo */}
              {pendingFiles[activePreviewIndex] && (
                <div className="w-full h-full flex items-center justify-center">
                  {pendingFiles[activePreviewIndex].mediaType === 'IMAGE' && (
                    <img
                      src={pendingFiles[activePreviewIndex].previewUrl}
                      alt={pendingFiles[activePreviewIndex].file.name}
                      className="max-h-[320px] max-w-full object-contain rounded-lg shadow-lg"
                    />
                  )}

                  {pendingFiles[activePreviewIndex].mediaType === 'VIDEO' && (
                    <video
                      controls
                      src={pendingFiles[activePreviewIndex].previewUrl}
                      className="max-h-[320px] max-w-full rounded-lg shadow-lg bg-black"
                    />
                  )}

                  {pendingFiles[activePreviewIndex].mediaType === 'DOCUMENT' && (
                    <div className="p-8 bg-[#202C33] rounded-2xl flex flex-col items-center justify-center gap-3 border border-gray-700 max-w-xs text-center shadow-lg">
                      <FileText size={48} className="text-red-400" />
                      <span className="text-xs font-semibold text-gray-200 truncate max-w-full">
                        {pendingFiles[activePreviewIndex].file.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {(pendingFiles[activePreviewIndex].file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  )}

                  {pendingFiles[activePreviewIndex].mediaType === 'AUDIO' && (
                    <div className="p-6 bg-[#202C33] rounded-2xl flex flex-col items-center gap-3 border border-gray-700 w-full max-w-sm shadow-lg">
                      <span className="text-xs font-medium text-gray-300 truncate">
                        {pendingFiles[activePreviewIndex].file.name}
                      </span>
                      <audio
                        controls
                        src={pendingFiles[activePreviewIndex].previewUrl}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Flecha Siguiente */}
              {pendingFiles.length > 1 && (
                <button
                  type="button"
                  disabled={activePreviewIndex === pendingFiles.length - 1}
                  onClick={() =>
                    setActivePreviewIndex((prev) => Math.min(pendingFiles.length - 1, prev + 1))
                  }
                  className="absolute right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  title="Siguiente"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>

            {/* Input de Pie de Foto (Caption) para el archivo activo */}
            <div className="px-4 py-2.5 bg-[#202C33] border-t border-gray-700 flex items-center gap-3">
              <input
                type="text"
                value={pendingFiles[activePreviewIndex]?.caption || ''}
                onChange={(e) => handleUpdateActiveCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmSendPendingFiles();
                  }
                }}
                placeholder={
                  pendingFiles.length > 1
                    ? `Pie de foto para este archivo (${activePreviewIndex + 1}/${pendingFiles.length})...`
                    : 'Añadir un pie de foto o comentario...'
                }
                className="flex-1 bg-[#2A3942] border border-transparent focus:border-[#00a884] rounded-xl px-4 py-2 text-xs text-white placeholder-gray-400 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Tira Inferior de Miniaturas (Carousel Thumbnails Strip estilo WhatsApp Web) */}
            <div className="p-3 bg-[#182229] border-t border-gray-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto max-w-[calc(100%-140px)] py-1 scrollbar-thin">
                {pendingFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setActivePreviewIndex(idx)}
                    className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all group ${
                      idx === activePreviewIndex
                        ? 'border-[#00a884] ring-2 ring-[#00a884]/40 scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100 hover:border-gray-500'
                    }`}
                  >
                    {item.mediaType === 'IMAGE' && (
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {item.mediaType === 'VIDEO' && (
                      <div className="w-full h-full bg-[#202C33] flex items-center justify-center">
                        <Video size={16} className="text-gray-300" />
                      </div>
                    )}
                    {item.mediaType === 'DOCUMENT' && (
                      <div className="w-full h-full bg-[#202C33] flex items-center justify-center">
                        <FileText size={16} className="text-red-400" />
                      </div>
                    )}
                    {item.mediaType === 'AUDIO' && (
                      <div className="w-full h-full bg-[#202C33] flex items-center justify-center">
                        <Mic size={16} className="text-emerald-400" />
                      </div>
                    )}

                    {/* Botón eliminar miniatura individual */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSinglePendingFile(idx);
                      }}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar este archivo"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}

                {/* Botón + para agregar más archivos al lote */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-600 hover:border-[#00a884] hover:text-[#00a884] text-gray-400 flex flex-col items-center justify-center shrink-0 transition-colors"
                  title="Añadir más archivos al lote"
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Botones de Acción (Descartar / Enviar) */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelAllPendingFiles}
                  className="px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors hidden sm:block"
                >
                  Descartar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSendPendingFiles}
                  disabled={uploadingMedia}
                  className="h-11 px-4 bg-[#00a884] hover:bg-[#008f6f] active:scale-95 disabled:opacity-50 text-white rounded-full shadow-lg transition-all flex items-center justify-center gap-1.5 font-bold text-xs shrink-0"
                  title="Enviar por WhatsApp"
                >
                  <Send size={16} />
                  {pendingFiles.length > 1 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-[10px]">
                      {pendingFiles.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Guardar archivo de chat en Bóveda Digital ══ */}
      {bovedaModal.open && selectedChat?.clientOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E2A3C] flex items-center gap-2">
                <Archive size={16} className="text-[#166BA3]" />
                Guardar en Bóveda Digital
              </h3>
              <button onClick={() => setBovedaModal({ open: false, messageId: null, mediaUrl: null, fileName: null })} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {bovedaModal.fileName && (
              <p className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1 font-mono truncate">
                📎 {bovedaModal.fileName}
              </p>
            )}

            {/* Empresa */}
            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">Empresa *</label>
              <select
                value={bovedaForm.taxpayerId}
                onChange={(e) => setBovedaForm((f) => ({ ...f, taxpayerId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
              >
                <option value="">Seleccionar empresa…</option>
                {selectedChat.clientOwner.taxpayers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.razonSocial} {t.ruc ? `(${t.ruc})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">Título *</label>
              <input
                type="text"
                value={bovedaForm.title}
                onChange={(e) => setBovedaForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Declaración IVA Octubre 2025"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
              />
            </div>

            {/* Categoría */}
            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">Categoría *</label>
              <select
                value={bovedaForm.category}
                onChange={(e) => setBovedaForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
              >
                <option value="DECLARACION_IVA">Declaración IVA</option>
                <option value="DECLARACION_RENTA">Declaración Renta</option>
                <option value="ANEXO">Anexo</option>
                <option value="COMPROBANTE_RETENCION">Comprobante Retención</option>
                <option value="FACTURA">Factura</option>
                <option value="CONTRATO">Contrato</option>
                <option value="FIRMA_ELECTRONICA">Firma Electrónica</option>
                <option value="SRI_CLAVE">Clave SRI</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            {/* Año y Mes */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">Año *</label>
                <input
                  type="number"
                  value={bovedaForm.periodYear}
                  onChange={(e) => setBovedaForm((f) => ({ ...f, periodYear: e.target.value }))}
                  min="2000" max="2099"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">Mes (opcional)</label>
                <select
                  value={bovedaForm.periodMonth}
                  onChange={(e) => setBovedaForm((f) => ({ ...f, periodMonth: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#166BA3]"
                >
                  <option value="">—</option>
                  {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {bovedaError && (
              <p className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1">{bovedaError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setBovedaModal({ open: false, messageId: null, mediaUrl: null, fileName: null })}
                className="flex-1 py-2 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveToBovedaSubmit}
                disabled={bovedaSaving}
                className="flex-1 py-2 text-xs font-semibold text-white bg-[#166BA3] hover:bg-[#0d4f7a] disabled:opacity-60 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Archive size={12} />
                {bovedaSaving ? 'Guardando…' : 'Guardar en Bóveda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function WhatsAppPage() {
  return <WhatsAppView />;
}
