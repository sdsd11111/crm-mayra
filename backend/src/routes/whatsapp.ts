// backend/src/routes/whatsapp.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { WhatsAppBotEngine } from '../services/WhatsAppBotEngine';
import { EvolutionApiService } from '../services/EvolutionApiService';

import { BotOrchestrator } from '../services/bot/botOrchestrator';
import { MediaIngestionService } from '../services/bot/mediaIngestionService';
import { OutboundQueueService } from '../services/bot/outboundQueueService';
import { BunnyStorageService } from '../services/BunnyStorageService';
import { MayraVoiceTaskService } from '../services/MayraVoiceTaskService';
import multer from 'multer';
import { io } from '../index';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB límite
});

const router = Router();

/**
 * POST /api/whatsapp/webhook
 * Receptor oficial de Webhooks de Evolution API (messages.upsert).
 * Esta ruta no requiere JWT porque es invocada directamente por el servidor Evolution.
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const event = body?.event;
    console.log('📩 [Evolution Webhook Event]:', event || 'Unknown');

    const key = body?.data?.key;
    const remoteJid = key?.remoteJid || '';
    const messageId = key?.id;

    // 1. Filtrar inmediatamente grupos (@g.us), difusiones y estados
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('status@broadcast') || remoteJid.includes('@broadcast')) {
      res.status(200).json({ status: 'IGNORED_GROUP_OR_BROADCAST' });
      return;
    }

    const cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');

    // Verificar si el número pertenece al equipo interno (Mayra o Asistentes configuradas en el CRM)
    const assistantUser = await prisma.user.findFirst({
      where: {
        phone: { not: null },
        isActive: true,
      },
    });

    // Buscar si el remitente coincide con algún usuario interno (Mayra o Asistente)
    const internalUsers = await prisma.user.findMany({
      where: { phone: { not: null }, isActive: true },
      select: { id: true, fullName: true, phone: true, role: true },
    });
    const matchedInternal = internalUsers.find(
      (u) => u.phone && (cleanPhone.endsWith(u.phone.replace(/\D/g, '').slice(-9)) || u.phone.replace(/\D/g, '') === cleanPhone)
    );

    // Restricción de prueba / desarrollo solicitada: El bot responde al número autorizado de pruebas O a usuarios del equipo
    const ALLOWED_BOT_PHONE = '593983776219';
    const isBotAllowed =
      cleanPhone.endsWith('983776219') ||
      cleanPhone === ALLOWED_BOT_PHONE ||
      Boolean(matchedInternal);

    if (!isBotAllowed) {
      console.log(`[Bot Filter]: Ignorando mensaje de ${cleanPhone} (solo responde a +593 98 377 6219 y personal registrado)`);
      res.status(200).json({ status: 'IGNORED_UNAUTHORIZED_PHONE', phone: cleanPhone });
      return;
    }

    // 2. Control de idempotencia anti-duplicados por messageId
    if (messageId) {
      const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
        where: { messageId },
      });
      if (alreadyProcessed) {
        res.status(200).json({ status: 'ALREADY_PROCESSED' });
        return;
      }
      // Registrar evento recibido
      await prisma.processedWebhookEvent.create({
        data: { messageId },
      }).catch(() => {});
    }

    let messageContent =
      body.data?.message?.conversation ||
      body.data?.message?.extendedTextMessage?.text ||
      body.data?.message?.imageMessage?.caption ||
      '';

    let incomingMedia: any = null;

    // 4. Ingesta Multimedia Real (Audio, Foto, Documento/PDF, Video a BunnyCDN)
    if (key?.fromMe !== true && body.data?.message) {
      // Buscar si el cliente ya está registrado para agrupar por su ID/RUC
      const registeredClient = await prisma.clientOwner.findFirst({
        where: {
          OR: [
            { whatsappPhone: cleanPhone },
            { whatsappPhone: { endsWith: cleanPhone.slice(-9) } },
          ],
        },
        include: { taxpayers: { select: { ruc: true }, take: 1 } },
      });
      const clientIdentifier = registeredClient?.taxpayers?.[0]?.ruc || (registeredClient ? `cliente_${registeredClient.id}` : null);

      incomingMedia = await MediaIngestionService.processIncomingMedia({
        phone: cleanPhone,
        clientIdentifier,
        messageKeyId: messageId,
        messageData: body.data.message,
      });

      if (incomingMedia) {
        if (incomingMedia.mediaType === 'AUDIO' && incomingMedia.transcription) {
          messageContent = `🎤 [Nota de voz]: "${incomingMedia.transcription}"`;
        } else if (incomingMedia.mediaType === 'IMAGE') {
          if (incomingMedia.ocrText) {
            const categoryTag = incomingMedia.docCategory ? `[${incomingMedia.docCategory}]` : '';
            messageContent = messageContent
              ? `📷 [Foto ${categoryTag}]: ${messageContent}\n[Texto extraído/OCR]:\n${incomingMedia.ocrText}`
              : `📷 [Foto ${categoryTag} enviada por cliente]\n[Texto extraído/OCR]:\n${incomingMedia.ocrText}`;
          } else {
            messageContent = messageContent ? `📷 [Foto]: ${messageContent}` : '📷 [Foto adjuntada por el cliente]';
          }
        } else if (incomingMedia.mediaType === 'VIDEO') {
          messageContent = messageContent ? `🎥 [Video]: ${messageContent}` : '🎥 [Video recibido del cliente]';
        } else if (incomingMedia.mediaType === 'DOCUMENT') {
          messageContent = messageContent ? `📄 [Documento ${incomingMedia.fileName}]: ${messageContent}` : `📄 [Documento adjuntado: ${incomingMedia.fileName}]`;
        }
      }
    }

    // 3. Manejo de mensajes salientes (fromMe === true): Evitar auto-sabotaje y detectar intervención humana
    if (key?.fromMe === true) {
      // Buscar ticket activo
      const ticket = await prisma.chatTicket.findFirst({
        where: { whatsappPhone: cleanPhone },
        orderBy: { updatedAt: 'desc' },
      });

      if (ticket && messageContent) {
        // Guardar mensaje como intervención humana (desde celular físico o WhatsApp Web)
        await prisma.chatMessage.create({
          data: {
            ticketId: ticket.id,
            sender: 'HUMAN',
            senderType: 'HUMAN',
            evolutionMessageId: messageId || null,
            content: messageContent,
          },
        });

        // Pausar el bot para que no interrumpa al humano
        await prisma.chatTicket.update({
          where: { id: ticket.id },
          data: { botPaused: true },
        });

        // Notificar al CRM por WebSocket
        if (io) {
          io.emit('whatsapp:new-message', {
            ticketId: ticket.id,
            queue: ticket.queueType,
            clientPhone: cleanPhone,
            botPaused: true,
            isHumanReply: true,
          });
        }
      }

      res.status(200).json({ status: 'HUMAN_INTERVENTION_RECORDED' });
      return;
    }

    // 4. Mensaje entrante del cliente
    if (cleanPhone && messageContent) {
      // 4.0 INTERCEPTOR EXCLUSIVO DE MAYRA: Generador determinista de Tareas por nota de voz o texto
      if (matchedInternal && matchedInternal.role === 'ADMIN_MAYRA') {
        const textToEvaluate = (incomingMedia?.mediaType === 'AUDIO' && incomingMedia.transcription)
          ? incomingMedia.transcription
          : messageContent;

        const voiceTaskResult = await MayraVoiceTaskService.processMayraMessage({
          mayraUser: { id: matchedInternal.id, fullName: matchedInternal.fullName },
          mayraPhone: cleanPhone,
          rawText: textToEvaluate,
          audioUrl: incomingMedia?.mediaType === 'AUDIO' ? incomingMedia.mediaUrl : null,
          audioFileName: incomingMedia?.mediaType === 'AUDIO' ? incomingMedia.fileName : null,
        });

        if (voiceTaskResult.created) {
          console.log(`⚡ [MayraVoiceTaskService] Tarea creada desde WhatsApp por Mayra: "${voiceTaskResult.task.title}" (ID: ${voiceTaskResult.task.id})`);
          res.status(200).json({
            status: 'TASK_CREATED_BY_MAYRA',
            taskId: voiceTaskResult.task.id,
            title: voiceTaskResult.task.title,
          });
          return;
        }
      }

      // 4.1 COMANDO DE RESET: Si el usuario escribe /reset o /reiniciar, limpiar tickets e historial para pruebas
      const trimmedText = messageContent.trim().toLowerCase();
      if (trimmedText === '/reset' || trimmedText === '/reiniciar') {
        const tickets = await prisma.chatTicket.findMany({
          where: {
            OR: [
              { whatsappPhone: cleanPhone },
              { whatsappPhone: { endsWith: cleanPhone.slice(-9) } },
            ],
          },
          select: { id: true },
        });

        const ticketIds = tickets.map((t) => t.id);
        if (ticketIds.length > 0) {
          // Eliminar mensajes asociados
          await prisma.chatMessage.deleteMany({
            where: { ticketId: { in: ticketIds } },
          });
          // Eliminar tickets
          await prisma.chatTicket.deleteMany({
            where: { id: { in: ticketIds } },
          });
        }

        // Enviar confirmación al WhatsApp
        await EvolutionApiService.sendTextMessage({
          number: cleanPhone,
          text: '🔄 *Historial reiniciado exitosamente.*\nSe borraron tus tickets y mensajes previos. Ahora puedes iniciar una conversación desde cero como cliente nuevo.',
        });

        // Notificar al CRM por WebSocket
        if (io) {
          io.emit('whatsapp:new-message', {
            action: 'RESET',
            clientPhone: cleanPhone,
          });
        }

        res.status(200).json({ status: 'RESET_COMPLETED', cleanedTickets: ticketIds.length });
        return;
      }

      // Verificar si el ticket está pausado por intervención humana
      const activeTicket = await prisma.chatTicket.findFirst({
        where: { whatsappPhone: cleanPhone },
        orderBy: { updatedAt: 'desc' },
      });

      if (activeTicket?.botPaused) {
        // Solo guardar y emitir al CRM para las asistentes/Mayra, SIN disparar el bot
        const clientMsg = await prisma.chatMessage.create({
          data: {
            ticketId: activeTicket.id,
            sender: 'CLIENT',
            senderType: 'CLIENT',
            evolutionMessageId: messageId || null,
            content: messageContent || (incomingMedia ? `[Archivo: ${incomingMedia.fileName}]` : 'Mensaje multimedia'),
            mediaType: incomingMedia?.mediaType || null,
            mediaUrl: incomingMedia?.mediaUrl || null,
            mimeType: incomingMedia?.mimeType || null,
            fileName: incomingMedia?.fileName || null,
          },
        });

        if (io) {
          io.emit('whatsapp:new-message', {
            ticketId: activeTicket.id,
            queue: activeTicket.queueType,
            clientPhone: cleanPhone,
            message: clientMsg,
            botPaused: true,
          });
        }

        res.status(200).json({ status: 'BOT_PAUSED_HUMAN_IN_CONTROL' });
        return;
      }

      // Si el bot está activo, procesar mediante el BotOrchestrator
      BotOrchestrator.processMessage({
        fromPhone: cleanPhone,
        senderName: body.data?.pushName,
        messageText: messageContent || (incomingMedia ? `[Archivo adjunto: ${incomingMedia.fileName}]` : ''),
        mediaInfo: incomingMedia || undefined,
      }).catch((err) => console.error('[BotOrchestrator Error]:', err));
    }

    res.status(200).json({ status: 'SUCCESS' });
  } catch (error) {
    console.error('Error procesando webhook de Evolution API:', error);
    res.status(500).json({ status: 'ERROR' });
  }
});

// Todas las rutas siguientes requieren autenticación en el CRM
router.use(authenticateToken);

// Alias retrocompatible para el frontend
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await EvolutionApiService.getConnectionState();
    res.json({
      success: true,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'mayra_castillo',
      apiUrl: process.env.EVOLUTION_API_URL || 'http://178.238.238.158:8080',
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/whatsapp/instance-status
 * Consulta el estado de conexión de la instancia de Evolution API.
 */
