// backend/src/services/bot/types.ts

export type CallCenterQueue = 'OPERATIVA_CHICAS' | 'GERENCIAL_MAYRA' | 'COBRANZA';

export interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ClientProfileData {
  id: number;
  fullName: string;
  whatsappPhone?: string | null;
  securityPin?: string | null;
  isVip?: boolean;
  taxpayers: Array<{
    id: number;
    razonSocial: string;
    ruc?: string | null;
    regimen?: string | null;
    dueDay?: number | null;
    claveSri?: string | null;
    claveIess?: string | null;
    fechaFirmaExpira?: string | null;
    documentsCount?: number;
  }>;
  saldoPendienteTotal?: number;
}

export interface BotTurnOutput {
  replyText: string;
  targetQueue: CallCenterQueue;
  needsClarification: boolean; // Si no entendió, repregunta antes de escalar
  requiresHuman: boolean;      // Escalamiento al equipo
  humanReason?: string;
  identifiedTaxpayerId?: number;
}

