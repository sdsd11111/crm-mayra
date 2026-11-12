# 01. ARQUITECTURA DE BASE DE DATOS Y PRISMA ORM

## 1. Conceptos Fundamentales del Modelo de Datos

### A. Relación "Uno a Muchos": Dueño/Pagador (`ClientOwner`) -> Empresas/RUCs (`Taxpayer`)
En la oficina de Mayra, una sola persona (ej. *Pedro Rojas*, *María Daniela Castillo* o *César Pérez*) puede ser dueña de varias razones sociales (ej. *Dharma Cosmetics*, *Tulp Farma* y su *RUC Personal*).
- **Siempre se crea primero el `ClientOwner` (Cliente Principal / Pagador):** Contiene el número de WhatsApp al que se le cobra y su PIN de seguridad.
- **Dentro del `ClientOwner` se desglosan 1 o N `Taxpayer` (Empresas/RUCs):** Si el cliente solo tiene su RUC personal, tendrá 1 `ClientOwner` y 1 `Taxpayer`. Si tiene 3 empresas, tendrá 1 `ClientOwner` y 3 `Taxpayer`.

### B. La Tabla Fija del Contribuyente (`Taxpayer`)
Reproduce **exactamente** las columnas del Excel maestro de Mayra (`Mayra 1.xlsx`):
`RAZON SOCIAL | FECHA (9no dígito) | RUC | MENSUAL/REGIMEN | FIRMA | IESS-SUT-SALARIO | SUPERCIAS | EMAIL | DECLA | ICE | ANEXO | IVA | SALAR | SUT | IESS`.
- **Todos los campos de claves y obligaciones son opcionales (`nullable`).** No importa si quedan vacíos en un cliente; la estructura de columnas siempre es la misma para mantener orden absoluto.

### C. Separación de Archivos (`Document`) y Movimientos Contables (`LedgerEntry`)
- Los links de Bunny.net **NUNCA** se guardan como columnas sueltas en la fila del cliente. Se guardan en la tabla `Document` vinculada al `Taxpayer`, permitiendo almacenar infinitos archivos por año, mes y categoría.
- Los cobros y abonos se guardan en `LedgerEntry` ("Bolsa de Deuda"), donde los servicios suman (`+`) y los abonos restan (`-`).

---

## 2. Esquema Completo de Prisma (`schema.prisma`)

