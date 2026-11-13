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
  X,
} from 'lucide-react';

interface UserItem {
  id: number;
  username: string;
  fullName: string;
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
  const [submittingTask, setSubmittingTask] = useState(false);

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

  // Crear Tarea
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !taskTitle.trim()) return;
    setSubmittingTask(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          priority: taskPriority,
          dueDate: taskDueDate || undefined,
          assignedToId: taskAssignedToId ? parseInt(taskAssignedToId, 10) : user?.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: 'Tarea creada con éxito.' });
        setIsTaskModalOpen(false);
        setTaskTitle('');
        setTaskDescription('');
        setTaskDueDate('');
        setTaskPriority('MEDIA');
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
    setFormPassword('');
    setFormAvatarUrl('');
    setFormRole('ASISTENTE');
    setIsModalOpen(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUserId(u.id);
    setFormUsername(u.username);
    setFormFullName(u.fullName);
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
            ) : tasks.length === 0 ? (
              <div className="bg-white/95 rounded-2xl p-8 border border-white/80 text-center text-xs text-gray-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                <p className="font-semibold text-gray-600">No hay tareas pendientes</p>
                <p className="mt-1">Crea una nueva tarea para ti o tus asistentes usando el botón de arriba.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map((task) => {
                  const isDone = task.status === 'COMPLETADA';
                  return (
                    <div
                      key={task.id}
                      className={`bg-white/95 border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all ${
                        isDone ? 'border-emerald-200 bg-emerald-50/20 opacity-70' : 'border-white/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              task.priority === 'URGENTE'
                                ? 'bg-rose-100 text-rose-700'
                                : task.priority === 'ALTA'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {task.priority}
                          </span>

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-gray-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <h3 className={`text-sm font-bold text-[#1E2A3C] ${isDone ? 'line-through text-gray-400' : ''}`}>
                          {task.title}
                        </h3>

                        {task.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[11px] text-gray-400">
                          <span>Para: </span>
                          <strong className="text-slate-700">
                            {task.assignedTo?.fullName || 'Mayra'}
                          </strong>
                          {task.dueDate && (
                            <span className="block text-[10px] text-amber-600 font-medium">
                              Vence: {new Date(task.dueDate).toLocaleDateString('es-EC')}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleToggleTaskStatus(task.id, task.status)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800'
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
                          {u.role === 'ADMIN_MAYRA' ? 'Administradora' : 'Asistente (Modo Ciego)'}
                        </span>
                        {u.username !== 'mayra' && (
                          <button onClick={() => handleDeleteUser(u)} className="text-gray-300 hover:text-rose-500">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[#1E2A3C]">{u.fullName}</h3>
                      <p className="text-xs text-gray-400 font-mono">@{u.username}</p>
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
