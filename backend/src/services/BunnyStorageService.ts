// backend/src/services/BunnyStorageService.ts
import fs from 'fs';
import path from 'path';

export interface UploadFileOptions {
  ruc: string;
  year: number;
  category: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}

export interface BunnyUploadResult {
  bunnyPath: string;
  bunnyUrl: string;
  fileType: string;
  isLocalFallback: boolean;
}

/**
 * Servicio de Almacenamiento para la Bóveda Digital de Clientes.
 * Estructura de carpetas: /clientes/{ruc}/{anio}/{categoria}/{archivo}
 * 
 * Si las variables BUNNY_STORAGE_ZONE y BUNNY_API_KEY están presentes en .env,
 * realiza la subida directa a la API HTTP de Bunny.net Storage.
 * Si no están configuradas aún, opera con un almacenamiento local seguro en /uploads,
 * garantizando que el CRM funcione sin errores y permitiendo conectar Bunny.net en 1 segundo.
 */
export class BunnyStorageService {
  private static storageZone = process.env.BUNNY_STORAGE_ZONE || '';
  private static apiKey = process.env.BUNNY_STORAGE_API_KEY || process.env.BUNNY_API_KEY || '';
  private static pullZoneUrl = process.env.BUNNY_PULLZONE_URL || process.env.BUNNY_PULL_ZONE_URL || '';
  private static storageHost = process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';

  /**
   * Sube un archivo a Bunny.net (o al fallback local seguro).
   */
  public static async uploadFile(options: UploadFileOptions): Promise<BunnyUploadResult> {
    const { ruc, year, category, fileName, fileBuffer, contentType } = options;

    // Normalizar ruta interna
    const cleanRuc = ruc.replace(/[^a-zA-Z0-9]/g, '');
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = `clientes/${cleanRuc}/boveda-digital/${year}/${category}/${cleanFileName}`;

    // Si tenemos las credenciales de Bunny.net configuradas
    if (this.storageZone && this.apiKey) {
      try {
        const uploadUrl = `https://${this.storageHost}/${this.storageZone}/${relativePath}`;
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            AccessKey: this.apiKey,
            'Content-Type': contentType || 'application/octet-stream',
          },
          body: new Uint8Array(fileBuffer),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Error en Bunny.net API (${response.status}): ${errText}`);
        }

        const publicUrl = this.pullZoneUrl
          ? `${this.pullZoneUrl.replace(/\/$/, '')}/${relativePath}`
          : `https://${this.storageHost}/${this.storageZone}/${relativePath}`;

        return {
          bunnyPath: relativePath,
          bunnyUrl: publicUrl,
          fileType: path.extname(cleanFileName).replace('.', '').toLowerCase(),
          isLocalFallback: false,
        };
      } catch (bunnyError) {
        console.error('⚠️ Fallo la subida a Bunny.net, activando fallback local:', bunnyError);
      }
    }

    // Fallback Local Seguro: backend/uploads/...
    const uploadsDir = path.join(process.cwd(), 'uploads', 'clientes', cleanRuc, 'boveda-digital', String(year), category);
    fs.mkdirSync(uploadsDir, { recursive: true });

    const localFilePath = path.join(uploadsDir, cleanFileName);
    fs.writeFileSync(localFilePath, fileBuffer);

    return {
      bunnyPath: relativePath,
      bunnyUrl: `/uploads/${relativePath}`,
      fileType: path.extname(cleanFileName).replace('.', '').toLowerCase(),
      isLocalFallback: true,
    };
  }

  /**
   * Sube un archivo multimedia de WhatsApp a Bunny.net (o fallback local).
   * Estructura jerárquica por cliente:
   * Si tiene identificador/RUC: clientes/{clientIdentifier}/chat-media/{timestamp}_{fileName}
   * Si es prospecto/teléfono: clientes/{phone}/chat-media/{timestamp}_{fileName}
   */
  public static async uploadWhatsappMedia({
    phone,
    clientIdentifier,
    fileName,
    fileBuffer,
    contentType,
  }: {
    phone: string;
    clientIdentifier?: string | null;
    fileName: string;
    fileBuffer: Buffer;
    contentType: string;
  }): Promise<{ bunnyUrl: string; bunnyPath: string }> {
    const cleanPhone = phone.replace(/\D/g, '');
    const folderKey = (clientIdentifier || cleanPhone).replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = `clientes/${folderKey}/chat-media/${Date.now()}_${cleanFileName}`;

    if (this.storageZone && this.apiKey) {
      try {
        const uploadUrl = `https://${this.storageHost}/${this.storageZone}/${relativePath}`;
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            AccessKey: this.apiKey,
            'Content-Type': contentType || 'application/octet-stream',
          },
          body: new Uint8Array(fileBuffer),
        });

        if (response.ok) {
          const publicUrl = this.pullZoneUrl
            ? `${this.pullZoneUrl.replace(/\/$/, '')}/${relativePath}`
            : `https://${this.storageHost}/${this.storageZone}/${relativePath}`;
          return { bunnyUrl: publicUrl, bunnyPath: relativePath };
        }
      } catch (err) {
        console.error('Error subiendo whatsapp-media a Bunny.net:', err);
      }
    }

    // Fallback local seguro
    const uploadsDir = path.join(process.cwd(), 'uploads', 'clientes', folderKey, 'chat-media');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const localPath = path.join(uploadsDir, cleanFileName);
    fs.writeFileSync(localPath, fileBuffer);

    return {
      bunnyUrl: `/uploads/${relativePath}`,
      bunnyPath: relativePath,
    };
  }
}

