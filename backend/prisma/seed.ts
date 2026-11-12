// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const UserRole = {
  ADMIN_MAYRA: 'ADMIN_MAYRA',
  ASISTENTE: 'ASISTENTE',
  COBRADOR: 'COBRADOR',
} as const;

export const TaxRegime = {
  MENSUAL: 'MENSUAL',
  SEMESTRAL: 'SEMESTRAL',
  ANUAL: 'ANUAL',
  COMPANIA_SUPERCIAS: 'COMPANIA_SUPERCIAS',
  DEVOLUCION_IVA_3RA_EDAD: 'DEVOLUCION_IVA_3RA_EDAD',
  INACTIVO_CERRADO: 'INACTIVO_CERRADO',
} as const;

export const BillingFrequency = {
  NONE: 'NONE',
  MENSUAL: 'MENSUAL',
  SEMESTRAL: 'SEMESTRAL',
  ANUAL: 'ANUAL',
} as const;

export const EntryType = {
  CARGO_AUTOMATICO: 'CARGO_AUTOMATICO',
  CARGO_MANUAL: 'CARGO_MANUAL',
  CARGO_COMISION_DEV: 'CARGO_COMISION_DEV',
  ABONO_PAGO: 'ABONO_PAGO',
  DESCUENTO_CRUCE: 'DESCUENTO_CRUCE',
} as const;

export const BankAccount = {
  NO_APLICA: 'NO_APLICA',
  BANCO_PICHINCHA: 'BANCO_PICHINCHA',
  BANCO_DE_LOJA: 'BANCO_DE_LOJA',
  COOPERATIVA_JEP: 'COOPERATIVA_JEP',
  EFECTIVO: 'EFECTIVO',
  CRUCE_CUENTAS: 'CRUCE_CUENTAS',
} as const;