```prisma
datasource db {
  provider = "mysql" // Compatible también con "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// 1. USUARIOS DEL CRM (LOGIN SOLO CON USERNAME)
// ==========================================
enum UserRole {
  ADMIN_MAYRA // Ve todo: finanzas, bancos, precios, claves, chats
  ASISTENTE   // "Las chicas": CERO acceso a precios, carteras ni bancos
  COBRADOR    // Esposo de Mayra: Solo ve cartera vencida y cobranzas
}

model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique // Ej: "mayra", "chica1", "esposo" (SIN EMAIL)
  passwordHash String
  fullName     String
  role         UserRole @default(ASISTENTE)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  uploadedDocs   Document[]
  ledgerEntries  LedgerEntry[]
  assignedChats  ChatTicket[]
}

// ==========================================
// 2. CLIENTE PRINCIPAL / DUEÑO PAGADOR
// ==========================================
model ClientOwner {
  id                Int      @id @default(autoincrement())
  fullName          String   // Ej: "Pedro Rojas" o "María Daniela Castillo"
  whatsappPhone     String   @unique // Formato E.164 ej: "593991234567"
  securityPin       String   @default("0000") // PIN de 4 dígitos para pedir claves/RUC por bot
  isVip             Boolean  @default(false)  // Si es true, rebota al WhatsApp personal de Mayra 24/7
  dataConsentSigned Boolean  @default(false)  // Aceptación de Ley de Protección de Datos
  notes             String?  @db.Text
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  taxpayers       Taxpayer[]
  ledgerEntries   LedgerEntry[]
  paymentPromises PaymentPromise[]
  chatTickets     ChatTicket[]
}

// ==========================================
// 3. EMPRESAS / RUCs (TABLA FIJA DE MAYRA)
// ==========================================
enum TaxRegime {
  MENSUAL
  SEMESTRAL
  ANUAL
  COMPANIA_SUPERCIAS
  DEVOLUCION_IVA_3RA_EDAD
  INACTIVO_CERRADO
}

enum BillingFrequency {
  NONE      // Sin cobro automático (solo cargos manuales)
  MENSUAL   // El cron suma cada mes
  SEMESTRAL // El cron suma en Enero y Julio
  ANUAL     // El cron suma 1 vez al año (Marzo/Abril)
}

model Taxpayer {
  id              Int       @id @default(autoincrement())
  clientOwnerId   Int
  clientOwner     ClientOwner @relation(fields: [clientOwnerId], references: [id], onDelete: Cascade)

  // --- COLUMNAS FIJAS DEL EXCEL DE MAYRA (PUEDEN QUEDAR VACÍAS) ---
  razonSocial     String    // RAZON SOCIAL
  ruc             String?   @unique // RUC o Cédula
  fechaDecla      String?   // FECHA DECLA (Ej: "14C/MES", "10 JU-EN", "16 AÑO")
  novenoDigito    Int?      // Extraído del RUC (1 al 9, 0) para ordenar el calendario tributario
  regimen         TaxRegime @default(MENSUAL) // MENSUAL / SEMESTRAL / ANUAL / IVA
  email           String?   // email

  // --- CLAVES Y ACCESOS (OPCIONALES) ---
  claveSri        String?   // Clave del SRI
  claveFirma      String?   // FIRMA (Contraseña de la firma electrónica)
  firmaFileUrl    String?   // Link privado en Bunny.net del archivo .p12
  firmaExpira     DateTime? // Fecha de caducidad de la firma para alertas automáticas
  claveSalar      String?   // SALAR (Salarios en línea)
  claveSut        String?   // SUT (Ministerio de Trabajo)
  claveIess       String?   // IESS
  claveSupercias  String?   // SUPERCIAS (Clave)
  expSupercias    String?   // N. EXPEDIENTE SUPERCIAS
  claveSercop     String?   // Clave SERCOP / Otros

  // --- CHECKS DE OBLIGACIONES (TRUE/FALSE O TEXTO CORTO) ---
  checkDecla      Boolean   @default(false) // DECLA
  checkIce        Boolean   @default(false) // ICE (Impuesto Consumos Especiales)
  checkAnexo      Boolean   @default(false) // ANEXO (ATS)
  checkIva        Boolean   @default(false) // IVA
  checkSalar      Boolean   @default(false) // SALAR
  checkSut        Boolean   @default(false) // SUT
  checkIess       Boolean   @default(false) // IESS
  checkSupercias  Boolean   @default(false) // SUPERCIAS
  checkPatente    Boolean   @default(false) // PATENTE MUNICIPAL

  // --- CONFIGURACIÓN DE COBRO AUTOMÁTICO (OCULTO PARA LAS CHICAS) ---
  autoBillFreq    BillingFrequency @default(NONE)
  autoBillAmount  Decimal   @default(0.00) @db.Decimal(10, 2) // Ej: $50.00 mensuales
  appliesVat      Boolean   @default(false) // Si suma 15% de IVA al honorario (ej. Padfit/Pascaltech)
  devIvaPercent   Decimal   @default(10.00) @db.Decimal(5, 2) // % comisión 3ra edad (10% por defecto, 8% editable)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  documents       Document[]
  ledgerEntries   LedgerEntry[]
  devIvaRecords   DevIvaRecord[]
}

// ==========================================
// 4. BÓVEDA DIGITAL DE ARCHIVOS (BUNNY.NET)
// ==========================================
enum DocCategory {
  DECLARACION_IVA
  DECLARACION_RENTA
  ANEXO_ATS
  DECLARACION_ICE
  SUPERCIAS_ESTADOS
  RUC_CERTIFICADO
  NOMBRAMIENTO_ESCRITURA
  PLANILLA_IESS_SUT
  FACTURA_EMITIDA
  PROYECCION_RENTA
  FIRMA_ELECTRONICA_P12
  OTRO_DOCUMENTO
}

model Document {
  id            Int         @id @default(autoincrement())
  taxpayerId    Int
  taxpayer      Taxpayer    @relation(fields: [taxpayerId], references: [id], onDelete: Cascade)

  category      DocCategory
  title         String      // Ej: "Declaración IVA Mayo 2026"
  periodYear    Int         // Ej: 2026
  periodMonth   Int?        // Ej: 5 (Mayo), null si es anual
  bunnyPath     String      // Ruta en Bunny.net: "/clientes/1191797243001/2026/IVA/iva_mayo.pdf"
  bunnyUrl      String      // URL de descarga (vía proxy o firmada)
  fileType      String      // "PDF", "XML", "P12", "ZIP"

  uploadedById  Int
  uploadedBy    User        @relation(fields: [uploadedById], references: [id])
  sentByWhatsapp Boolean    @default(false)
  createdAt     DateTime    @default(now())
}

// ==========================================
// 5. CONTABILIDAD / CARTERA (BOLSA DE DEUDA)
// ==========================================
enum EntryType {
  CARGO_AUTOMATICO  // Generado por el Cron (Mensual/Semestral/Anual)
  CARGO_MANUAL      // Servicio suelto puesto a mano por Mayra
  CARGO_COMISION_DEV // Generado automáticamente al calcular el % de Devolución IVA
  ABONO_PAGO        // Resta a la deuda total
  DESCUENTO_CRUCE   // Resta por arriendo, error de factura anulada o nota de crédito
}

enum BankAccount {
  NO_APLICA         // Cuando es un cargo (+)
  BANCO_PICHINCHA   // Cuenta 1 de Mayra
  BANCO_DE_LOJA     // Cuenta 2 de Mayra
  COOPERATIVA_JEP   // Cuenta 3 de Mayra
  EFECTIVO          // Pago en efectivo en oficina
  CRUCE_CUENTAS     // Trueque / Descuento por arriendo
}

model LedgerEntry {
  id            Int         @id @default(autoincrement())
  clientOwnerId Int
  clientOwner   ClientOwner @relation(fields: [clientOwnerId], references: [id], onDelete: Cascade)
  taxpayerId    Int?        // A qué empresa específica corresponde el cargo (opcional en abonos generales)
  taxpayer      Taxpayer?   @relation(fields: [taxpayerId], references: [id], onDelete: SetNull)

  entryType     EntryType
  concept       String      // Ej: "Honorario Mensual Mayo 2026 - Dharma" o "Abono Transferencia"
  periodText    String?     // Ej: "2026-05" o "ANUAL 2025"
  amount        Decimal     @db.Decimal(10, 2) // Positivo siempre; el sistema suma si es CARGO y resta si es ABONO/DESCUENTO
  bankAccount   BankAccount @default(NO_APLICA)
  receiptUrl    String?     // Foto del comprobante de transferencia si existe
  entryDate     DateTime    @default(now())

  createdById   Int?
  createdBy     User?       @relation(fields: [createdById], references: [id])
}

// ==========================================
// 6. REGISTRO DE DEVOLUCIÓN DE IVA (MODO CIEGO ASISTENTES)
// ==========================================
model DevIvaRecord {
  id              Int      @id @default(autoincrement())
  taxpayerId      Int
  taxpayer        Taxpayer @relation(fields: [taxpayerId], references: [id], onDelete: Cascade)
  periodYear      Int      // Ej: 2026
  periodMonth     Int      // Ej: 6 (Junio)
  requestedAmount Decimal  @db.Decimal(10, 2) // Lo único que digita la chica (ej. $138.00)
  commissionPct   Decimal  @db.Decimal(5, 2)  // Tomado de Taxpayer.devIvaPercent (ej. 10%) - OCULTO A LA CHICA
  commissionTotal Decimal  @db.Decimal(10, 2) // Calculado ($13.80) y enviado a LedgerEntry - OCULTO A LA CHICA
  createdAt       DateTime @default(now())
}

// ==========================================
// 7. PROMESAS DE PAGO Y TICKETS DE WHATSAPP
// ==========================================
model PaymentPromise {
  id            Int         @id @default(autoincrement())
  clientOwnerId Int
  clientOwner   ClientOwner @relation(fields: [clientOwnerId], references: [id], onDelete: Cascade)
  promisedDate  DateTime    // Fecha en que prometió pagar (ej. el día 15)
  promisedAmount Decimal?   @db.Decimal(10, 2)
  status        String      @default("PENDIENTE") // PENDIENTE, CUMPLIDA, INCUMPLIDA
  notes         String?
  createdAt     DateTime    @default(now())
}

model ChatTicket {
  id            Int          @id @default(autoincrement())
  clientOwnerId Int?
  clientOwner   ClientOwner? @relation(fields: [clientOwnerId], references: [id])
  whatsappPhone String
  queueType     String       // "OPERATIVA_CHICAS", "GERENCIAL_MAYRA", "COBRANZA"
  subject       String       // Ej: "Solicitud de Factura", "Cliente Nuevo", "Firma Electrónica"
  status        String       @default("ABIERTO") // ABIERTO, EN_PROCESO, CERRADO
  assignedToId  Int?
  assignedTo    User?        @relation(fields: [assignedToId], references: [id])
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}
```
