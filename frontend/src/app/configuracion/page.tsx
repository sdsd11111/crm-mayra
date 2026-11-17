// frontend/src/app/configuracion/page.tsx
'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import {
  Settings,
  Users,
  Radio,
  UserPlus,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  QrCode,
  PowerOff,
  RotateCw,
  RefreshCw,
  Search,
  Trash2,
  Smartphone,
  Server,
  Image as ImageIcon,
  Edit2,
  CheckSquare,
  Plus,
  Clock,
  Calendar,
  AlertTriangle,
  Check,
  FileText,
  X,
} from 'lucide-react';

interface UserItem {
  id: number;
  username: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: 'ADMIN_MAYRA' | 'ASISTENTE';
  isActive: boolean;
  createdAt: string;
}

interface InstanceStatus {
  success: boolean;
  instanceName: string;
  state: 'open' | 'connecting' | 'close' | 'DISCONNECTED' | 'UNREACHABLE' | string;
}

interface TaskItem {
  id: number;
  title: string;
  description?: string | null;
  priority: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA';
  dueDate?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  cancelNote?: string | null;
  createdById: number;
  assignedToId: number;
  createdBy: { id: number; fullName: string; username: string };
  assignedTo: { id: number; fullName: string; username: string };
  createdAt: string;
}

