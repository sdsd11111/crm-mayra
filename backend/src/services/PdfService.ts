// backend/src/services/PdfService.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

export interface StatementData {
  clientName: string;
  phone: string;
  taxpayers: { razonSocial: string; ruc: string | null }[];
  entries: {
    entryDate: Date;
    entryType: string;
    concept: string;
    bankAccount: string;
    amount: number;
  }[];
  totalBalance: number;
}

export class PdfService {
  /**
   * Genera el PDF del Estado de Cuenta Consolidado en memoria (Buffer).
   */
  public static async generateAccountStatement(data: StatementData): Promise<Buffer> {
    const standardFonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    const printer = new PdfPrinter(standardFonts);

    const rows = data.entries.map((e) => {
      const isCharge =
        e.entryType === 'CARGO_AUTOMATICO' ||
        e.entryType === 'CARGO_MANUAL' ||
        e.entryType === 'CARGO_COMISION_DEV';

      const typeLabel = isCharge ? 'CARGO' : 'ABONO';
      const dateStr = new Date(e.entryDate).toLocaleDateString('es-EC');

      return [
        { text: dateStr, fontSize: 9, color: '#4B5563' },
        {
          text: typeLabel,
          fontSize: 8,
          bold: true,
          color: isCharge ? '#DC2626' : '#16A34A',
        },
        { text: e.concept, fontSize: 9, color: '#1F2937' },
        { text: e.bankAccount !== 'NO_APLICA' ? e.bankAccount.replace(/_/g, ' ') : '—', fontSize: 8, color: '#6B7280' },
        {
          text: `${isCharge ? '+' : '-'}$${Number(e.amount).toFixed(2)}`,
          fontSize: 9,
          bold: true,
          alignment: 'right',
          color: isCharge ? '#DC2626' : '#16A34A',
        },
      ];
    });

    const docDefinition: any = {
      defaultStyle: {
        font: 'Helvetica',
      },
      content: [
        // Encabezado
        {
          columns: [
            [
              { text: 'ESTUDIO CONTABLE', fontSize: 16, bold: true, color: '#1E2A3C' },
              { text: 'MAYRA CASTILLO', fontSize: 13, bold: true, color: '#1E80C1' },
              { text: 'Asesoría Tributaria, Contable y Bóveda Digital', fontSize: 8, color: '#6B7280', margin: [0, 2, 0, 0] },
              { text: 'Loja, Ecuador', fontSize: 8, color: '#9CA3AF' },
            ],
            [
              { text: 'ESTADO DE CUENTA', fontSize: 14, bold: true, alignment: 'right', color: '#1E2A3C' },
              { text: `Fecha: ${new Date().toLocaleDateString('es-EC')}`, fontSize: 9, alignment: 'right', color: '#6B7280' },
            ],
          ],
          margin: [0, 0, 0, 15],
        },

        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#1E80C1' }] },

        // Datos del Cliente
        {
          columns: [
            [
              { text: 'CLIENTE / DUEÑO:', fontSize: 8, bold: true, color: '#9CA3AF', margin: [0, 10, 0, 2] },
              { text: data.clientName, fontSize: 12, bold: true, color: '#1E2A3C' },
              { text: `WhatsApp: ${data.phone}`, fontSize: 9, color: '#4B5563', margin: [0, 2, 0, 0] },
            ],
            [
              { text: 'EMPRESAS ASOCIADAS:', fontSize: 8, bold: true, color: '#9CA3AF', alignment: 'right', margin: [0, 10, 0, 2] },
              ...data.taxpayers.map((t) => ({
                text: `${t.razonSocial} (${t.ruc || 'Sin RUC'})`,
                fontSize: 8,
                alignment: 'right',
                color: '#4B5563',
              })),
            ],
          ],
          margin: [0, 0, 0, 15],
        },

        // Tabla de Movimientos
        {
          table: {
            headerRows: 1,
            widths: [65, 55, '*', 80, 65],
            body: [
              [
                { text: 'FECHA', fontSize: 8, bold: true, color: '#FFFFFF', fillColor: '#1E2A3C' },
                { text: 'TIPO', fontSize: 8, bold: true, color: '#FFFFFF', fillColor: '#1E2A3C' },
                { text: 'CONCEPTO', fontSize: 8, bold: true, color: '#FFFFFF', fillColor: '#1E2A3C' },
                { text: 'CUENTA / BANCO', fontSize: 8, bold: true, color: '#FFFFFF', fillColor: '#1E2A3C' },
                { text: 'VALOR', fontSize: 8, bold: true, alignment: 'right', color: '#FFFFFF', fillColor: '#1E2A3C' },
              ],
              ...rows,
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 15],
        },

        // Resumen Final y Saldo a Pagar
        {
          columns: [
            // Cuentas de Transferencia de Mayra
            [
              { text: 'CUENTAS BANCARIAS HABILITADAS:', fontSize: 8, bold: true, color: '#1E2A3C', margin: [0, 0, 0, 3] },
              { text: '• Banco Pichincha (Cta. Corriente)', fontSize: 8, color: '#4B5563' },
              { text: '• Banco de Loja (Cta. Ahorros)', fontSize: 8, color: '#4B5563' },
              { text: '• Cooperativa JEP (Cta. Ahorros)', fontSize: 8, color: '#4B5563' },
              { text: 'Enviar comprobante de transferencia al WhatsApp oficial.', fontSize: 7, color: '#9CA3AF', italics: true, margin: [0, 3, 0, 0] },
            ],
            // Cuadro de Saldo
            [
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        fillColor: data.totalBalance > 0 ? '#FEF2F2' : '#F0FDF4',
                        margin: [8, 8, 8, 8],
                        stack: [
                          { text: 'SALDO TOTAL PENDIENTE', fontSize: 8, bold: true, alignment: 'center', color: '#6B7280' },
                          {
                            text: `$${data.totalBalance.toFixed(2)}`,
                            fontSize: 18,
                            bold: true,
                            alignment: 'center',
                            color: data.totalBalance > 0 ? '#DC2626' : '#16A34A',
                            margin: [0, 3, 0, 0],
                          },
                        ],
                      },
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          ],
        },

        // Pie de página institucional
        {
          text: 'Gracias por confiar en nuestros servicios profesionales · Estudio Contable Mayra Castillo',
          fontSize: 7,
          color: '#9CA3AF',
          alignment: 'center',
          margin: [0, 30, 0, 0],
        },
      ],
    };

    return new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];

      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err: Error) => reject(err));
      pdfDoc.end();
    });
  }

  /**
   * Helper para generar el PDF de estado de cuenta directamente desde un clientOwnerId.
   * Consulta la BD internamente. Usado por BillingCron para cobranza masiva.
   */
  public static async generateStatement(clientOwnerId: number): Promise<Buffer> {
    const { prisma } = await import('../lib/prisma');

    const client = await prisma.clientOwner.findUniqueOrThrow({
      where: { id: clientOwnerId },
      include: {
        taxpayers: true,
        ledgerEntries: {
          orderBy: { entryDate: 'asc' },
        },
      },
    });

    const isDebitType = (t: string) =>
      ['CARGO_AUTOMATICO', 'CARGO_MANUAL', 'CARGO_COMISION_DEV'].includes(t);

    const totalBalance = client.ledgerEntries.reduce(
      (acc, e) => (isDebitType(e.entryType) ? acc + Number(e.amount) : acc - Number(e.amount)),
      0
    );

    const formattedEntries = client.ledgerEntries.map((e) => ({
      entryDate: e.entryDate,
      entryType: e.entryType,
      concept: e.concept,
      bankAccount: e.bankAccount,
      amount: isDebitType(e.entryType) ? Number(e.amount) : -Number(e.amount),
    }));

    return this.generateAccountStatement({
      clientName: client.fullName,
      phone: client.whatsappPhone,
      taxpayers: client.taxpayers.map((t) => ({ razonSocial: t.razonSocial, ruc: t.ruc })),
      entries: formattedEntries,
      totalBalance: Number(totalBalance.toFixed(2)),
    });
  }
}