async function main() {
  console.log('🌱 Iniciando seed del CRM Mayra Castillo...');

  // Limpieza
  await prisma.devIvaRecord.deleteMany();
  await prisma.paymentPromise.deleteMany();
  await prisma.chatTicket.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.document.deleteMany();
  await prisma.taxpayer.deleteMany();
  await prisma.clientOwner.deleteMany();
  await prisma.user.deleteMany();

  // Usuarios (contraseña simple '123456' según indicación)
  const hash = await bcrypt.hash('123456', 10);

  const mayra = await prisma.user.create({
    data: {
      username: 'mayra',
      passwordHash: hash,
      fullName: 'Mayra Castillo',
      role: UserRole.ADMIN_MAYRA,
    },
  });

  await prisma.user.create({
    data: {
      username: 'asistente1',
      passwordHash: hash,
      fullName: 'Asistente 1',
      role: UserRole.ASISTENTE,
    },
  });

  await prisma.user.create({
    data: {
      username: 'asistente2',
      passwordHash: hash,
      fullName: 'Asistente 2',
      role: UserRole.ASISTENTE,
    },
  });

  await prisma.user.create({
    data: {
      username: 'esposo',
      passwordHash: hash,
      fullName: 'Carlos Cobrador',
      role: UserRole.COBRADOR,
    },
  });

  console.log('   ✓ 4 usuarios creados (mayra, asistente1, asistente2, esposo) con pass "123456"');

  // Caso 1: Pedro Rojas Demo (Multi-empresa)
  const pedro = await prisma.clientOwner.create({
    data: {
      fullName: 'Pedro Rojas Demo',
      whatsappPhone: '593991111001',
      securityPin: '1234',
      isVip: false,
      dataConsentSigned: true,
      notes: 'Dueño de Dharma Demo SAS y Tulp Demo.',
    },
  });

  const dharma = await prisma.taxpayer.create({
    data: {
      clientOwnerId: pedro.id,
      razonSocial: 'Dharma Demo SAS',
      ruc: '1191797001001',
      fechaDecla: '14C/MES',
      novenoDigito: 9,
      regimen: TaxRegime.MENSUAL,
      email: 'dharma@demo.com',
      claveSri: 'SRI_DHARMA',
      claveIess: 'IESS_DHARMA',
      claveSut: 'SUT_DHARMA',
      checkDecla: true,
      checkIva: true,
      checkAnexo: true,
      autoBillFreq: BillingFrequency.MENSUAL,
      autoBillAmount: 69.00,
      appliesVat: true, // $69 + 15% IVA = $79.35
    },
  });

  const tulp = await prisma.taxpayer.create({
    data: {
      clientOwnerId: pedro.id,
      razonSocial: 'Tulp Demo',
      ruc: '1191797002001',
      fechaDecla: '14C/MES',
      novenoDigito: 9,
      regimen: TaxRegime.MENSUAL,
      email: 'tulp@demo.com',
      claveSri: 'SRI_TULP',
      checkDecla: true,
      checkIva: true,
      autoBillFreq: BillingFrequency.MENSUAL,
      autoBillAmount: 23.00,
      appliesVat: false,
    },
  });

  // Cargos y abono de Pedro
  await prisma.ledgerEntry.create({
    data: {
      clientOwnerId: pedro.id,
      taxpayerId: dharma.id,
      entryType: EntryType.CARGO_AUTOMATICO,
      concept: 'Honorario Mensual Oct 2026 - Dharma Demo SAS ($69 + IVA 15%)',
      periodText: '2026-10',
      amount: 79.35,
      bankAccount: BankAccount.NO_APLICA,
      createdById: mayra.id,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      clientOwnerId: pedro.id,
      taxpayerId: tulp.id,
      entryType: EntryType.CARGO_AUTOMATICO,
      concept: 'Honorario Mensual Oct 2026 - Tulp Demo ($23)',
      periodText: '2026-10',
      amount: 23.00,
      bankAccount: BankAccount.NO_APLICA,
      createdById: mayra.id,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      clientOwnerId: pedro.id,
      entryType: EntryType.ABONO_PAGO,
      concept: 'Abono transferencia Banco Pichincha',
      amount: 50.00,
      bankAccount: BankAccount.BANCO_PICHINCHA,
      createdById: mayra.id,
    },
  });

  console.log('   ✓ Caso 1 creado: Pedro Rojas Demo (Dharma + Tulp) - Saldo pendiente: $52.35');

  // Caso 2: Don Mauro Demo (Tercera Edad - Porcentaje)
  const mauro = await prisma.clientOwner.create({
    data: {
      fullName: 'Don Mauro Demo',
      whatsappPhone: '593992222002',
      securityPin: '5678',
      isVip: false,
      dataConsentSigned: true,
    },
  });

  const mauroTax = await prisma.taxpayer.create({
    data: {
      clientOwnerId: mauro.id,
      razonSocial: 'Mauro Demo Personal',
      ruc: '1109876001001',
      fechaDecla: '10 JU-EN',
      novenoDigito: 6,
      regimen: TaxRegime.DEVOLUCION_IVA_3RA_EDAD,
      claveSri: 'MAURO_SRI',
      checkDecla: true,
      checkIva: true,
      devIvaPercent: 10.00,
    },
  });

  await prisma.devIvaRecord.create({
    data: {
      taxpayerId: mauroTax.id,
      periodYear: 2026,
      periodMonth: 9,
      requestedAmount: 138.00,
      commissionPct: 10.00,
      commissionTotal: 13.80,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      clientOwnerId: mauro.id,
      taxpayerId: mauroTax.id,
      entryType: EntryType.CARGO_COMISION_DEV,
      concept: 'Comisión Dev. IVA Septiembre 2026 (10% de $138.00)',
      amount: 13.80,
      bankAccount: BankAccount.NO_APLICA,
      createdById: mayra.id,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      clientOwnerId: mauro.id,
      entryType: EntryType.ABONO_PAGO,
      concept: 'Abono transferencia Cooperativa JEP',
      amount: 13.80,
      bankAccount: BankAccount.COOPERATIVA_JEP,
      createdById: mayra.id,
    },
  });

  console.log('   ✓ Caso 2 creado: Don Mauro Demo (Dev IVA 10% - $13.80 abonado en Cooperativa JEP)');

  // Caso 3: Ana Torres Demo (Semestral)
  const ana = await prisma.clientOwner.create({
    data: {
      fullName: 'Ana Torres Demo',
      whatsappPhone: '593993333003',
      securityPin: '9012',
      isVip: true,
      dataConsentSigned: true,
    },
  });

  const anaTax = await prisma.taxpayer.create({
    data: {
      clientOwnerId: ana.id,
      razonSocial: 'Ana Torres Demo Personal',
      ruc: '1105550001001',
      fechaDecla: '10 JU-EN',
      novenoDigito: 4,
      regimen: TaxRegime.SEMESTRAL,
      claveSri: 'ANA_SRI',
      claveIess: 'ANA_IESS',
      claveSut: 'ANA_SUT',
      checkDecla: true,
      checkIva: true,
      checkIess: true,
      checkSut: true,
      autoBillFreq: BillingFrequency.SEMESTRAL,
      autoBillAmount: 45.00,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      clientOwnerId: ana.id,
      taxpayerId: anaTax.id,
      entryType: EntryType.CARGO_AUTOMATICO,
      concept: 'Honorario Semestral Julio 2026',
      amount: 45.00,
      bankAccount: BankAccount.NO_APLICA,
      createdById: mayra.id,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      clientOwnerId: ana.id,
      entryType: EntryType.ABONO_PAGO,
      concept: 'Abono transferencia Banco de Loja',
      amount: 45.00,
      bankAccount: BankAccount.BANCO_DE_LOJA,
      createdById: mayra.id,
    },
  });

  console.log('   ✓ Caso 3 creado: Ana Torres Demo (Semestral - $45 abonado en Banco de Loja)');
  console.log('🎉 Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