router.get('/instance-status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await EvolutionApiService.getConnectionState();
    res.json({
      success: true,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'mayra_castillo',
      apiUrl: process.env.EVOLUTION_API_URL || 'http://178.238.238.158:8080',
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/whatsapp/instance-connect
 * Solicita el código QR para conectar WhatsApp.
 */
router.post('/instance-connect', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Si la instancia no está creada, intentamos crearla primero
    await EvolutionApiService.createInstance();
    const qrResult = await EvolutionApiService.getQrCode();
    res.json(qrResult);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/whatsapp/instance-logout
 * Desconecta la sesión de WhatsApp de Mayra.
 */
router.post('/instance-logout', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await EvolutionApiService.logoutInstance();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/whatsapp/instance-restart
 * Reinicia la instancia de WhatsApp.
 */
router.post('/instance-restart', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await EvolutionApiService.restartInstance();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/whatsapp/chats
 * Obtiene la lista de chats y tickets abiertos filtrados por bandeja.
 *
 * CONTROL DE ACCESO POR ROL:
 * - ADMIN_MAYRA / COBRADOR → puede ver todas las colas o filtrar por ?queue=
 * - ASISTENTE              → solo ve OPERATIVA_CHICAS (forzado a nivel backend)
 */
router.get('/chats', async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user!.role;
    const { queue } = req.query;

    const where: any = {};

    if (userRole === 'ASISTENTE') {
      // MODO CIEGO DE COLA: Las asistentes SOLO ven OPERATIVA_CHICAS
      where.queueType = 'OPERATIVA_CHICAS';
    } else {
      // ADMIN o COBRADOR pueden filtrar o ver todo
      if (queue && queue !== 'ALL') {
        where.queueType = queue;
      }
    }

    const tickets = await prisma.chatTicket.findMany({
      where,
      include: {
        clientOwner: {
          include: {
            taxpayers: {
              include: {
                documents: {
                  take: 3,
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      count: tickets.length,
      data: tickets,
      userRole, // Frontend usa esto para decidir qué pestañas mostrar
    });
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({ success: false, message: 'Error al consultar chats.' });
  }
});

/**
 * POST /api/whatsapp/send-reply
 * Envío manual de respuesta desde el CRM hacia el cliente.
 * ASISTENTE solo puede responder tickets de OPERATIVA_CHICAS.
 */
router.post('/send-reply', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, message, ticketId } = req.body;
    const userRole = req.user!.role;

    if (!phone || !message) {
      res.status(400).json({ success: false, message: 'Faltan parámetros (phone, message).' });
      return;
    }

    // Verificar que ASISTENTE solo pueda responder tickets OPERATIVA_CHICAS
    if (userRole === 'ASISTENTE' && ticketId) {
      const ticket = await prisma.chatTicket.findUnique({
        where: { id: parseInt(ticketId, 10) },
      });

      if (!ticket || ticket.queueType !== 'OPERATIVA_CHICAS') {
        res.status(403).json({
          success: false,
          message: 'Acceso denegado: Solo puedes responder tickets de tu cola OPERATIVA_CHICAS.',
        });
        return;
      }
    }

    const result = await EvolutionApiService.sendTextMessage({
      number: phone,
      text: message,
    });

    if (ticketId) {
      // Registrar mensaje humano en BD
      await prisma.chatMessage.create({
        data: {
          ticketId: parseInt(ticketId, 10),
          sender: 'HUMAN',
          senderType: 'HUMAN',
          content: message,
        },
      });

      // Pausar automáticamente el bot para que no interrumpa al humano
      await prisma.chatTicket.update({
        where: { id: parseInt(ticketId, 10) },
        data: {
          status: 'EN_PROCESO',
          assignedToId: req.user!.id,
          botPaused: true,
          pausedById: req.user!.id,
        },
      });

      if (io) {
        io.emit('whatsapp:new-message', {
          ticketId: parseInt(ticketId, 10),
          botPaused: true,
          isHumanReply: true,
        });
      }
    }

    res.json({
      success: true,
      message: 'Mensaje enviado exitosamente vía Evolution API.',
      data: result,
    });
  } catch (error) {
    console.error('Error al responder chat:', error);
    res.status(500).json({ success: false, message: 'Error interno al enviar mensaje.' });
  }
});

/**
 * POST /api/whatsapp/send-media
 * Envío de archivos multimedia (Audios PTT, Imágenes, Videos, PDFs)
 * desde el CRM por Mayra o las asistentes hacia el WhatsApp del cliente.
 */
router.post('/send-media', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, ticketId, caption, isPtt } = req.body;
    const file = req.file;
    const userRole = req.user!.role;

    if (!phone || !file) {
      res.status(400).json({ success: false, message: 'Faltan parámetros requeridos (phone o archivo).' });
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // Validación de permisos por rol
    if (userRole === 'ASISTENTE' && ticketId) {
      const ticket = await prisma.chatTicket.findUnique({
        where: { id: parseInt(ticketId, 10) },
      });
      if (!ticket || ticket.queueType !== 'OPERATIVA_CHICAS') {
        res.status(403).json({
          success: false,
          message: 'Acceso denegado: Solo puedes responder tickets de OPERATIVA_CHICAS.',
        });
        return;
      }
    }

    // 1. Obtener identificador del cliente si existe
    const registeredClient = await prisma.clientOwner.findFirst({
      where: {
        OR: [
          { whatsappPhone: cleanPhone },
          { whatsappPhone: { endsWith: cleanPhone.slice(-9) } },
        ],
      },
      include: { taxpayers: { select: { ruc: true }, take: 1 } },
    });
    const clientIdentifier = registeredClient?.taxpayers?.[0]?.ruc || (registeredClient ? `cliente_${registeredClient.id}` : null);

    // 2. Subir a BunnyCDN estructurado: clientes/{id}/chat-media/...
    const { bunnyUrl } = await BunnyStorageService.uploadWhatsappMedia({
      phone: cleanPhone,
      clientIdentifier,
      fileName: file.originalname || `archivo_${Date.now()}`,
      fileBuffer: file.buffer,
      contentType: file.mimetype,
    });

    // 3. Determinar tipo de medio
    let mediaTypeStr: 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'DOCUMENT';
    if (file.mimetype.startsWith('audio/') || isPtt === 'true' || isPtt === true) {
      mediaTypeStr = 'AUDIO';
    } else if (file.mimetype.startsWith('image/')) {
      mediaTypeStr = 'IMAGE';
    } else if (file.mimetype.startsWith('video/')) {
      mediaTypeStr = 'VIDEO';
    }

    // 4. Enviar mediante Evolution API
    let sendResult: any = null;
    const isPttAudio = isPtt === 'true' || isPtt === true || (mediaTypeStr === 'AUDIO' && file.mimetype.includes('opus'));

    if (isPttAudio) {
      // Nota de voz WhatsApp real PTT (Push-To-Talk)
      const base64Audio = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      sendResult = await EvolutionApiService.sendWhatsAppAudio({
        number: cleanPhone,
        base64: base64Audio,
      });
    } else {
      const evoMediaType = mediaTypeStr === 'IMAGE' ? 'image' : mediaTypeStr === 'VIDEO' ? 'video' : 'document';
      sendResult = await EvolutionApiService.sendMediaMessage({
        number: cleanPhone,
        mediaUrl: bunnyUrl,
        caption: caption || '',
        fileName: file.originalname,
        mediaType: evoMediaType,
      });
    }

    // 5. Guardar en BD del CRM
    if (ticketId) {
      const tId = parseInt(ticketId, 10);
      const savedMsg = await prisma.chatMessage.create({
        data: {
          ticketId: tId,
          sender: 'HUMAN',
          senderType: 'HUMAN',
          content: caption || (mediaTypeStr === 'AUDIO' ? '🎤 [Nota de voz enviada]' : `[Archivo adjunto: ${file.originalname}]`),
          mediaType: mediaTypeStr,
          mediaUrl: bunnyUrl,
          fileName: file.originalname,
          mimeType: file.mimetype,
        },
      });

      await prisma.chatTicket.update({
        where: { id: tId },
        data: {
          status: 'EN_PROCESO',
          assignedToId: req.user!.id,
          botPaused: true,
          pausedById: req.user!.id,
        },
      });

      if (io) {
        io.emit('whatsapp:new-message', {
          ticketId: tId,
          botPaused: true,
          isHumanReply: true,
          message: savedMsg,
        });
      }
    }

    res.json({
      success: true,
      message: 'Archivo enviado exitosamente.',
      mediaUrl: bunnyUrl,
      mediaType: mediaTypeStr,
      data: sendResult,
    });
  } catch (error: any) {
    console.error('Error enviando archivo multimedia desde CRM:', error);
    res.status(500).json({ success: false, message: error.message || 'Error interno al enviar archivo.' });
  }
});

/**
 * POST /api/whatsapp/send-media-url
 * Envía un documento de la Bóveda Digital directamente al WhatsApp del cliente
 * usando una URL pública de BunnyCDN (sin re-subir el archivo).
 * Usado desde el sidebar de chat cuando la asistente pulsa "Enviar por WhatsApp"
 * sobre un documento ya almacenado en la Bóveda.
 */
router.post('/send-media-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, ticketId, mediaUrl, fileName, caption } = req.body;
    const userRole = req.user!.role;

    if (!phone || !mediaUrl || !fileName) {
      res.status(400).json({ success: false, message: 'Faltan parámetros requeridos (phone, mediaUrl, fileName).' });
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // ASISTENTE solo puede operar en tickets de OPERATIVA_CHICAS
    if (userRole === 'ASISTENTE' && ticketId) {
      const ticket = await prisma.chatTicket.findUnique({ where: { id: parseInt(ticketId, 10) } });
      if (!ticket || ticket.queueType !== 'OPERATIVA_CHICAS') {
        res.status(403).json({ success: false, message: 'Acceso denegado: Solo puedes responder tickets de OPERATIVA_CHICAS.' });
        return;
      }
    }

    // Determinar tipo de medio por extensión del nombre de archivo
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    let mediaTypeStr: 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'DOCUMENT';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) mediaTypeStr = 'IMAGE';
    else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) mediaTypeStr = 'VIDEO';

    // Mapear al formato de Evolution API
    const evoMediaType: 'image' | 'video' | 'document' =
      mediaTypeStr === 'IMAGE' ? 'image' : mediaTypeStr === 'VIDEO' ? 'video' : 'document';

    // Enviar mediante Evolution API (URL pública de BunnyCDN)
    const sendResult = await EvolutionApiService.sendMediaMessage({
      number: cleanPhone,
      mediaUrl,
      caption: caption || '',
      fileName,
      mediaType: evoMediaType,
    });

    // Registrar en BD y actualizar ticket si se proporcionó ticketId
    if (ticketId) {
      const tId = parseInt(ticketId, 10);
      const savedMsg = await prisma.chatMessage.create({
        data: {
          ticketId: tId,
          sender: 'HUMAN',
          senderType: 'HUMAN',
          content: caption || `📂 [Documento de Bóveda enviado: ${fileName}]`,
          mediaType: mediaTypeStr,
          mediaUrl,
          fileName,
          mimeType: mediaTypeStr === 'IMAGE' ? 'image/jpeg' : mediaTypeStr === 'VIDEO' ? 'video/mp4' : 'application/pdf',
        },
      });

      await prisma.chatTicket.update({
        where: { id: tId },
        data: {
          status: 'EN_PROCESO',
          assignedToId: req.user!.id,
          botPaused: true,
          pausedById: req.user!.id,
        },
      });

      // Marcar el documento como enviado por WhatsApp
      await prisma.document.updateMany({
        where: { bunnyUrl: mediaUrl },
        data: { sentByWhatsapp: true },
      });

      if (io) {
        io.emit('whatsapp:new-message', {
          ticketId: tId,
          botPaused: true,
          isHumanReply: true,
          message: savedMsg,
        });
      }
    }

    res.json({
      success: true,
      message: 'Documento de Bóveda enviado exitosamente por WhatsApp.',
      mediaUrl,
      mediaType: mediaTypeStr,
      data: sendResult,
    });
  } catch (error: any) {
    console.error('Error enviando documento de Bóveda por WhatsApp:', error);
    res.status(500).json({ success: false, message: error.message || 'Error interno.' });
  }
});

/**
 * PATCH /api/whatsapp/tickets/:id/toggle-bot
 * Pausa o reactiva el bot para un ticket específico.
 */
router.patch('/tickets/:id/toggle-bot', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const { botPaused, closeTicket } = req.body;

    const dataToUpdate: any = {};
    if (botPaused !== undefined) {
      dataToUpdate.botPaused = Boolean(botPaused);
      dataToUpdate.pausedById = botPaused ? req.user!.id : null;
    }

    if (closeTicket) {
      dataToUpdate.status = 'CERRADO';
      dataToUpdate.botPaused = false; // Al cerrar el ticket, el bot queda reactivado para futuros mensajes
    }

    const updated = await prisma.chatTicket.update({
      where: { id },
      data: dataToUpdate,
    });

    if (io) {
      io.emit('whatsapp:new-message', {
        ticketId: updated.id,
        botPaused: updated.botPaused,
        status: updated.status,
      });
    }

    res.json({
      success: true,
      message: `Bot ${updated.botPaused ? 'pausado' : 'activado'} correctamente.`,
      ticket: updated,
    });
  } catch (error) {
    console.error('Error al cambiar estado del bot:', error);
    res.status(500).json({ success: false, message: 'Error interno al actualizar bot.' });
  }
});

