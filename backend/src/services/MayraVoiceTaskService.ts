// backend/src/services/MayraVoiceTaskService.ts
import { prisma } from '../lib/prisma';
import { EvolutionApiService } from './EvolutionApiService';

let ioInstance: any = null;

export interface ExtractedTaskData {
  isTask: boolean;
  title?: string;
  description?: string;
  priority?: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  assigneeName?: string | null;
  dueRelativeDays?: number | null; // Días a partir de hoy (0 = hoy, 1 = mañana, etc.)
}

export class MayraVoiceTaskService {
  public static setSocketIo(io: any) {
    ioInstance = io;
  }

  /**
   * Determina si el texto o nota de voz de Mayra contiene una instrucción de tarea,
   * la extrae estructuradamente con IA, la crea en la base de datos y le confirma por WhatsApp.
   */
  public static async processMayraMessage({
    mayraUser,
    mayraPhone,
    rawText,
    audioUrl,
    audioFileName,
  }: {
    mayraUser: { id: number; fullName: string };
    mayraPhone: string;
    rawText: string;
    audioUrl?: string | null;
    audioFileName?: string | null;
  }): Promise<{ created: boolean; task?: any; reason?: string }> {
    if (!rawText || rawText.trim().length < 5) {
      return { created: false, reason: 'TEXTO_MUY_CORTO' };
    }

    // 1. Obtener lista de asistentes activas en el CRM
    const assistants = await prisma.user.findMany({
      where: { role: 'ASISTENTE', isActive: true },
      select: { id: true, fullName: true, username: true },
    });

    const assistantListStr = assistants.length > 0
      ? assistants.map((a) => `- ID ${a.id}: ${a.fullName} (@${a.username})`).join('\n')
      : 'No hay asistentes registradas, asignar a Mayra.';

    // 2. Extraer intención y estructura con LLM (DeepSeek / Gemini)
    const extracted = await this.extractTaskWithLlm(rawText, assistantListStr);

    if (!extracted.isTask || !extracted.title) {
      return { created: false, reason: 'NO_ES_INSTRUCCION_DE_TAREA' };
    }

    // 3. Determinar asignación de la tarea
    let assignedUserId = mayraUser.id;

    if (assistants.length > 0) {
      if (extracted.assigneeName) {
        const queryName = extracted.assigneeName.toLowerCase();
        const matched = assistants.find((a) =>
          a.fullName.toLowerCase().includes(queryName) ||
          a.username.toLowerCase().includes(queryName)
        );
        if (matched) {
          assignedUserId = matched.id;
        } else {
          // Asignar a la primera asistente por defecto
          assignedUserId = assistants[0].id;
        }
      } else {
        // Si no especificó nombre, repartir por rotación / a la primera asistente
        assignedUserId = assistants[0].id;
      }
    }

    // 4. Calcular dueDate
    let calculatedDueDate: Date | null = null;
    if (extracted.dueRelativeDays !== undefined && extracted.dueRelativeDays !== null) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + extracted.dueRelativeDays);
      targetDate.setHours(18, 0, 0, 0); // 6:00 PM fin de jornada laboral
      calculatedDueDate = targetDate;
    }

    // 5. Crear la tarea en la base de datos
    const newTask = await prisma.task.create({
      data: {
        title: extracted.title.trim(),
        description: extracted.description?.trim() || rawText.trim(),
        priority: extracted.priority || 'MEDIA',
        status: 'PENDIENTE',
        dueDate: calculatedDueDate,
        createdById: mayraUser.id,
        assignedToId: assignedUserId,
        fileUrl: audioUrl || null,
        fileName: audioFileName || (audioUrl ? 'Nota_de_voz_Mayra.ogg' : null),
        fileType: audioUrl ? 'audio/ogg' : null,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, username: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    // 6. Notificar en vivo al CRM por WebSockets
    if (ioInstance) {
      ioInstance.emit('task:created', {
        task: newTask,
        source: 'MAYRA_VOICE_WHATSAPP',
      });
    }

    // 7. Enviar mensaje de confirmación determinista a Mayra por WhatsApp
    const assignedName = newTask.assignedTo?.fullName || 'Equipo';
    const dueDateFormatted = calculatedDueDate
      ? calculatedDueDate.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'Para hoy / próximo vencimiento';

    const confirmationText = [
      `✅ *Tarea registrada y asignada al sistema*`,
      `📌 *Título:* ${newTask.title}`,
      `👤 *Asignada a:* ${assignedName}`,
      `⚡ *Prioridad:* ${newTask.priority}`,
      `📅 *Límite:* ${dueDateFormatted}`,
      audioUrl ? `🎙️ _Nota de voz adjuntada a la ficha de la tarea._` : '',
      ``,
      `_Tus asistentes ya la tienen visible en su checklist diario del CRM._`,
    ].filter(Boolean).join('\n');

    await EvolutionApiService.sendTextMessage({
      number: mayraPhone,
      text: confirmationText,
    }).catch((err) => console.error('[MayraVoiceTaskService] Error enviando WhatsApp:', err));

    return { created: true, task: newTask };
  }

  /**
   * Extracción estructurada mediante LLM
   */
  private static async extractTaskWithLlm(text: string, assistantList: string): Promise<ExtractedTaskData> {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      // Fallback heurístico si no hay API key disponible
      return this.heuristicFallback(text);
    }

    const systemPrompt = `Eres el asistente de operaciones del Estudio Contable Mayra Castillo.
Tu objetivo es analizar un mensaje (texto o transcripción de audio) enviado por Mayra Castillo (la jefa del estudio) y determinar si contiene una orden, instrucción o asignación de trabajo para sus asistentes contables.

LISTA DE ASISTENTES DISPONIBLES EN EL SISTEMA:
${assistantList}

REGLAS DE EVALUACIÓN:
1. Si el mensaje es una simple conversación social, saludo, pregunta genérica sin orden de trabajo (ej: "hola chicas cómo están", "ya voy en camino", "buenos días"), responde:
{"isTask": false}

2. Si el mensaje contiene una INSTRUCCIÓN de trabajo contable, tributario, societario, revisión o contacto (ej: "por favor hacer la declaración de Pedro Delgado", "revisar la clave de Darma", "llamar al cliente para el impuesto", "conciliar octubre de Reyes", "chicas no se olviden de enviar las facturas"), responde con JSON estricto:
{
  "isTask": true,
  "title": "Título conciso y claro de la tarea (máx 60 caracteres)",
  "description": "Explicación detallada de lo que pidió Mayra",
  "priority": "BAJA" | "MEDIA" | "ALTA" | "URGENTE",
  "assigneeName": "Nombre de la asistente si Mayra la mencionó específicamente, o null",
  "dueRelativeDays": 0 para hoy, 1 para mañana, o null si no especifica fecha
}

Responde ÚNICAMENTE con el objeto JSON, sin formato markdown ni texto adicional.`;

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        return this.heuristicFallback(text);
      }

      const json = await response.json();
      const rawContent = json?.choices?.[0]?.message?.content?.trim();
      if (!rawContent) return this.heuristicFallback(text);

      const parsed = JSON.parse(rawContent);
      return {
        isTask: Boolean(parsed.isTask),
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority || 'MEDIA',
        assigneeName: parsed.assigneeName || null,
        dueRelativeDays: parsed.dueRelativeDays ?? null,
      };
    } catch (err) {
      console.error('[MayraVoiceTaskService] Error llamando a LLM:', err);
      return this.heuristicFallback(text);
    }
  }

  /**
   * Fallback determinista en caso de corte de red o API LLM no disponible
   */
  private static heuristicFallback(text: string): ExtractedTaskData {
    const lower = text.toLowerCase();
    const taskKeywords = [
      'declarar', 'declaracion', 'revisar', 'hacer', 'anexo', 'iva', 'sri',
      'conciliar', 'subir', 'tramite', 'por favor', 'tarea', 'clave', 'firma',
      'enviar', 'factura', 'retencion', 'pendiente', 'cobrar', 'cliente',
    ];

    const containsKeyword = taskKeywords.some((kw) => lower.includes(kw));
    if (!containsKeyword) {
      return { isTask: false };
    }

    let priority: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE' = 'MEDIA';
    if (lower.includes('urgente') || lower.includes('hoy') || lower.includes('apuro') || lower.includes('multa')) {
      priority = 'URGENTE';
    } else if (lower.includes('importante') || lower.includes('mañana')) {
      priority = 'ALTA';
    }

    return {
      isTask: true,
      title: text.slice(0, 50).trim() + (text.length > 50 ? '...' : ''),
      description: text.trim(),
      priority,
      assigneeName: null,
      dueRelativeDays: lower.includes('hoy') ? 0 : lower.includes('mañana') ? 1 : null,
    };
  }
}
