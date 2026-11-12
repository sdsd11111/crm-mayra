// frontend/src/types/document.ts
export type DocCategory =
  | 'DECLARACION_IVA'
  | 'DECLARACION_RENTA'
  | 'ANEXO_ATS'
  | 'DECLARACION_ICE'
  | 'SUPERCIAS_ESTADOS'
  | 'RUC_CERTIFICADO'
  | 'NOMBRAMIENTO_ESCRITURA'
  | 'PLANILLA_IESS_SUT'
  | 'FACTURA_EMITIDA'
  | 'PROYECCION_RENTA'
  | 'FIRMA_ELECTRONICA_P12'
  | 'OTRO_DOCUMENTO';

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  DECLARACION_IVA: 'Declaración IVA',
  DECLARACION_RENTA: 'Declaración Renta',
  ANEXO_ATS: 'Anexo ATS',
  DECLARACION_ICE: 'Declaración ICE',
  SUPERCIAS_ESTADOS: 'Supercias / Estados',
  RUC_CERTIFICADO: 'RUC / Certificado',
  NOMBRAMIENTO_ESCRITURA: 'Nombramiento / Escritura',
  PLANILLA_IESS_SUT: 'Planilla IESS / SUT',
  FACTURA_EMITIDA: 'Factura Emitida',
  PROYECCION_RENTA: 'Proyección Renta',
  FIRMA_ELECTRONICA_P12: 'Firma Electrónica .p12',
  OTRO_DOCUMENTO: 'Otro Documento',
};

export const DOC_CATEGORY_COLORS: Record<DocCategory, string> = {
  DECLARACION_IVA: 'bg-blue-50 text-blue-700 border-blue-200',
  DECLARACION_RENTA: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ANEXO_ATS: 'bg-purple-50 text-purple-700 border-purple-200',
  DECLARACION_ICE: 'bg-pink-50 text-pink-700 border-pink-200',
  SUPERCIAS_ESTADOS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  RUC_CERTIFICADO: 'bg-teal-50 text-teal-700 border-teal-200',
  NOMBRAMIENTO_ESCRITURA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PLANILLA_IESS_SUT: 'bg-amber-50 text-amber-700 border-amber-200',
  FACTURA_EMITIDA: 'bg-lime-50 text-lime-700 border-lime-200',
  PROYECCION_RENTA: 'bg-orange-50 text-orange-700 border-orange-200',
  FIRMA_ELECTRONICA_P12: 'bg-red-50 text-red-700 border-red-200',
  OTRO_DOCUMENTO: 'bg-gray-50 text-gray-700 border-gray-200',
};

export interface DocumentItem {
  id: number;
  taxpayerId: number;
  category: DocCategory;
  title: string;
  periodYear: number;
  periodMonth: number | null;
  bunnyPath: string;
  bunnyUrl: string;
  fileType: string;
  sentByWhatsapp: boolean;
  createdAt: string;
  uploadedBy: {
    id: number;
    username: string;
    fullName: string;
    role: string;
  };
}

