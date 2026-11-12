# 05. ROADMAP DE DESARROLLO Y BITÁCORA PARA ANTIGRAVITY

> **REGLA DE ACTUALIZACIÓN:** Antigravity debe seguir este orden exacto (de lo más crítico a lo más simple) y marcar `[x]` cada ítem apenas quede programado y probado.

---

## FASE 1: Base del Proyecto, Base de Datos y Login Simple (Prioridad Máxima)
- [ ] **1.1.** Inicializar estructura Monorepo con `/backend` (**Node.js + Express + TypeScript + Prisma + Socket.io**, puerto `4000`) y `/frontend` (**Next.js App Router + React + TypeScript + TailwindCSS**, puerto `3000`).
- [ ] **1.2.** Configurar Prisma ORM con el esquema exacto de `01_BASE_DE_DATOS_Y_PRISMA.md` y correr la primera migración (`npx prisma migrate dev`).
- [ ] **1.3.** Crear el `seed.ts` inicial con los usuarios base (**usando solo `username` y `password`, SIN correos**):
  - Usuario `mayra` (Rol: `ADMIN_MAYRA`)
  - Usuario `asistente1` (Rol: `ASISTENTE`)
  - Usuario `asistente2` (Rol: `ASISTENTE`)
  - Usuario `esposo` (Rol: `COBRADOR`)
- [ ] **1.4.** Construir el endpoint `POST /api/auth/login` (validación por `username` + JWT) y el Middleware de protección por Roles (`requireRole(['ADMIN_MAYRA'])` para blindar las rutas de dinero y precios).
- [ ] **1.5.** Crear la Pantalla de Login (`/login`) en **Next.js + React + TypeScript** con el logo de Mayra Castillo (`#1E80C1` / `#1E2A3C`).

---

## FASE 2: Directorio de Clientes (Tabla Fija de Mayra) y Script de Migración
- [ ] **2.1.** Crear el script de importación (`import_excel_seed.ts`) para cargar automáticamente los clientes de `Mayra 1.xlsx` y sus saldos iniciales de `CARTERA CLIENTES.xlsx` sin que Nohan tenga que digitarlos uno por uno.
- [ ] **2.2.** Construir el CRUD de `ClientOwner` (Dueño/Pagador) y `Taxpayer` (Empresas hijas con las columnas exactas: `RAZON SOCIAL, FECHA, RUC, MENSUAL, FIRMA, IESS-SUT-SALARIO, SUPERCIAS, email, DECLA, ICE, ANEXO, IVA, SALAR, SUT, IESS`).
- [ ] **2.3.** Programar el extractor automático del **9no dígito del RUC** al guardar un `Taxpayer` para asignar su día de vencimiento tributario.
- [ ] **2.4.** Construir la **Pantalla 2 (Directorio Maestro de Clientes `/clientes`)** en **Next.js + React + TypeScript** con pestañas por régimen (`Mensual, Semestral, Anual, Supercias, Dev. IVA`), filtro por día de vencimiento y botones para copiar claves en 1 clic.
- [ ] **2.5.** Asegurar que si el usuario logueado es `ASISTENTE`, el backend y el frontend oculten cualquier dato monetario.

---

## FASE 3: Bóveda Digital de Archivos (Bunny.net Storage)
- [ ] **3.1.** Crear el servicio `BunnyStorageService.ts` en el backend para subir, listar y descargar archivos bajo la estructura `/clientes/{ruc}/{anio}/{categoria}/{archivo}`.
- [ ] **3.2.** Construir los endpoints `POST /api/documents/upload` y `GET /api/documents/taxpayer/:id`.
- [ ] **3.3.** Construir en **Next.js + React + TypeScript** la **Sub-Pestaña de Carpetas Digitales** dentro del Expediente del Cliente (organizada visualmente por Año y Tipo de obligación) + Semáforo Tributario (Verde cuando ya se subió la declaración del mes actual, Amarillo pendiente, Rojo 1 día antes del vencimiento).