function ConfiguracionView() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<'USUARIOS' | 'TAREAS' | 'WHATSAPP'>('USUARIOS');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'tareas' || tabParam === 'TAREAS') {
      setActiveTab('TAREAS');
    } else if (tabParam === 'usuarios' || tabParam === 'USUARIOS') {
      setActiveTab('USUARIOS');
    } else if (tabParam === 'whatsapp' || tabParam === 'WHATSAPP') {
      setActiveTab('WHATSAPP');
    }

    if (searchParams.get('action') === 'new-task') {
      setIsTaskModalOpen(true);
    }
  }, [searchParams]);

  // ================= ESTADO USUARIOS =================
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal Crear/Editar Usuario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formRole, setFormRole] = useState<'ADMIN_MAYRA' | 'ASISTENTE'>('ASISTENTE');
  const [submittingUser, setSubmittingUser] = useState(false);

  // Modal Cambiar Contraseña
  const [pwdModalUser, setPwdModalUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // ================= ESTADO TAREAS =================
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'>('MEDIA');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssignedToId, setTaskAssignedToId] = useState('');
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const [submittingTask, setSubmittingTask] = useState(false);

  // Filtros de Tareas
  const [taskSearch, setTaskSearch] = useState('');
  const [taskCalendarDate, setTaskCalendarDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [taskCalendarView, setTaskCalendarView] = useState<'HOY' | 'FECHA' | 'TODAS'>('TODAS');
  const [selectedTaskPopup, setSelectedTaskPopup] = useState<TaskItem | null>(null);
  const [cancelNoteInput, setCancelNoteInput] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

  // Estado del calendario mensual
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // ================= ESTADO WHATSAPP =================
  const [waStatus, setWaStatus] = useState<InstanceStatus | null>(null);
  const [waLoading, setWaLoading] = useState(true);
  const [waActionLoading, setWaActionLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Feedback general
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user?.role !== 'ADMIN_MAYRA') {
        router.replace('/dashboard');
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Cargar usuarios
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setUsersLoading(true);
    try {
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  // Cargar tareas (en gestión se cargan todas para que Mayra supervise)
  const fetchTasks = useCallback(async () => {
    if (!token) return;
    setTasksLoading(true);
    try {
      const res = await fetch('/api/tasks?all=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTasks(data.tasks || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  }, [token]);

  // Cargar WhatsApp status
  const fetchWaStatus = useCallback(async () => {
    if (!token) return;
    setWaLoading(true);
    try {
      const res = await fetch('/api/whatsapp/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setWaStatus(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setWaLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && user?.role === 'ADMIN_MAYRA') {
      fetchUsers();
      fetchTasks();
      fetchWaStatus();
    }
  }, [token, user, fetchUsers, fetchTasks, fetchWaStatus]);

  // Crear Tarea con archivo adjunto
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !taskTitle.trim()) return;
    setSubmittingTask(true);
    try {
      const formData = new FormData();
      formData.append('title', taskTitle.trim());
      if (taskDescription.trim()) formData.append('description', taskDescription.trim());
      formData.append('priority', taskPriority);
      if (taskDueDate) formData.append('dueDate', taskDueDate);
      formData.append('assignedToId', taskAssignedToId ? taskAssignedToId : String(user?.id));
      if (taskFile) formData.append('file', taskFile);

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: 'Tarea creada con éxito.' });
        setIsTaskModalOpen(false);
        setTaskTitle('');
        setTaskDescription('');
        setTaskDueDate('');
        setTaskPriority('MEDIA');
        setTaskFile(null);
        await fetchTasks();
      } else {
        setFeedback({ type: 'error', message: data.message || 'Error al crear tarea.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmittingTask(false);
    }
  };

  // Marcar como no realizada (CANCELADA) con motivo
  const handleCancelTask = async (taskId: number, note: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CANCELADA', cancelNote: note }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'CANCELADA', cancelNote: note } : t))
        );
        setSelectedTaskPopup((prev) => prev ? { ...prev, status: 'CANCELADA', cancelNote: note } : null);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setShowCancelForm(false);
      setCancelNoteInput('');
    }
  };

  // Toggle estado de tarea
  const handleToggleTaskStatus = async (taskId: number, currentStatus: string) => {
    if (!token) return;
    const nextStatus = currentStatus === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA';
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
        );
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Eliminar tarea
  const handleDeleteTask = async (taskId: number) => {
    if (!token || !confirm('¿Eliminar esta tarea?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Guardar usuario
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmittingUser(true);
    try {
      if (editingUserId) {
        const res = await fetch(`/api/auth/users/${editingUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            fullName: formFullName,
            phone: formPhone || null,
            role: formRole,
            avatarUrl: formAvatarUrl || null,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setFeedback({ type: 'success', message: 'Usuario actualizado exitosamente.' });
          closeUserModal();
          await fetchUsers();
        } else {
          setFeedback({ type: 'error', message: data.error || 'Error al actualizar.' });
        }
      } else {
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            username: formUsername,
            fullName: formFullName,
            phone: formPhone || null,
            password: formPassword,
            role: formRole,
            avatarUrl: formAvatarUrl || null,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setFeedback({ type: 'success', message: `Cuenta de ${data.user.fullName} creada.` });
          closeUserModal();
          await fetchUsers();
        } else {
          setFeedback({ type: 'error', message: data.error || 'Error al crear usuario.' });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmittingUser(false);
    }
  };

  const openCreateModal = () => {
    setEditingUserId(null);
    setFormUsername('');
    setFormFullName('');
    setFormPhone('');
    setFormPassword('');
    setFormAvatarUrl('');
    setFormRole('ASISTENTE');
    setIsModalOpen(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUserId(u.id);
    setFormUsername(u.username);
    setFormFullName(u.fullName);
    setFormPhone(u.phone || '');
    setFormPassword('');
    setFormAvatarUrl(u.avatarUrl || '');
    setFormRole(u.role);
    setIsModalOpen(true);
  };

  const closeUserModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setFormUsername('');
    setFormFullName('');
    setFormPhone('');
    setFormPassword('');
    setFormAvatarUrl('');
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (!token) return;
    if (u.username === 'mayra') {
      alert('La cuenta principal de Mayra no se puede eliminar.');
      return;
    }
    if (!confirm(`¿Eliminar la cuenta de ${u.fullName}?`)) return;
    try {
      const res = await fetch(`/api/auth/users/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: 'Cuenta eliminada.' });
        await fetchUsers();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Error al eliminar.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pwdModalUser || !newPassword) return;
    setPwdSubmitting(true);
    try {
      const res = await fetch(`/api/auth/users/${pwdModalUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: `Contraseña actualizada.` });
        setPwdModalUser(null);
        setNewPassword('');
      } else {
        setFeedback({ type: 'error', message: data.error || 'Error al actualizar.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setPwdSubmitting(false);
    }
  };

  // Acciones WhatsApp
  const handleConnectWa = async () => {
    if (!token) return;
    setWaActionLoading(true);
    setQrCode(null);
    try {
      const res = await fetch('/api/whatsapp/instance-connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.qrCode) {
        setQrCode(data.qrCode);
        setFeedback({ type: 'info', message: 'Escanea el código QR con WhatsApp en tu celular.' });
      } else if (data.pairingCode) {
        setFeedback({ type: 'info', message: `Código de vinculación: ${data.pairingCode}` });
      } else {
        setFeedback({ type: 'error', message: data.error || 'No se pudo generar el código QR.' });
      }
      fetchWaStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al conectar WhatsApp.' });
    } finally {
      setWaActionLoading(false);
    }
  };

  const handleRestartWa = async () => {
    if (!token) return;
    setWaActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/instance-restart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: 'Instancia reiniciada.' });
        setQrCode(null);
      } else {
        setFeedback({ type: 'error', message: data.error || 'Error al reiniciar.' });
      }
      setTimeout(fetchWaStatus, 2000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setWaActionLoading(false);
    }
  };

  const handleLogoutWa = async () => {
    if (!token) return;
    if (!confirm('¿Deseas desconectar la sesión de WhatsApp?')) return;
    setWaActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/instance-logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: 'Sesión de WhatsApp cerrada.' });
        setQrCode(null);
      } else {
        setFeedback({ type: 'error', message: data.error || 'Error al desconectar.' });
      }
      setTimeout(fetchWaStatus, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setWaActionLoading(false);
    }
  };

  const isWaConnected = waStatus?.state === 'open';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] pb-12 md:pl-64">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-6">
        {/* Cabecera */}
        <div className="bg-white/95 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                Administración
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500 font-medium">Ajustes Generales</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2A3C] mt-1 tracking-tight">
              Configuración del Sistema
            </h1>
          </div>

          <div className="flex items-center gap-2 border-b border-gray-200/80 pb-2">
            <button
              onClick={() => { setActiveTab('USUARIOS'); setFeedback(null); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'USUARIOS'
                  ? 'bg-[#1E2A3C] text-white shadow-sm'
                  : 'bg-white/80 text-gray-600 hover:bg-white hover:text-[#1E2A3C]'
              }`}
            >
              <Users size={15} />
              Equipo ({users.length})
            </button>

            <button
              onClick={() => { setActiveTab('TAREAS'); setFeedback(null); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'TAREAS'
                  ? 'bg-[#166BA3] text-white shadow-sm'
                  : 'bg-white/80 text-gray-600 hover:bg-white hover:text-[#1E2A3C]'
              }`}
            >
              <CheckSquare size={15} />
              Tareas y Asignaciones ({tasks.filter(t => t.status === 'PENDIENTE').length})
            </button>

            <button
              onClick={() => { setActiveTab('WHATSAPP'); setFeedback(null); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'WHATSAPP'
                  ? 'bg-[#1E2A3C] text-white shadow-sm'
                  : 'bg-white/80 text-gray-600 hover:bg-white hover:text-[#1E2A3C]'
              }`}
            >
              <Radio size={15} />
              WhatsApp
              <span className={`w-2 h-2 rounded-full ${isWaConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ================= PESTAÑA: TAREAS ================= */}
        {activeTab === 'TAREAS' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#1E2A3C]">Gestión de Tareas Operativas</h2>
                <p className="text-xs text-gray-400">
                  Crea y asigna tareas diarias para ti (Mayra) o para tu equipo de asistentes.
                </p>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#166BA3] hover:bg-[#135887] text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Plus size={15} />
                Nueva Tarea
              </button>
            </div>

            {tasksLoading ? (
              <div className="p-8 text-center text-xs text-gray-400">Cargando tareas...</div>
            ) : (
              (() => {
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

                // Para HOY y FECHA: lista filtrada normal
                const filteredTasks = tasks.filter((t) => {
                  let pass = true;
                  if (taskCalendarView === 'HOY') {
                    const due = t.dueDate
                      ? (() => { const d = new Date(t.dueDate!); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()
                      : (() => { const d = new Date(t.createdAt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
                    pass = due === todayStr;
                  } else if (taskCalendarView === 'FECHA') {
                    const due = t.dueDate
                      ? (() => { const d = new Date(t.dueDate!); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()
                      : (() => { const d = new Date(t.createdAt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
                    pass = due === taskCalendarDate;
                  }
                  if (taskSearch.trim()) {
                    const q = taskSearch.toLowerCase();
                    pass = pass && (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
                  }
                  return pass;
                });

                // Cabecera de controles (siempre visible)
                const controls = (
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTaskCalendarView('HOY')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${taskCalendarView === 'HOY' ? 'bg-[#166BA3] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#166BA3]'}`}
                      >
                        Hoy
                      </button>
                      <button
                        onClick={() => setTaskCalendarView('TODAS')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${taskCalendarView === 'TODAS' ? 'bg-[#1E2A3C] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#1E2A3C]'}`}
                      >
                        Calendario
                      </button>
                      <input
                        type="date"
                        value={taskCalendarDate}
                        onChange={(e) => { setTaskCalendarDate(e.target.value); setTaskCalendarView('FECHA'); }}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-[#1E2A3C] focus:outline-none focus:border-[#166BA3]"
                      />
                    </div>
                    <div className="relative flex-1 max-w-xs">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar tarea..."
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#166BA3]"
                      />
                    </div>
                  </div>
                );

                // ===== VISTA CALENDARIO MENSUAL =====
                if (taskCalendarView === 'TODAS') {
                  const firstDay = new Date(calYear, calMonth, 1);
                  const lastDay = new Date(calYear, calMonth + 1, 0);
                  const startDow = firstDay.getDay();
                  const daysInMonth = lastDay.getDate();
                  const monthLabel = firstDay.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });

                  // Helper: extraer YYYY-MM-DD desde string ISO respetando que la fecha
                  // se guardó como mediodia local (evita shift de zona horaria)
                  const toLocalDate = (iso: string) => {
                    // Si ya viene como YYYY-MM-DD puro, retornar directo
                    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
                    // Parsear y usar fecha local (no UTC)
                    const d = new Date(iso);
                    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  };

                  // Map: 'YYYY-MM-DD' -> tasks[]
                  const tasksByDay: Record<string, TaskItem[]> = {};
                  tasks.forEach((t) => {
                    const key = t.dueDate ? toLocalDate(t.dueDate) : toLocalDate(t.createdAt);
                    if (!tasksByDay[key]) tasksByDay[key] = [];
                    tasksByDay[key].push(t);
                  });

                  // Día seleccionado en el calendario para expandir sus tareas
                  const selectedDayTasks = taskCalendarDate && taskCalendarView === 'TODAS'
                    ? (tasksByDay[taskCalendarDate] || [])
                    : [];

                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < startDow; i++) {
                    cells.push(<div key={`e-${i}`} className="h-10 rounded-lg bg-slate-50/40" />);
                  }
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dayTasks = tasksByDay[dateStr] || [];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === taskCalendarDate;
                    const hasPending = dayTasks.some(t => t.status !== 'COMPLETADA' && t.status !== 'CANCELADA');
                    const hasCancel = dayTasks.some(t => t.status === 'CANCELADA');
                    const allDone = dayTasks.length > 0 && dayTasks.every(t => t.status === 'COMPLETADA');
                    const isPast = dateStr < todayStr;

                    cells.push(
                      <button
                        key={dateStr}
                        onClick={() => setTaskCalendarDate(isSelected ? '' : dateStr)}
                        className={`h-10 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all border ${
                          isSelected
                            ? 'border-[#166BA3] bg-[#166BA3]/10 ring-2 ring-[#166BA3]/30'
                            : isToday
                            ? 'border-[#166BA3]/50 bg-blue-50'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`text-[11px] font-bold leading-none ${
                          isToday ? 'text-[#166BA3]' : 'text-slate-600'
                        }`}>{d}</span>
                        {dayTasks.length > 0 && (
                          <div className="flex gap-0.5 items-center">
                            {hasPending && <span className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-rose-500' : 'bg-[#166BA3]'}`} />}
                            {allDone && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                            {hasCancel && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                          </div>
                        )}
                      </button>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {controls}
                      <div className="bg-white/95 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                        {/* Cabecera mes + navegación */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else { setCalMonth(m => m - 1); } }}
                            className="px-3 py-1 rounded-lg hover:bg-slate-100 text-slate-500 font-bold text-lg transition-colors"
                          >‹</button>
                          <h3 className="text-sm font-bold text-[#1E2A3C] capitalize">{monthLabel}</h3>
                          <button
                            onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else { setCalMonth(m => m + 1); } }}
                            className="px-3 py-1 rounded-lg hover:bg-slate-100 text-slate-500 font-bold text-lg transition-colors"
                          >›</button>
                        </div>

                        {/* Cabecera días de semana */}
                        <div className="grid grid-cols-7 gap-1">
                          {['D','L','M','X','J','V','S'].map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
                          ))}
                        </div>

                        {/* Celdas días — compactas, solo número + dot */}
                        <div className="grid grid-cols-7 gap-1">
                          {cells}
                        </div>

                        {/* Leyenda */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#166BA3] inline-block" /> Pendiente</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Completada</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Vencida</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> No realizada</span>
                        </div>
                      </div>

                      {/* Tareas del día seleccionado */}
                      {taskCalendarDate && (
                        <div className="bg-white/95 border border-slate-200 rounded-2xl p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-[#1E2A3C]">
                              Tareas del {new Date(taskCalendarDate + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </h4>
                            <button onClick={() => setTaskCalendarDate('')} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                          </div>
                          {selectedDayTasks.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">Sin tareas para este día</p>
                          ) : (
                            <div className="space-y-2">
                              {selectedDayTasks.map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => setSelectedTaskPopup(t)}
                                  className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 hover:shadow-sm transition-all ${
                                    t.status === 'COMPLETADA' ? 'border-emerald-200 bg-emerald-50/40'
                                    : t.status === 'CANCELADA' ? 'border-orange-200 bg-orange-50/40'
                                    : taskCalendarDate < todayStr ? 'border-rose-200 bg-rose-50/40'
                                    : 'border-slate-200 bg-white hover:border-[#166BA3]/40'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    t.status === 'COMPLETADA' ? 'bg-emerald-500'
                                    : t.status === 'CANCELADA' ? 'bg-orange-400'
                                    : taskCalendarDate < todayStr ? 'bg-rose-500'
                                    : 'bg-[#166BA3]'
                                  }`} />
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-xs font-bold truncate ${t.status === 'COMPLETADA' ? 'line-through text-gray-400' : 'text-[#1E2A3C]'}`}>{t.title}</p>
                                    <p className="text-[10px] text-gray-400">
                                      {t.status === 'CANCELADA' ? `No realizada${t.cancelNote ? ': ' + t.cancelNote.slice(0, 40) + (t.cancelNote.length > 40 ? '…' : '') : ''}` : `Para: ${t.assignedTo?.fullName || 'Mayra'}`}
                                    </p>
                                  </div>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    t.priority === 'URGENTE' ? 'bg-rose-100 text-rose-700'
                                    : t.priority === 'ALTA' ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-500'
                                  }`}>{t.priority}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // ===== VISTA LISTA (HOY / FECHA) =====
                return (
                  <div className="space-y-4">
                    {controls}

                    {filteredTasks.length === 0 ? (
                      <div className="bg-white/95 rounded-2xl p-8 border border-white/80 text-center text-xs text-gray-400">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                        <p className="font-semibold text-gray-600">Sin tareas para este día</p>
                        <p className="mt-1">Prueba otra fecha o crea una nueva tarea.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTasks.map((task) => {
                          const isDone = task.status === 'COMPLETADA';
                          return (
                            <div
                              key={task.id}
                              onClick={() => setSelectedTaskPopup(task)}
                              className={`bg-white/95 border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all cursor-pointer hover:shadow-md hover:border-[#166BA3]/40 ${
                                isDone ? 'border-emerald-200 bg-emerald-50/20 opacity-70' : 'border-white/80'
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    task.priority === 'URGENTE' ? 'bg-rose-100 text-rose-700'
                                    : task.priority === 'ALTA' ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                  }`}>{task.priority}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                    className="text-gray-300 hover:text-rose-500 transition-colors"
                                  ><Trash2 size={13} /></button>
                                </div>
                                <h3 className={`text-sm font-bold text-[#1E2A3C] ${isDone ? 'line-through text-gray-400' : ''}`}>{task.title}</h3>
                                {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
                                {task.fileUrl && <p className="text-[10px] text-[#166BA3] mt-1.5 flex items-center gap-1"><FileText size={11} /> Archivo adjunto</p>}
                              </div>
                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-[11px] text-gray-400">
                                  <span>Para: </span>
                                  <strong className="text-slate-700">{task.assignedTo?.fullName || 'Mayra'}</strong>
                                  {task.dueDate && <span className="block text-[10px] text-amber-600 font-medium">Vence: {new Date(task.dueDate).toLocaleDateString('es-EC')}</span>}
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task.id, task.status); }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                                    isDone ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800'
                                  }`}
                                >
                                  {isDone ? <Check size={12} /> : null}
                                  {isDone ? 'Hecha' : 'Completar'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ================= PESTAÑA: USUARIOS ================= */}
        {activeTab === 'USUARIOS' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar personal..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-[#166BA3]"
                />
              </div>

              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#166BA3] hover:bg-[#135887] text-white text-xs font-semibold shadow-sm transition-all"
              >
                <UserPlus size={15} />
                Registrar Nuevo Asistente
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users
                .filter(u => u.fullName.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()))
                .map((u) => (
                  <div key={u.id} className="bg-white/95 border border-white/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          u.role === 'ADMIN_MAYRA' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role === 'ADMIN_MAYRA' ? 'Administradora' : 'Asistente'}
                        </span>
                        {u.username !== 'mayra' && (
                          <button onClick={() => handleDeleteUser(u)} className="text-gray-300 hover:text-rose-500">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[#1E2A3C]">{u.fullName}</h3>
                      <p className="text-xs text-gray-400 font-mono">@{u.username}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        <Smartphone size={13} className="text-[#166BA3] shrink-0" />
                        <span className="font-mono">{u.phone || 'Sin WhatsApp configurado'}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <button
                        onClick={() => openEditModal(u)}
                        className="text-[#166BA3] hover:underline font-semibold"
                      >
                        Editar perfil
                      </button>
                      <button
                        onClick={() => setPwdModalUser(u)}
                        className="text-gray-500 hover:text-[#1E2A3C] font-semibold"
                      >
                        Cambiar clave
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================= PESTAÑA: WHATSAPP ================= */}
        {activeTab === 'WHATSAPP' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                  <Radio className="text-[#166BA3]" size={18} />
                  Conexión WhatsApp Evolution API
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Gestiona la instancia de WhatsApp conectada para el bot automático y las asistentes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchWaStatus}
                  disabled={waLoading || waActionLoading}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={13} className={waLoading ? 'animate-spin' : ''} />
                  Actualizar Estado
                </button>
              </div>
            </div>

            {/* Estado actual */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    isWaConnected ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-rose-500 ring-4 ring-rose-100'
                  }`}
                />
                <div>
                  <span className="text-xs font-bold text-[#1E2A3C]">
                    {isWaConnected ? 'Instancia Conectada y Operativa' : 'Instancia Desconectada / Sin sesión'}
                  </span>
                  <p className="text-[11px] text-gray-400">
                    Instancia: <strong className="text-slate-600">{waStatus?.instanceName || 'mayra_castillo'}</strong> · Estado: <span className="font-mono">{waStatus?.state || 'desconocido'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isWaConnected ? (
                  <button
                    onClick={handleConnectWa}
                    disabled={waActionLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#166BA3] text-white hover:bg-[#135887] shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <QrCode size={14} />
                    {waActionLoading ? 'Generando QR...' : 'Generar Código QR'}
                  </button>
                ) : (
                  <button
                    onClick={handleLogoutWa}
                    disabled={waActionLoading}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <PowerOff size={13} />
                    Desconectar WhatsApp
                  </button>
                )}

                <button
                  onClick={handleRestartWa}
                  disabled={waActionLoading}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50"
                  title="Reiniciar Instancia"
                >
                  <RotateCw size={13} />
                  Reiniciar
                </button>
              </div>
            </div>

            {/* Visualizador de Código QR */}
            {qrCode && !isWaConnected && (
              <div className="p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-[#166BA3]/40 flex flex-col items-center justify-center text-center space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#166BA3]">
                  Escanea para vincular WhatsApp
                </span>
                <p className="text-xs text-gray-500 max-w-sm">
                  Abre WhatsApp en el celular &gt; Dispositivos vinculados &gt; Vincular un dispositivo y apunta tu cámara al código:
                </p>
                <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="Código QR WhatsApp" className="w-64 h-64 object-contain rounded-lg" />
                </div>
                <button
                  onClick={handleConnectWa}
                  disabled={waActionLoading}
                  className="text-xs text-[#166BA3] hover:underline font-semibold flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Regenerar código QR si expiró
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Ver Tarea */}
      {selectedTaskPopup && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl relative border border-gray-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  selectedTaskPopup.priority === 'URGENTE' ? 'bg-rose-100 text-rose-700'
                  : selectedTaskPopup.priority === 'ALTA' ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
                }`}>{selectedTaskPopup.priority}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  selectedTaskPopup.status === 'COMPLETADA' ? 'bg-emerald-100 text-emerald-700'
                  : selectedTaskPopup.status === 'CANCELADA' ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
                }`}>{selectedTaskPopup.status === 'CANCELADA' ? 'No realizada' : selectedTaskPopup.status}</span>
              </div>
              <button
                onClick={() => { setSelectedTaskPopup(null); setShowCancelForm(false); setCancelNoteInput(''); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <h3 className="text-base font-bold text-[#1E2A3C] leading-snug">{selectedTaskPopup.title}</h3>

              {selectedTaskPopup.dueDate && (
                <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                  <Calendar size={13} />
                  Fecha límite: {new Date(selectedTaskPopup.dueDate).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}

              {selectedTaskPopup.description && (
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedTaskPopup.description}
                </div>
              )}

              {/* Motivo de no realización */}
              {selectedTaskPopup.cancelNote && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 leading-relaxed">
                  <p className="font-bold mb-1 flex items-center gap-1">
                    <AlertCircle size={13} /> Motivo / Inconveniente:
                  </p>
                  <p className="whitespace-pre-wrap">{selectedTaskPopup.cancelNote}</p>
                </div>
              )}

              {selectedTaskPopup.fileUrl ? (
                <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-sky-100 text-[#166BA3] flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1E2A3C] truncate">{selectedTaskPopup.fileName || 'Archivo adjunto'}</p>
                      <p className="text-[10px] text-gray-400">Descarga directa</p>
                    </div>
                  </div>
                  <a href={selectedTaskPopup.fileUrl} target="_blank" rel="noreferrer" download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#166BA3] hover:bg-[#135887] text-white text-xs font-semibold transition-colors shrink-0">
                    Descargar
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 italic text-center">
                  Sin archivos adjuntos.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Asignado a</span>
                  <span className="font-bold text-slate-700">{selectedTaskPopup.assignedTo?.fullName || 'Mayra'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Creado por</span>
                  <span className="font-bold text-slate-700">{selectedTaskPopup.createdBy?.fullName || 'Mayra'}</span>
                </div>
              </div>

              {/* Formulario "No se pudo realizar" */}
              {showCancelForm && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-red-800">¿Por qué no se pudo realizar?</p>
                  <textarea
                    rows={3}
                    value={cancelNoteInput}
                    onChange={(e) => setCancelNoteInput(e.target.value)}
                    placeholder="Describe el inconveniente o motivo..."
                    className="w-full px-3 py-2 rounded-lg border border-red-200 text-xs text-slate-700 focus:outline-none focus:border-red-400 resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setShowCancelForm(false); setCancelNoteInput(''); }}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >Cancelar</button>
                    <button
                      onClick={() => handleCancelTask(selectedTaskPopup.id, cancelNoteInput)}
                      className="px-4 py-1.5 text-xs font-bold bg-red-600 text-white hover:bg-red-700 rounded-lg"
                    >Guardar motivo</button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer acciones */}
            <div className="px-6 pb-5 border-t border-slate-100 pt-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedTaskPopup.status !== 'COMPLETADA' && selectedTaskPopup.status !== 'CANCELADA' && (
                  <button
                    onClick={() => { handleToggleTaskStatus(selectedTaskPopup.id, selectedTaskPopup.status); setSelectedTaskPopup(null); }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                  >
                    ✓ Marcar como Completada
                  </button>
                )}
                {selectedTaskPopup.status === 'COMPLETADA' && (
                  <button
                    onClick={() => { handleToggleTaskStatus(selectedTaskPopup.id, selectedTaskPopup.status); setSelectedTaskPopup(null); }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                  >
                    Reabrir Tarea
                  </button>
                )}
                {selectedTaskPopup.status !== 'COMPLETADA' && !showCancelForm && (
                  <button
                    onClick={() => setShowCancelForm(true)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all"
                  >
                    ✗ No se pudo realizar
                  </button>
                )}
                {selectedTaskPopup.status === 'CANCELADA' && (
                  <button
                    onClick={() => { handleToggleTaskStatus(selectedTaskPopup.id, 'CANCELADA'); setSelectedTaskPopup(null); }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                  >
                    Reabrir Tarea
                  </button>
                )}
                <button
                  onClick={() => { setSelectedTaskPopup(null); setShowCancelForm(false); setCancelNoteInput(''); }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-medium ml-auto"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Tarea */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative border border-gray-100">
            <button
              onClick={() => setIsTaskModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                  <CheckSquare className="text-[#166BA3]" size={18} />
                  Crear Nueva Tarea
                </h3>
                <p className="text-xs text-gray-400">Asigna trabajo a ti o tus asistentes</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Título de la tarea *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ej. Revisar anexo ATS de Cliente X"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción / Notas</label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Detalles sobre lo que se debe hacer..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Prioridad</label>
                  <select
                    value={taskPriority}
                    onChange={(e: any) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Asignar a</label>
                  <select
                    value={taskAssignedToId}
                    onChange={(e) => setTaskAssignedToId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                  >
                    <option value="">A mí misma (Mayra)</option>
                    {users
                      .filter((u) => u.id !== user?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} (@{u.username})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha Límite (Opcional)</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Archivo Adjunto (Opcional)</label>
                <input
                  type="file"
                  onChange={(e) => setTaskFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingTask}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#166BA3] text-white hover:bg-[#135887] shadow-sm disabled:opacity-50"
                >
                  {submittingTask ? 'Guardando...' : 'Crear Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative border border-gray-100">
            <button onClick={closeUserModal} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <h3 className="text-base font-bold text-[#1E2A3C]">
                {editingUserId ? 'Editar Asistente' : 'Nuevo Asistente'}
              </h3>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Número WhatsApp (para alertas y traspaso de mando del Bot)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 593983776219 o 0983776219"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  El bot notificará a este número cuando se transfiera un cliente.
                </p>
              </div>
              {!editingUserId && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Usuario (Login) *</label>
                    <input
                      type="text"
                      required
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña *</label>
                    <input
                      type="password"
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C]"
                    />
                  </div>
                </>
              )}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button type="button" onClick={closeUserModal} className="px-3.5 py-2 rounded-xl text-xs text-gray-600">
                  Cancelar
                </button>
                <button type="submit" disabled={submittingUser} className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#166BA3] text-white">
                  {submittingUser ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambiar Clave */}
      {pwdModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative border border-gray-100">
            <button onClick={() => setPwdModalUser(null)} className="absolute right-4 top-4 text-gray-400">
              <X size={18} />
            </button>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <h3 className="text-sm font-bold text-[#1E2A3C]">Cambiar Contraseña: {pwdModalUser.fullName}</h3>
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="Nueva contraseña (mínimo 4 caracteres)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
              />
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setPwdModalUser(null)} className="px-3 py-1.5 text-xs text-gray-600">
                  Cancelar
                </button>
                <button type="submit" disabled={pwdSubmitting} className="px-4 py-1.5 text-xs font-semibold bg-[#166BA3] text-white rounded-xl">
                  {pwdSubmitting ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#EEF3FA] flex items-center justify-center"><div className="w-8 h-8 border-3 border-[#166BA3] border-t-transparent rounded-full animate-spin" /></div>}>
      <ConfiguracionView />
    </Suspense>
  );
}
