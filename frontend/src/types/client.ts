// frontend/src/types/client.ts
export type TaxRegime =
  | 'MENSUAL'
  | 'SEMESTRAL'
  | 'ANUAL'
  | 'COMPANIA_SUPERCIAS'
  | 'DEVOLUCION_IVA_3RA_EDAD'
  | 'INACTIVO_CERRADO';

export type BillingFrequency = 'NONE' | 'MENSUAL' | 'SEMESTRAL' | 'ANUAL';

export interface TaxpayerItem {
  id: number;
  clientOwnerId: number;
  razonSocial: string;
  ruc: string | null;
  fechaDecla: string | null;
  novenoDigito: number | null;
  regimen: TaxRegime;
  email: string | null;
  claveSri: string | null;
  claveFirma: string | null;
  firmaFileUrl?: string | null;
  firmaExpira: string | null;
  claveSalar: string | null;
  claveSut: string | null;
  claveIess: string | null;
  claveSupercias: string | null;
  expSupercias: string | null;
  claveSercop: string | null;
  checkDecla: boolean;
  checkIce: boolean;
  checkAnexo: boolean;
  checkIva: boolean;
  checkSalar: boolean;
  checkSut: boolean;
  checkIess: boolean;
  checkSupercias: boolean;
  checkPatente: boolean;
  declaDetalle?: string | null;
  iceDetalle?: string | null;
  anexoDetalle?: string | null;
  ivaDetalle?: string | null;
  salarDetalle?: string | null;
  sutDetalle?: string | null;
  iessDetalle?: string | null;
  superciasDetalle?: string | null;
  patenteDetalle?: string | null;
  // Solo presentes para ADMIN_MAYRA / COBRADOR:
  autoBillFreq?: BillingFrequency;
  autoBillAmount?: number;
  appliesVat?: boolean;
  devIvaPercent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientOwnerItem {
  id: number;
  fullName: string;
  whatsappPhone: string;
  securityPin: string;
  isVip: boolean;
  dataConsentSigned: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  taxpayers: TaxpayerItem[];
  // Solo presente para ADMIN_MAYRA / COBRADOR:
  saldoPendienteTotal?: number;
  totalMovimientos?: number;
}