---

## FASE 4: Motor Contable ("Bolsa de Deuda"), Cronjobs, 3 Bancos y PDF
- [ ] **4.1.** Construir los endpoints de `LedgerEntry` (solo accesibles por `ADMIN_MAYRA` y `COBRADOR`):
  - Agregar Cargo Manual (`+`) con precio libre.
  - Registrar Abono Manual (`-`) con selector obligatorio de las 3 cuentas bancarias (`BANCO_PICHINCHA`, `BANCO_DE_LOJA`, `COOPERATIVA_JEP`, `EFECTIVO`, `CRUCE_CUENTAS`).
- [ ] **4.2.** Construir el endpoint y formulario "Modo Ciego" de **Devolución de IVA Tercera Edad**: la asistente ingresa el `Monto Solicitado al SRI ($)` y el backend calcula internamente el `%` configurado (`10%` u `8%`) y suma la comisión a la bolsa de deuda de Mayra.
- [ ] **4.3.** Programar el Cronjob (`BillingCron.ts`) que corre el día 1 de cada mes para aumentar automáticamente el saldo de los clientes según su configuración (`MENSUAL`, `SEMESTRAL`, `ANUAL`).
- [ ] **4.4.** Construir el generador de **Estado de Cuenta en PDF Consolidado** (agrupando las empresas de un mismo dueño y mostrando cargos, abonos y saldo total).
- [ ] **4.5.** Construir la **Pantalla 1 (Dashboard Financiero de Mayra)** siguiendo el diseño de la imagen de referencia (Total Balance + los **3 Círculos de Pichincha, Loja y JEP** + Gráfico mensual + Vencimientos del día).

---

## FASE 5: Bot de WhatsApp (Evolution API), Bandeja de Chats y Cobranza
- [ ] **5.1.** Conectar el Webhook de Evolution API (`POST /api/whatsapp/webhook`) y configurar Socket.io para mostrar los mensajes en vivo en la **Pantalla 4 (Centro de WhatsApp)**.
- [ ] **5.2.** Programar el enrutador del Bot:
  - Identificación por número + validación de PIN de 4 dígitos para datos sensibles.
  - Rebote 24/7 al celular personal de Mayra si `isVip == true`.
  - Derivación a `GERENCIAL_MAYRA` si es cliente nuevo o asesoría.
  - Derivación a `OPERATIVA_CHICAS` si pide facturas, planillas IESS o trámites.
- [ ] **5.3.** Conectar las Tools de IA del Bot con `Document` (Bunny.net) para que cuando un cliente pida sus declaraciones, RUC o nombramientos por WhatsApp, el bot se los envíe en PDF automáticamente.
- [ ] **5.4.** Programar el flujo guiado de **Venta de Firmas Electrónicas** (solicitud de requisitos + foto de transferencia).
- [ ] **5.5.** Programar el Cronjob de **Cobranza Automática (Días 1 al 5 del mes)**, el registro automático de **Promesas de Pago** (`PaymentPromise`) y las alertas de caducidad de Firmas Electrónicas `.p12` (5 días antes de expirar).

---

## FASE 6: Automatizaciones Extras (Etapa Final)
- [ ] **6.1.** Generador por plantillas de los 3 informes anuales de la **Superintendencia de Compañías** (*Acta de Junta*, *Informe de Gerente* y *Notas a los Estados Financieros*) a partir de un formulario simple de saldos contables.
- [ ] **6.2.** Módulo de envío masivo semestral (Mayo y Octubre) de **Proyecciones de Impuesto a la Renta** con recordatorio automático si el cliente no confirma lectura.

---

## 📝 BITÁCORA DE AVANCE (Espacio para que Antigravity documente cambios)
- **Fecha de creación del Plan:** Planificación inicial completada y validada con Nohan.
- *Antigravity: Registra aquí debajo cada fase completada, rutas de API creadas y notas de despliegue.*
