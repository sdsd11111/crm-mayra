// backend/src/services/SuperciasService.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

export interface SuperciasFormData {
  companyName: string;
  ruc: string;
  year: number;
  capital: number;
  bancos: number;
  utilidadPerdida: number;
  gerenteName: string;
  presidenteName?: string;
  fechaInforme?: string;
}

export class SuperciasService {
  /**
   * Genera el Informe Oficial de Superintendencia de Compañías en PDF conteniendo:
   * 1. Acta de Junta General Universal de Accionistas.
   * 2. Informe de Gestión del Representante Legal (Gerente General).
   * 3. Notas a los Estados Financieros.
   */
  public static async generateSuperciasReports(data: SuperciasFormData): Promise<Buffer> {
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    const printer = new PdfPrinter(fonts);
    const fecha = data.fechaInforme || `31 de marzo de ${data.year + 1}`;

    const docDefinition: any = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
        lineHeight: 1.25,
      },
      content: [
        // ══════════════════════════════════════════════════════
        // DOCUMENTO 1: ACTA DE JUNTA GENERAL UNIVERSAL
        // ══════════════════════════════════════════════════════
        { text: data.companyName.toUpperCase(), fontSize: 13, bold: true, alignment: 'center', color: '#1E2A3C' },
        { text: `RUC: ${data.ruc}`, fontSize: 10, alignment: 'center', color: '#6B7280', margin: [0, 2, 0, 10] },
        {
          text: 'ACTA DE JUNTA GENERAL UNIVERSAL Y EXTRAORDINARIA DE ACCIONISTAS',
          fontSize: 12,
          bold: true,
          alignment: 'center',
          color: '#1E80C1',
          margin: [0, 0, 0, 15],
        },
        {
          text:
            `En la ciudad de Loja, a los ${fecha}, en las oficinas de la compañía ${data.companyName}, ` +
            `se reúnen los accionistas que representan el 100% del capital social suscrito y pagado de la compañía que asciende a $${data.capital.toFixed(2)} USD.\n\n` +
            `Preside la sesión el Presidente de la compañía y actúa como Secretario el Gerente General, ${data.gerenteName}.\n\n` +
            `ORDEN DEL DÍA:\n` +
            `1. Conocimiento y aprobación del Informe del Gerente General correspondiente al ejercicio fiscal ${data.year}.\n` +
            `2. Conocimiento y aprobación del Balance General, Estado de Resultados y Notas a los Estados Financieros del ejercicio fiscal ${data.year}.\n` +
            `3. Resolución sobre el destino de los resultados del ejercicio económico ${data.year}.\n\n` +
            `RESOLUCIONES:\n` +
            `La Junta General de Accionistas, luego de un análisis detallado de la documentación presentada, resuelve por unanimidad:\n` +
            `• Aprobar sin observaciones el Informe presentado por la Gerencia General.\n` +
            `• Aprobar en su totalidad los Estados Financieros y Notas explicativas del ejercicio ${data.year}.\n` +
            `• Dejar constancia de que el resultado del ejercicio arrojó un saldo de $${data.utilidadPerdida.toFixed(2)} USD.\n\n` +
            `No habiendo otro punto que tratar, se concede un receso para la redacción de la presente acta, la misma que es leída, aprobada y firmada por todos los concurrentes.`,
          alignment: 'justify',
          margin: [0, 0, 0, 40],
        },

        // Firmas Junta
        {
          columns: [
            {
              stack: [
                { text: '_______________________________', alignment: 'center' },
                { text: data.gerenteName, bold: true, alignment: 'center', fontSize: 9 },
                { text: 'GERENTE GENERAL / SECRETARIO', alignment: 'center', fontSize: 8, color: '#6B7280' },
              ],
            },
            {
              stack: [
                { text: '_______________________________', alignment: 'center' },
                { text: data.presidenteName || 'PRESIDENTE DE LA JUNTA', bold: true, alignment: 'center', fontSize: 9 },
                { text: 'ACCIONISTA / PRESIDENTE', alignment: 'center', fontSize: 8, color: '#6B7280' },
              ],
            },
          ],
          margin: [0, 0, 0, 50],
          pageBreak: 'after',
        },

        // ══════════════════════════════════════════════════════
        // DOCUMENTO 2: INFORME DEL REPRESENTANTE LEGAL (GERENTE)
        // ══════════════════════════════════════════════════════
        { text: data.companyName.toUpperCase(), fontSize: 13, bold: true, alignment: 'center', color: '#1E2A3C' },
        { text: `RUC: ${data.ruc}`, fontSize: 10, alignment: 'center', color: '#6B7280', margin: [0, 2, 0, 10] },
        {
          text: `INFORME DEL REPRESENTANTE LEGAL A LA JUNTA GENERAL DE ACCIONISTAS CORRESPONDIENTE AL EJERCICIO ECONÓMICO ${data.year}`,
          fontSize: 11,
          bold: true,
          alignment: 'center',
          color: '#1E80C1',
          margin: [0, 0, 0, 15],
        },
        {
          text:
            `Señores Accionistas:\n\n` +
            `En cumplimiento con las disposiciones legales y estatutarias consagradas en la Ley de Compañías del Ecuador, ` +
            `someto a su consideración el informe de actividades y gestión correspondiente al período fiscal finalizado al 31 de diciembre de ${data.year}.\n\n` +
            `1. CUMPLIMIENTO DE OBJETIVOS Y ACTIVIDAD ECONÓMICA:\n` +
            `Durante el ejercicio ${data.year}, la administración ha orientado sus esfuerzos a mantener la regularidad formal, tributaria y societaria de la compañía. ` +
            `Se han cumplido oportunamente las obligaciones ante el Servicio de Rentas Internas (SRI), Instituto Ecuatoriano de Seguridad Social (IESS) y la Superintendencia de Compañías, Valores y Seguros.\n\n` +
            `2. SITUACIÓN FINANCIERA:\n` +
            `Los Estados Financieros reflejan fielmente la situación patrimonial de la compañía, destacándose una cuenta de Capital Social de $${data.capital.toFixed(2)} USD ` +
            `y saldos disponibles en la cuenta Bancos e Instituciones Financieras por el valor de $${data.bancos.toFixed(2)} USD.\n\n` +
            `3. RECOMENDACIONES:\n` +
            `Se recomienda a la Junta General la aprobación íntegra de los balances y estados financieros presentados.\n\n` +
            `Atentamente,`,
          alignment: 'justify',
          margin: [0, 0, 0, 40],
        },

        // Firma Gerente
        {
          stack: [
            { text: '_______________________________', alignment: 'center' },
            { text: data.gerenteName, bold: true, alignment: 'center', fontSize: 9 },
            { text: 'REPRESENTANTE LEGAL', alignment: 'center', fontSize: 8, color: '#6B7280' },
          ],
          margin: [0, 0, 0, 50],
          pageBreak: 'after',
        },

        // ══════════════════════════════════════════════════════
        // DOCUMENTO 3: NOTAS A LOS ESTADOS FINANCIEROS
        // ══════════════════════════════════════════════════════
        { text: data.companyName.toUpperCase(), fontSize: 13, bold: true, alignment: 'center', color: '#1E2A3C' },
        { text: `RUC: ${data.ruc}`, fontSize: 10, alignment: 'center', color: '#6B7280', margin: [0, 2, 0, 10] },
        {
          text: `NOTAS A LOS ESTADOS FINANCIEROS POR EL EJERCICIO TERMINADO AL 31 DE DICIEMBRE DE ${data.year}`,
          fontSize: 11,
          bold: true,
          alignment: 'center',
          color: '#1E80C1',
          margin: [0, 0, 0, 15],
        },
        {
          text:
            `NOTA 1: OPERACIONES Y CONSTITUCIÓN\n` +
            `La compañía ${data.companyName} fue constituida bajo las leyes de la República del Ecuador, con domicilio principal en la ciudad de Loja. ` +
            `Su objeto social comprende actividades comerciales y de servicios legalmente autorizadas en el país.\n\n` +
            `NOTA 2: BASES DE PRESENTACIÓN Y NORMATIVA CONTABLE\n` +
            `Los presentes Estados Financieros han sido preparados de acuerdo con la Norma Internacional de Información Financiera para Pequeñas y Medianas Entidades (NIIF para las PYMES), ` +
            `adoptadas por la Superintendencia de Compañías del Ecuador.\n\n` +
            `NOTA 3: EFECTIVO Y EQUIVALENTES DE EFECTIVO\n` +
            `Al 31 de diciembre de ${data.year}, el saldo de efectivo y equivalentes en cuentas bancarias asciende a $${data.bancos.toFixed(2)} USD, ` +
            `los cuales se encuentran disponibles sin restricción alguna.\n\n` +
            `NOTA 4: PATRIMONIO Y CAPITAL SOCIAL\n` +
            `El capital suscrito y pagado de la compañía está constituido por acciones ordinarias y nominativas con un valor nominal acumulado de $${data.capital.toFixed(2)} USD.\n\n` +
            `NOTA 5: HECHOS POSTERIORES\n` +
            `Entre el 31 de diciembre de ${data.year} y la fecha de emisión de estos estados financieros, no se han producido hechos relevantes que pudieran afectar la presentación de los mismos.`,
          alignment: 'justify',
          margin: [0, 0, 0, 40],
        },

        // Firmas Notas
        {
          columns: [
            {
              stack: [
                { text: '_______________________________', alignment: 'center' },
                { text: data.gerenteName, bold: true, alignment: 'center', fontSize: 9 },
                { text: 'REPRESENTANTE LEGAL', alignment: 'center', fontSize: 8, color: '#6B7280' },
              ],
            },
            {
              stack: [
                { text: '_______________________________', alignment: 'center' },
                { text: 'ING. MAYRA CASTILLO', bold: true, alignment: 'center', fontSize: 9 },
                { text: 'CONTADORA GENERAL - MAT. PROFESIONAL', alignment: 'center', fontSize: 8, color: '#6B7280' },
              ],
            },
          ],
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
}

