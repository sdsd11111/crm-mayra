// backend/src/services/bot/mediaIngestionService.ts
import { BunnyStorageService } from '../BunnyStorageService';
import { prisma } from '../../lib/prisma';

export interface ProcessedMedia {
  mediaType: 'AUDIO' | 'IMAGE' | 'DOCUMENT';
  mediaUrl: string;
  mimeType: string;
  fileName: string;
  transcription?: string;
}

export class MediaIngestionService {
  private static apiUrl = (process.env.EVOLUTION_API_URL || 'http://178.238.238.158:8080').replace(/\/$/, '');
  private static apiKey = process.env.EVOLUTION_API_KEY || '';
  private static instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'mayra_castillo';

  /**
   * Descarga el medio desencriptado de Evolution API usando POST /chat/getBase64FromMediaMessage/{instance}
   * evitando el error de descargar binarios .enc corruptos de WhatsApp.
   */
  public static async fetchDecryptedBase64(messageKeyId: string, messagePayload: any): Promise<{
    base64?: string;
    mimeType?: string;
    fileName?: string;
  }> {
    try {
      const url = `${this.apiUrl}/chat/getBase64FromMediaMessage/${this.instanceName}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          message: {
            key: { id: messageKeyId },
            message: messagePayload,
          },
          convertToMp4: false,
        }),
      });

      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      return {
        base64: data.base64,
        mimeType: data.mimetype,
        fileName: data.fileName || data.title,
      };
    } catch (err) {
      console.error('[MediaIngestionService] Error al obtener base64 de Evolution API:', err);
      return {};
    }
  }

  /**
   * Transcribe nota de voz a texto usando Groq Whisper u OpenAI Whisper (con fallback seguro)
   */
  public static async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // 1. Intentar con Groq Whisper (ultra rápido)
    if (groqKey) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType || 'audio/ogg' });
        formData.append('file', blob, 'audio.ogg');
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('language', 'es');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}` },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          return data.text?.trim() || null;
        }
      } catch (err) {
        console.error('[MediaIngestionService] Error en transcripción con Groq:', err);
      }
    }

    // 2. Intentar con OpenAI Whisper
    if (openaiKey) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType || 'audio/ogg' });
        formData.append('file', blob, 'audio.ogg');
        formData.append('model', 'whisper-1');
        formData.append('language', 'es');

        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          return data.text?.trim() || null;
        }
      } catch (err) {
        console.error('[MediaIngestionService] Error en transcripción con OpenAI:', err);
      }
    }

    // Fallback: Si no hay API key configurada, retorna null sin crashear
    return null;
  }

  /**
   * Procesa cualquier medio entrante (Audio, Imagen, Documento), lo sube a BunnyCDN y transcribe audio si aplica
   */
  public static async processIncomingMedia({
    phone,
    messageKeyId,
    messageData,
  }: {
    phone: string;
    messageKeyId: string;
    messageData: any;
  }): Promise<ProcessedMedia | null> {
    const isAudio = Boolean(messageData?.audioMessage);
    const isImage = Boolean(messageData?.imageMessage);
    const isDoc = Boolean(messageData?.documentMessage);

    if (!isAudio && !isImage && !isDoc) return null;

    const mediaPayload = messageData.audioMessage || messageData.imageMessage || messageData.documentMessage;
    const { base64, mimeType, fileName } = await this.fetchDecryptedBase64(messageKeyId, messageData);

    if (!base64) {
      console.warn(`[MediaIngestionService] No se pudo desencriptar el medio para messageId ${messageKeyId}`);
      return null;
    }

    // Limpiar header de data URI si existe
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const defaultExt = isAudio ? 'ogg' : isImage ? 'jpg' : 'pdf';
    const finalFileName = fileName || `archivo_${Date.now()}.${defaultExt}`;
    const finalMime = mimeType || (isAudio ? 'audio/ogg' : isImage ? 'image/jpeg' : 'application/pdf');

    // Subir a BunnyCDN Storage
    const { bunnyUrl } = await BunnyStorageService.uploadWhatsappMedia({
      phone,
      fileName: finalFileName,
      fileBuffer: buffer,
      contentType: finalMime,
    });

    let transcription: string | undefined = undefined;
    if (isAudio) {
      const transResult = await this.transcribeAudio(buffer, finalMime);
      if (transResult) {
        transcription = transResult;
      }
    }

    const mediaType: 'AUDIO' | 'IMAGE' | 'DOCUMENT' = isAudio ? 'AUDIO' : isImage ? 'IMAGE' : 'DOCUMENT';

    // Si el cliente está en proceso de Firma Electrónica, guardar automáticamente en BotSession.flowData
    const session = await prisma.botSession.findUnique({
      where: { whatsappPhone: phone },
    });

    if (session && session.currentFlow === 'FIRMA_STEPS') {
      const currentFlowData: any = session.flowData ? session.flowData : {};
      const uploadsList = Array.isArray(currentFlowData.adjuntos) ? currentFlowData.adjuntos : [];
      uploadsList.push({
        mediaType,
        url: bunnyUrl,
        fileName: finalFileName,
        receivedAt: new Date().toISOString(),
      });
      currentFlowData.adjuntos = uploadsList;

      await prisma.botSession.update({
        where: { id: session.id },
        data: { flowData: currentFlowData, lastInteractionAt: new Date() },
      });
    }

    return {
      mediaType,
      mediaUrl: bunnyUrl,
      mimeType: finalMime,
      fileName: finalFileName,
      transcription,
    };
  }
}

