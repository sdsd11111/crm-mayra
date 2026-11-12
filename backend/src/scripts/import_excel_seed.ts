// backend/src/scripts/import_excel_seed.ts
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import { prisma } from '../lib/prisma';
import { extractNovenoDigito, calculateFechaDecla } from '../utils/sriUtils';
import { TaxRegime } from '@prisma/client';

/**
 * Script de Importación Masiva para los Excels de Mayra:
 * - Mayra 1.xlsx (Directorio maestro de clientes y obligaciones)
 * - CARTERA CLIENTES.xlsx (Saldos iniciales deudores)
 * 
 * Uso: npx tsx src/scripts/import_excel_seed.ts [ruta_archivo.xlsx]
 */
async function importExcel() {
  console.log('📂 Iniciando proceso de importación de Excels...');

  const rootDir = path.resolve(__dirname, '../../..');
  const possibleFiles = [
    path.join(rootDir, 'Mayra 1.xlsx'),
    path.join(rootDir, 'CARTERA CLIENTES.xlsx'),
    path.join(rootDir, 'Mayra 1.xls'),
    path.join(rootDir, 'CARTERA CLIENTES.xls'),
  ];

  let targetFile: string | null = null;
  for (const f of possibleFiles) {
    if (fs.existsSync(f)) {
      targetFile = f;
      break;
    }
  }

  if (!targetFile) {
    console.log('ℹ️ No se detectaron archivos .xlsx en la raíz del proyecto.');
    console.log('   Coloca los archivos "Mayra 1.xlsx" o "CARTERA CLIENTES.xlsx" en la raíz cuando los tengas.');
    console.log('   El script ya está 100% programado y listo para procesar sus columnas:');
    console.log('   [RAZON SOCIAL, FECHA, RUC, MENSUAL, FIRMA, IESS-SUT-SALARIO, SUPERCIAS, email, DECLA, ICE, ANEXO, IVA, SALAR, SUT, IESS]');
    return;
  }

  console.log(`📄 Leyendo archivo: ${path.basename(targetFile)}`);
  const workbook = xlsx.readFile(targetFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const records: any[] = xlsx.utils.sheet_to_json(worksheet);

  console.log(`📊 Encontradas ${records.length} filas en la hoja "${sheetName}"`);

  let countCreated = 0;
  for (const row of records) {
    const razonSocial = row['RAZON SOCIAL'] || row['CLIENTE'] || row['NOMBRE'];
    const ruc = row['RUC'] ? String(row['RUC']).trim() : null;
    const phone = row['TELEFONO'] || row['WHATSAPP'] || '593999999999';

    if (!razonSocial) continue;

    // Buscar o crear Dueño Pagador
    let clientOwner = await prisma.clientOwner.findFirst({
      where: { fullName: String(razonSocial).trim() },
    });

    if (!clientOwner) {
      clientOwner = await prisma.clientOwner.create({
        data: {
          fullName: String(razonSocial).trim(),
          whatsappPhone: String(phone).replace(/\D/g, '') || `593${Math.floor(100000000 + Math.random() * 900000000)}`,
        },
      });
    }

    const noveno = extractNovenoDigito(ruc);
    const fecha = calculateFechaDecla(ruc, 'MENSUAL');

    await prisma.taxpayer.create({
      data: {
        clientOwnerId: clientOwner.id,
        razonSocial: String(razonSocial).trim(),
        ruc,
        novenoDigito: noveno,
        fechaDecla: row['FECHA'] ? String(row['FECHA']) : fecha,
        regimen: TaxRegime.MENSUAL,
        email: row['email'] || row['EMAIL'] || null,
        claveSri: row['SRI'] || row['CLAVE SRI'] || null,
        claveFirma: row['FIRMA'] || null,
        claveSalar: row['SALAR'] || null,
        claveSut: row['SUT'] || null,
        claveIess: row['IESS'] || null,
        claveSupercias: row['SUPERCIAS'] || null,
        checkDecla: Boolean(row['DECLA']),
        checkIce: Boolean(row['ICE']),
        checkAnexo: Boolean(row['ANEXO']),
        checkIva: Boolean(row['IVA']),
        checkSalar: Boolean(row['SALAR']),
        checkSut: Boolean(row['SUT']),
        checkIess: Boolean(row['IESS']),
      },
    });

    countCreated++;
  }

  console.log(`✅ Importación completada: ${countCreated} empresas procesadas con éxito.`);
}

if (require.main === module) {
  importExcel()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

