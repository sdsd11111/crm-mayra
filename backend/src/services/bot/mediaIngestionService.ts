// backend/src/services/bot/mediaIngestionService.ts
import { BunnyStorageService } from '../BunnyStorageService';
import { prisma } from '../../lib/prisma';

export interface ProcessedMedia {
  mediaType: 'AUDIO' | 'IMAGE' | 'DOCUMENT';
  mediaUrl: string;
  mimeType: string;
  fileName: string;
  transcription?: string;   // Audio → texto transcrito
  ocrText?: string;          // Imagen → texto extraído
  docCategory?: string;      // Clasificación: RUC | COMPROBANTE_PAGO | CEDULA | FACTURA | OTRO
}

// ─────────────────────────── Gemini Multimodal ───────────────────────────────

/**
 * Llama a la API de Gemini 2.0 Flash con un payload de contenido (texto + inline data)
 * Retorna el texto generado o null si falla.
 */
async function callGemini(
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  instruction: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    const body = {
      system_instruction: { parts: [{ text: instruction }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Gemini] Error HTTP:', res.status, err.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return text || null;
  } catch (err) {
    console.error('[Gemini] Error en llamada:', err);
    return null;
  }
}

/**
 * Transcribe audio OGG/OPUS/MP4 a texto usando Gemini 2.0 Flash.
 * Gemini acepta audio directamente como inlineData — no requiere conversión de formato.
 */
async function transcribeAudioGemini(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
  const base64Audio = audioBuffer.toString('base64');
  // Normalizar mimeType: Gemini acepta audio/ogg, audio/mp4, audio/mpeg, audio/wav
  const safeMime = mimeType.startsWith('audio/') ? mimeType : 'audio/ogg';

  const result = await callGemini(
    [
      { inlineData: { mimeType: safeMime, data: base64Audio } },
      { text: 'Transcribe exactamente lo que dice esta nota de voz en español. Solo devuelve el texto transcrito, sin comentarios ni explicaciones. Si no hay voz audible, responde: [silencio]' },
    ],
    'Eres un transcriptor de audio preciso. Transcribes notas de voz en español ecuatoriano con máxima fidelidad.'
  );

  if (!result || result === '[silencio]') return null;
  return result;
}

/**
 * Extrae texto e identifica el tipo de documento en una imagen (OCR + clasificación).
 * Retorna JSON con { texto, categoria }.
 */
async function ocrImageGemini(imageBuffer: Buffer, mimeType: string): Promise<{ texto: string; categoria: string } | null> {
  const base64Image = imageBuffer.toString('base64');
  const safeMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

  const result = await callGemini(
    [
      { inlineData: { mimeType: safeMime, data: base64Image } },
      {
        text: `Analiza esta imagen y devuelve SOLO un JSON con este formato exacto (sin markdown):
{"texto":"<texto visible extraído de la imagen>","categoria":"<RUC|CEDULA|COMPROBANTE_PAGO|FACTURA|DECLARACION_SRI|CONTRATO|FOTO_PERSONA|OTRO>"}

Reglas:
- texto: todo el texto legible de la imagen, en orden de lectura
- categoria: elige la más apropiada
- Si la imagen no tiene texto relevante, texto = "" y categoria = "OTRO"
- Responde SOLO el JSON, sin nada más`,
      },
    ],
    'Eres un experto en OCR y clasificación de documentos legales y contables ecuatorianos.'
  );

  if (!result) return null;

  try {
    // Limpiar posibles bloques markdown que Gemini añada
    const clean = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (typeof parsed.texto === 'string' && typeof parsed.categoria === 'string') {
      return parsed;
    }
    return null;
  } catch {
    // Si no viene como JSON válido, extraer lo que podamos
    console.warn('[Gemini OCR] Respuesta no es JSON válido:', result.slice(0, 100));
    return { texto: result, categoria: 'OTRO' };
  }
}

// ─────────────────────────── MediaIngestionService ──────────────────────────

export class MediaIngestionService {
  private static apiUrl = (process.env.EVOLUTION_API_URL || 'http://178.238.238.158:8080').replace(/\/$/, '');
  private static apiKey = process.env.EVOLUTION_API_KEY || '';
  private static instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'mayra_castillo';

  /**
   * Descarga el medio desencriptado de Evolution API (base64 limpio).
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

      if (!response.ok) return {};

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
   * Transcribe audio a texto.
   * Prioridad: Gemini 2.0 Flash → Groq Whisper → OpenAI Whisper → null
   */
  public static async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
    // 1. Gemini (proveedor principal — soporta OGG/OPUS nativo)
    const geminiResult = await transcribeAudioGemini(audioBuffer, mimeType);
    if (geminiResult) {
      console.log('[MediaIngestion] Transcripción Gemini exitosa');
      return geminiResult;
    }

    // 2. Groq Whisper (fallback ultra rápido)
    const groqKey = process.env.GROQ_API_KEY;
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
          const text = data.text?.trim();
          if (text) {
            console.log('[MediaIngestion] Transcripción Groq exitosa');
            return text;
          }
        }
      } catch (err) {
        console.error('[MediaIngestion] Error en transcripción con Groq:', err);
      }
    }

    // 3. OpenAI Whisper (fallback secundario)
    const openaiKey = process.env.OPENAI_API_KEY;
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
          const text = data.text?.trim();
          if (text) {
            console.log('[MediaIngestion] Transcripción OpenAI exitosa');
            return text;
          }
        }
      } catch (err) {
        console.error('[MediaIngestion] Error en transcripción con OpenAI:', err);
      }
    }

    console.warn('[MediaIngestion] No se pudo transcribir audio — sin API keys configuradas');
    return null;
  }

  /**
   * OCR + clasificación de imagen.
   * Usa Gemini 2.0 Flash vision.
   */
  public static async extractImageText(imageBuffer: Buffer, mimeType: string): Promise<{
    ocrText: string;
    docCategory: string;
  } | null> {
    const result = await ocrImageGemini(imageBuffer, mimeType);
    if (!result) return null;
    return {
      ocrText: result.texto,
      docCategory: result.categoria,
    };
  }

  /**
   * Procesa cualquier medio entrante (Audio, Imagen, Documento),
   * lo sube a BunnyCDN y aplica OCR/transcripción según el tipo.
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

    const { base64, mimeType, fileName } = await this.fetchDecryptedBase64(messageKeyId, messageData);

    if (!base64) {
      console.warn(`[MediaIngestionService] No se pudo desencriptar el medio para messageId ${messageKeyId}`);
      return null;
    }

    // Buffer limpio
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const defaultExt = isAudio ? 'ogg' : isImage ? 'jpg' : 'pdf';
    const finalFileName = fileName || `archivo_${Date.now()}.${defaultExt}`;
    const finalMime = mimeType || (isAudio ? 'audio/ogg' : isImage ? 'image/jpeg' : 'application/pdf');

    // Subir a BunnyCDN (siempre, independiente del procesamiento AI)
    const { bunnyUrl } = await BunnyStorageService.uploadWhatsappMedia({
      phone,
      fileName: finalFileName,
      fileBuffer: buffer,
      contentType: finalMime,
    });

    let transcription: string | undefined;
    let ocrText: string | undefined;
    let docCategory: string | undefined;

    // ── Transcripción de audio ──
    if (isAudio) {
      const result = await this.transcribeAudio(buffer, finalMime);
      if (result) transcription = result;
    }

    // ── OCR de imagen ──
    if (isImage) {
      const result = await this.extractImageText(buffer, finalMime);
      if (result) {
        ocrText = result.ocrText;
        docCategory = result.docCategory;
      }
    }

    const mediaType: 'AUDIO' | 'IMAGE' | 'DOCUMENT' = isAudio ? 'AUDIO' : isImage ? 'IMAGE' : 'DOCUMENT';

    // Guardar adjunto si cliente está en flujo FIRMA_STEPS
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
        ocrText: ocrText || null,
        docCategory: docCategory || null,
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
      ocrText,
      docCategory,
    };
  }
}