/**
 * POST /api/whatsapp/test-message
 * Simulador de mensaje entrante para pruebas en desarrollo (sin túnel webhook público).
 */
router.post('/test-message', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, text, senderName } = req.body;

    if (!phone || !text) {
      res.status(400).json({ success: false, message: 'Faltan parámetros (phone, text).' });
      return;
    }

    const botResponse = await WhatsAppBotEngine.handleIncomingMessage({
      fromPhone: phone,
      messageText: text,
      senderName: senderName || 'Cliente Prueba',
    });

    res.json({
      success: true,
      message: 'Mensaje simulado y procesado por el Bot.',
      botResponse,
    });
  } catch (error) {
    console.error('Error en simulador de WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Error en simulación.' });
  }
});

/**
 * GET /api/whatsapp/tax-alerts
 * Semáforo tributario y alertas de firma electrónica para el Dashboard.
 * Retorna:
 *   - clients con estado VERDE/AMARILLO/ROJO según declaraciones del mes
 *   - firmas electrónicas que expiran en <= 5 días
 */
router.get('/tax-alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    // SRI due day por dígito 9
    const SRI_DUE_DAYS: Record<number, number> = {
      1: 10, 2: 12, 3: 14, 4: 16, 5: 18,
      6: 20, 7: 22, 8: 24, 9: 26, 0: 28,
    };

    // Obtener todos los taxpayers activos con documentos del mes actual
    const taxpayers = await prisma.taxpayer.findMany({
      where: {
        regimen: { not: 'INACTIVO_CERRADO' },
      },
      include: {
        clientOwner: true,
        documents: {
          where: {
            periodYear: currentYear,
            periodMonth: currentMonth,
            category: { in: ['DECLARACION_IVA', 'DECLARACION_RENTA', 'ANEXO_ATS'] },
          },
        },
      },
    });

    // Alertas de semáforo por declaración
    const semaforo = taxpayers.map((t) => {
      const digit = t.novenoDigito ?? 0;
      const dueDay = SRI_DUE_DAYS[digit] ?? 28;
      const hasDeclaration = t.documents.length > 0;
      const daysUntilDue = dueDay - currentDay;

      let estado: 'VERDE' | 'AMARILLO' | 'ROJO';
      if (hasDeclaration) {
        estado = 'VERDE';
      } else if (daysUntilDue <= 1 && daysUntilDue >= 0) {
        estado = 'ROJO'; // Vence hoy o mañana y no hay archivo
      } else if (daysUntilDue < 0) {
        estado = 'ROJO'; // Ya venció y no hay archivo
      } else {
        estado = 'AMARILLO'; // Pendiente pero aún tiene tiempo
      }

      return {
        taxpayerId: t.id,
        clientId: t.clientOwner.id,
        razonSocial: t.razonSocial,
        ruc: t.ruc,
        claveSri: t.claveSri || null,
        clientName: t.clientOwner.fullName,
        novenoDigito: digit,
        dueDay,
        daysUntilDue,
        hasDeclaration,
        estado,
      };
    });

    // Alertas de firma electrónica próximas a vencer (<= 30 días según requerimiento de Mayra)
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const firmasExpirando = await prisma.taxpayer.findMany({
      where: {
        firmaExpira: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
      },
      include: { clientOwner: true },
      orderBy: { firmaExpira: 'asc' },
    });

    const firmaAlerts = firmasExpirando.map((t) => {
      const daysLeft = Math.ceil(
        (t.firmaExpira!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        taxpayerId: t.id,
        razonSocial: t.razonSocial,
        ruc: t.ruc,
        clientName: t.clientOwner.fullName,
        whatsappPhone: t.clientOwner.whatsappPhone,
        firmaExpira: t.firmaExpira,
        daysLeft,
      };
    });

    res.json({
      success: true,
      semaforo: {
        verde: semaforo.filter((s) => s.estado === 'VERDE').length,
        amarillo: semaforo.filter((s) => s.estado === 'AMARILLO').length,
        rojo: semaforo.filter((s) => s.estado === 'ROJO').length,
        items: semaforo,
      },
      firmaAlerts: {
        count: firmaAlerts.length,
        items: firmaAlerts,
      },
    });
  } catch (error) {
    console.error('Error en tax-alerts:', error);
    res.status(500).json({ success: false, message: 'Error al obtener alertas tributarias.' });
  }
});

