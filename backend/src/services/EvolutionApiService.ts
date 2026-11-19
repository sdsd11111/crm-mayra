// backend/src/services/EvolutionApiService.ts

export interface SendMessageOptions {
  number: string; // ej: 593991234567
  text: string;
}

export interface SendMediaOptions {
  number: string;
  mediaUrl?: string;
  base64?: string;
  caption?: string;
  fileName?: string;
  mediaType?: 'image' | 'document' | 'video' | 'audio';
}

export class EvolutionApiService {
  private static apiUrl = (process.env.EVOLUTION_API_URL || 'http://178.238.238.158:8080').replace(/\/$/, '');
  private static apiKey = process.env.EVOLUTION_API_KEY || '';
  private static instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'mayra_castillo';

  /**
   * Envía un mensaje de texto por WhatsApp a través de Evolution API.
   */
  public static async sendTextMessage(options: SendMessageOptions): Promise<{ success: boolean; data?: any; error?: string }> {
    const { number, text } = options;
    const cleanNumber = number.replace(/\D/g, '');

    try {
      const url = `${this.apiUrl}/message/sendText/${this.instanceName}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          number: cleanNumber,
          text,
          options: {
            delay: 1200,
            presence: 'composing',
          },
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        console.error('⚠️ [EvolutionApi] Error al enviar mensaje:', resData);
        return { success: false, error: resData.message || 'Error en Evolution API' };
      }

      return { success: true, data: resData };
    } catch (err: any) {
      console.error('❌ [EvolutionApi] Fallo de conexión:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Envía un documento o PDF (por ejemplo, desde BunnyCDN) al WhatsApp del cliente.
   */
  public static async sendMediaUrl(options: {
    number: string;
    mediaUrl: string;
    caption?: string;
    fileName?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.sendMediaMessage({
      number: options.number,
      mediaUrl: options.mediaUrl,
      caption: options.caption,
      fileName: options.fileName,
      mediaType: 'document',
    });
  }

  /**
   * Envía un documento o PDF (por ejemplo, desde BunnyCDN) al WhatsApp del cliente.
   */
  public static async sendMediaMessage(options: SendMediaOptions): Promise<{ success: boolean; data?: any; error?: string }> {
    const { number, mediaUrl, base64, caption, fileName, mediaType = 'document' } = options;
    const cleanNumber = number.replace(/\D/g, '');

    try {
      const url = `${this.apiUrl}/message/sendMedia/${this.instanceName}`;
      const payload: any = {
        number: cleanNumber,
        mediatype: mediaType,
        caption: caption || '',
        fileName: fileName || (mediaType === 'image' ? 'imagen.jpg' : mediaType === 'video' ? 'video.mp4' : 'documento.pdf'),
      };

      if (base64) {
        payload.media = base64;
      } else if (mediaUrl) {
        payload.media = mediaUrl;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (!response.ok) {
        console.error('⚠️ [EvolutionApi] Error al enviar archivo multimedia:', resData);
        return { success: false, error: resData.message || 'Error en Evolution API Media' };
      }

      return { success: true, data: resData };
    } catch (err: any) {
      console.error('❌ [EvolutionApi] Fallo de conexión media:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Envía una NOTA DE VOZ (Push-To-Talk / PTT) auténtica de WhatsApp.
   * Utiliza el endpoint nativo /message/sendWhatsAppAudio con audio en base64 o URL.
   */
  public static async sendWhatsAppAudio(options: {
    number: string;
    audioUrl?: string;
    base64?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const cleanNumber = options.number.replace(/\D/g, '');

    try {
      const url = `${this.apiUrl}/message/sendWhatsAppAudio/${this.instanceName}`;
      const payload: any = {
        number: cleanNumber,
      };

      if (options.base64) {
        payload.audio = options.base64;
      } else if (options.audioUrl) {
        payload.audio = options.audioUrl;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (!response.ok) {
        console.error('⚠️ [EvolutionApi] Error enviando WhatsApp Audio PTT:', resData);
        return { success: false, error: resData.message || 'Error en Evolution API Audio' };
      }

      return { success: true, data: resData };
    } catch (err: any) {
      console.error('❌ [EvolutionApi] Fallo de conexión en Audio PTT:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Obtiene el estado actual de la instancia de WhatsApp en Evolution API.
   */
  public static async getConnectionState(): Promise<{ state: string; details?: any; error?: string }> {
    try {
      const url = `${this.apiUrl}/instance/connectionState/${this.instanceName}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { apikey: this.apiKey },
      });

      const data = await response.json();
      if (!response.ok) {
        return { state: 'DISCONNECTED', error: data.message || 'No se pudo consultar el estado' };
      }

      // data?.instance?.state puede ser 'open', 'connecting', 'close', etc.
      const state = data?.instance?.state || data?.state || 'UNKNOWN';
      return { state, details: data };
    } catch (err: any) {
      return { state: 'UNREACHABLE', error: err.message };
    }
  }

  /**
   * Genera el código QR o código de emparejamiento para conectar WhatsApp.
   */
  public static async getQrCode(): Promise<{ success: boolean; qrCode?: string; pairingCode?: string; error?: string }> {
    try {
      // 1. Intentar conectar la instancia para obtener el QR
      const connectUrl = `${this.apiUrl}/instance/connect/${this.instanceName}`;
      const response = await fetch(connectUrl, {
        method: 'GET',
        headers: { apikey: this.apiKey },
      });

      const data = await response.json();
      
      // Evolution suele devolver { base64: "data:image/png;base64,...", code: "..." } o similar
      const qrCode = data?.base64 || data?.qrcode?.base64 || (typeof data?.code === 'string' && data.code.startsWith('data:image') ? data.code : undefined);
      const pairingCode = data?.pairingCode || data?.code;

      if (!response.ok && !qrCode) {
        return { success: false, error: data.message || 'Error al solicitar código QR' };
      }

      return { success: true, qrCode, pairingCode };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Crea la instancia en Evolution API si aún no existe.
   */
  public static async createInstance(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const url = `${this.apiUrl}/instance/create`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          instanceName: this.instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        }),
      });

      const data = await response.json();
      return { success: response.ok, data, error: data?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Cierra sesión / desconecta la instancia de WhatsApp.
   */
  public static async logoutInstance(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const url = `${this.apiUrl}/instance/logout/${this.instanceName}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { apikey: this.apiKey },
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Error al desconectar WhatsApp' };
      }

      return { success: true, message: 'WhatsApp desconectado correctamente' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Reinicia la instancia en Evolution API.
   */
  public static async restartInstance(): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.apiUrl}/instance/restart/${this.instanceName}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { apikey: this.apiKey },
      });
      return { success: response.ok };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