/**
 * GET /api/whatsapp/queue-status
 * Retorna el estado en tiempo real de la cola de salida anti-baneo persistente.
 */
router.get('/queue-status', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await OutboundQueueService.getQueueStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Error al consultar queue-status:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estado de la cola' });
  }
});

/**
 * GET /api/whatsapp/messages/:ticketId
 * Devuelve todos los mensajes de un ticket ordenados cronológicamente.
 * Usado por /whatsapp (Centro WhatsApp) para reemplazar los mensajes dummy.
 */
router.get('/messages/:ticketId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTicketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId;
    const ticketId = parseInt(rawTicketId, 10);
    if (isNaN(ticketId)) {
      res.status(400).json({ success: false, message: 'ticketId inválido' });
      return;
    }
    const messages = await prisma.chatMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error al obtener mensajes del ticket:', error);
    res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
  }
});

/**
 * GET /api/whatsapp/client/:clientOwnerId/tickets
 * Devuelve todos los tickets (conversaciones) de un cliente con sus mensajes.
 * Usado por la pestaña "Chat" en el perfil /clientes/[id].
 */
router.get('/client/:clientOwnerId/tickets', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawClientId = Array.isArray(req.params.clientOwnerId) ? req.params.clientOwnerId[0] : req.params.clientOwnerId;
    const clientOwnerId = parseInt(rawClientId, 10);
    if (isNaN(clientOwnerId)) {
      res.status(400).json({ success: false, message: 'clientOwnerId inválido' });
      return;
    }
    const tickets = await prisma.chatTicket.findMany({
      where: { clientOwnerId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        assignedTo: { select: { id: true, fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error al obtener tickets del cliente:', error);
    res.status(500).json({ success: false, message: 'Error al obtener historial de chat' });
  }
});

export default router;
