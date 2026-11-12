# 05. ROADMAP DE DESARROLLO Y BITÁCORA PARA ANTIGRAVITY

> **REGLA DE ACTUALIZACIÓN:** Antigravity debe seguir este orden exacto (de lo más crítico a lo más simple) y marcar `[x]` cada ítem apenas quede programado y probado.

---

## FASE 1: Base del Proyecto, Base de Datos y Login Simple (Prioridad Máxima)
- [x] **1.1.** Inicializar estructura Monorepo con `/backend` (**Node.js + Express + TypeScript + Prisma + Socket.io**, puerto `4000`) y `/frontend` (**Next.js App Router + React + TypeScript + TailwindCSS**, puerto `3000`).
- [x] **1.2.** Configurar Prisma ORM con el esquema exacto de `01_BASE_DE_DATOS_Y_PRISMA.md` y correr la primera migración (`npx prisma db push`).
- [x] **1.3.** Crear el `seed.ts` inicial con los usuarios base (**usando solo `username` y `password`, SIN correos**):
  - Usuario `mayra` (Rol: `ADMIN_MAYRA`)
  - Usuario `asistente1` (Rol: `ASISTENTE`)
  - Usuario `asistente2` (Rol: `ASISTENTE`)
  - Usuario `esposo` (Rol: `COBRADOR`)
- [x] **1.4.** Construir el endpoint `POST /api/auth/login` (validación por `username` + JWT) y el Middleware de protección por Roles (`requireRole(['ADMIN_MAYRA'])` para blindar las rutas de dinero y precios).
- [x] **1.5.** Crear la Pantalla de Login (`/login`) en **Next.js + React + TypeScript** con el logo de Mayra Castillo (`#1E80C1` / `#1E2A3C`).

---

## FASE 2: Directorio de Clientes (Tabla Fija de Mayra) y Script de Migración
- [x] **2.1.** Crear el script de importación (`import_excel_seed.ts`) para cargar automáticamente los clientes de `Mayra 1.xlsx` y sus saldos iniciales de `CARTERA CLIENTES.xlsx` sin que Nohan tenga que digitarlos uno por uno.
- [x] **2.2.** Construir el CRUD de `ClientOwner` (Dueño/Pagador) y `Taxpayer` (Empresas hijas con las columnas exactas: `RAZON SOCIAL, FECHA, RUC, MENSUAL, FIRMA, IESS-SUT-SALARIO, SUPERCIAS, email, DECLA, ICE, ANEXO, IVA, SALAR, SUT, IESS`).
- [x] **2.3.** Programar el extractor automático del **9no dígito del RUC** al guardar un `Taxpayer` para asignar su día de vencimiento tributario.
- [x] **2.4.** Construir la **Pantalla 2 (Directorio Maestro de Clientes `/clientes`)** en **Next.js + React + TypeScript** con pestañas por régimen (`Mensual, Semestral, Anual, Supercias, Dev. IVA`), filtro por día de vencimiento y botones para copiar claves en 1 clic.
- [x] **2.5.** Asegurar que si el usuario logueado es `ASISTENTE`, el backend y el frontend oculten cualquier dato monetario.

---

## FASE 3: Bóveda Digital de Archivos (Bunny.net Storage)
- [x] **3.1.** Crear el servicio `BunnyStorageService.ts` en el backend para subir, listar y descargar archivos bajo la estructura `/clientes/{ruc}/{anio}/{categoria}/{archivo}`.
- [x] **3.2.** Construir los endpoints `POST /api/documents/upload` y `GET /api/documents/taxpayer/:id`.
- [x] **3.3.** Construir en **Next.js + React + TypeScript** la **Sub-Pestaña de Carpetas Digitales** dentro del Expediente del Cliente (organizada visualmente por Año y Tipo de obligación) + Semáforo Tributario (Verde cuando ya se subió la declaración del mes actual, Amarillo pendiente, Rojo 1 día antes del vencimiento).

---

## FASE 4: Motor Contable ("Bolsa de Deuda"), Cronjobs, 3 Bancos y PDF
- [x] **4.1.** Construir los endpoints de `LedgerEntry` (solo accesibles por `ADMIN_MAYRA` y `COBRADOR`):
  - Agregar Cargo Manual (`+`) con precio libre.
  - Registrar Abono Manual (`-`) con selector obligatorio de las 3 cuentas bancarias (`BANCO_PICHINCHA`, `BANCO_DE_LOJA`, `COOPERATIVA_JEP`, `EFECTIVO`, `CRUCE_CUENTAS`).
- [x] **4.2.** Construir el endpoint y formulario "Modo Ciego" de **Devolución de IVA Tercera Edad**: la asistente ingresa el `Monto Solicitado al SRI ($)` y el backend calcula internamente el `%` configurado (`10%` u `8%`) y suma la comisión a la bolsa de deuda de Mayra.
- [x] **4.3.** Programar el Cronjob (`BillingCron.ts`) que corre el día 1 de cada mes para aumentar automáticamente el saldo de los clientes según su configuración (`MENSUAL`, `SEMESTRAL`, `ANUAL`).
- [x] **4.4.** Construir el generador de **Estado de Cuenta en PDF Consolidado** (agrupando las empresas de un mismo dueño y mostrando cargos, abonos y saldo total).
- [x] **4.5.** Construir la **Pantalla 1 (Dashboard Financiero de Mayra)** siguiendo el diseño de la imagen de referencia (Total Balance + los **3 Círculos de Pichincha, Loja y JEP** + Gráfico mensual + Vencimientos del día).

---

## FASE 5: Bot de WhatsApp (Evolution API), Bandeja de Chats y Cobranza
- [x] **5.1.** Conectar el Webhook de Evolution API (`POST /api/whatsapp/webhook`) y configurar Socket.io para mostrar los mensajes en vivo en la **Pantalla 4 (Centro de WhatsApp)**.
- [x] **5.2.** Programar el enrutador del Bot:
  - Identificación por número + validación de PIN de 4 dígitos para datos sensibles.
  - Rebote 24/7 al celular personal de Mayra si `isVip == true`.
  - Derivación a `GERENCIAL_MAYRA` si es cliente nuevo o asesoría.
  - Derivación a `OPERATIVA_CHICAS` si pide facturas, planillas IESS o trámites.
- [x] **5.3.** Conectar las Tools de IA del Bot con `Document` (Bunny.net) para que cuando un cliente pida sus declaraciones, RUC o nombramientos por WhatsApp, el bot se los envíe en PDF automáticamente.
- [x] **5.4.** Programar el flujo guiado de **Venta de Firmas Electrónicas** (solicitud de requisitos + foto de transferencia).
- [x] **5.5.** Programar el Cronjob de **Cobranza Automática (Días 1 al 5 del mes)**, el registro automático de **Promesas de Pago** (`PaymentPromise`) y las alertas de caducidad de Firmas Electrónicas `.p12` (5 días antes de expirar).

---

## FASE 6: Automatizaciones Extras (Etapa Final)
- [x] **6.1.** Generador por plantillas de los 3 informes anuales de la **Superintendencia de Compañías** (*Acta de Junta*, *Informe de Gerente* y *Notas a los Estados Financieros*) a partir de un formulario simple de saldos contables.
- [x] **6.2.** Módulo de envío masivo semestral (Mayo y Octubre) de **Proyecciones de Impuesto a la Renta** con recordatorio automático si el cliente no confirma lectura.

---

## 📝 BITÁCORA DE AVANCE (Espacio para que Antigravity documente cambios)
- **Fecha de creación del Plan:** Planificación inicial completada y validada con Nohan.

### 🗓️ 2026-11-09 — FASE 1 COMPLETADA

**Arquitectura Monorepo desplegada:**

| Componente | Ruta | Puerto | Stack |
|---|---|---|---|
| Raíz | `/package.json` | — | `concurrently` para `npm run dev` unificado |
| Backend | `/backend/` | `4000` | Express + TypeScript + Prisma + Socket.io |
| Frontend | `/frontend/` | `3000` | Next.js 14 App Router + React + TailwindCSS |

**Archivos creados en `/backend/`:**
- `package.json`, `tsconfig.json`, `.env`, `.env.example`
- `prisma/schema.prisma` — 9 modelos (User, ClientOwner, Taxpayer, Document, LedgerEntry, DevIvaRecord, PaymentPromise, ChatTicket)
- `prisma/seed.ts` — 4 usuarios + 3 clientes ficticios + 7 LedgerEntries + 1 DevIvaRecord
- `src/index.ts` — Express + CORS + Socket.io + health check
- `src/lib/prisma.ts` — Singleton PrismaClient
- `src/middleware/auth.ts` — `authenticateToken` (JWT) + `requireRole` (RBAC)
- `src/routes/auth.ts` — `POST /api/auth/login` + `GET /api/auth/me`
- `src/types/express.d.ts` — Augmentación de Request

**Archivos creados en `/frontend/`:**
- `package.json`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `next.config.js`
- `src/app/layout.tsx`, `src/app/page.tsx` (redirige a /login), `src/app/globals.css`
- `src/app/login/page.tsx` — Login Glassmorphism con logo, paleta `#1E80C1`/`#1E2A3C`
- `src/app/dashboard/page.tsx` — Dashboard con bienvenida por rol y navbar
- `src/contexts/AuthContext.tsx` — Provider de autenticación (JWT + localStorage)
- `src/types/auth.ts` — Tipos compartidos
- `public/Logo.jpg`, `public/logo-cuadrado.png`

**Endpoints API creados:**
- `GET /health` → Health check del backend
- `POST /api/auth/login` → Autenticación por username + password → JWT
- `GET /api/auth/me` → Verificar sesión (requiere Bearer token)

**Base de datos (MySQL Remoto StackCP):**
- Conexión activa y verificada a `mysql.us.stackcp.com:46603` (`crmmayra-313931fe4c`).
- Esquema completamente sincronizado mediante `prisma db push`.
- 4 usuarios creados: `mayra/123456` (ADMIN_MAYRA), `asistente1/123456` (ASISTENTE), `asistente2/123456` (ASISTENTE), `esposo/123456` (COBRADOR)
- 3 clientes ficticios poblando casos reales: Pedro Rojas Demo (multi-empresa), Don Mauro Demo (Dev IVA 3ra edad 10%), Ana Torres Demo (semestral)
- 7 movimientos contables repartidos entre Banco Pichincha, Cooperativa JEP y Banco de Loja.
- Eliminado archivo SQLite temporal; operando 100% sobre MySQL.

**Validaciones completadas:**
- `tsc` compila sin errores en backend
- `next build` compila sin errores en frontend (✓ Compiled successfully, 4 rutas generadas)
- Sincronización y Seed ejecutados exitosamente sobre MySQL remoto
- Proxy configurado: Next.js reenvía `/api/*` → `http://localhost:4000/api/*`

---

### 🗓️ 2026-11-09 — FASE 2 COMPLETADA

**Directorio Maestro de Clientes (`/clientes`) y Motor de Reglas:**

**Archivos creados y actualizados:**
- `backend/src/utils/sriUtils.ts`: Extractor automático del 9no dígito del RUC y mapeo exacto a días de vencimiento SRI (1->10, 2->12, 3->14, 4->16, 5->18, 6->20, 7->22, 8->24, 9->26, 0->28).
- `backend/src/routes/clients.ts`: Endpoints CRUD completos (`GET /api/clients`, `GET /api/clients/:id`, `POST /api/clients`, `PUT /api/clients/:id`, `POST /api/clients/:id/taxpayers`, `PUT /api/clients/taxpayers/:taxpayerId`, `DELETE /api/clients/taxpayers/:taxpayerId`).
- `backend/src/scripts/import_excel_seed.ts`: Script con soporte para `xlsx` preparado para leer las columnas exactas del Excel de Mayra.
- `frontend/src/types/client.ts`: Interfaces de TypeScript para clientes y empresas.
- `frontend/src/components/Navbar.tsx`: Navbar unificado con logo nítido adaptado y navegación fluida entre `/dashboard` y `/clientes`.
- `frontend/src/app/clientes/page.tsx`: Pantalla completa de directorio maestro con:
  - Buscador reactivo por Dueño, Razón Social y RUC.
  - Tabs por régimen (`Mensual`, `Semestral`, `Anual`, `Supercias`, `Dev. IVA`, `Cerrados`).
  - Filtro por día de vencimiento tributario del SRI.
  - Copiado de claves en 1 clic con toast interactivo (`¡Copiado con éxito!`).
  - Modal para creación de clientes y empresas con auto-cálculo de día.
  - **Modo Ciego estricto**: Si el usuario es `ASISTENTE`, la API no devuelve ni la UI renderiza montos, saldos ni porcentajes.

**Validaciones de Calidad:**
- Backend: Compilación `tsc` 100% limpia (0 errores).
- Frontend: `next build` compiló exitosamente (5 rutas estáticas generadas: `/`, `/_not-found`, `/clientes`, `/dashboard`, `/login`).

---

### 🗓️ 2026-11-09 — FASE 3 COMPLETADA

**Bóveda Digital de Archivos (Bunny.net Storage / Fallback) + Semáforo Tributario + Expediente 360°:**

**Archivos creados y actualizados:**
- `backend/src/services/BunnyStorageService.ts`: Servicio con subida HTTP a Bunny.net Storage bajo la jerarquía `/clientes/{ruc}/{anio}/{categoria}/{archivo}` y fallback local a `backend/uploads/` si las credenciales de Bunny aún no están configuradas.
- `backend/src/routes/documents.ts`: Endpoints `POST /api/documents/upload` (con `multer` en memoria hasta 50MB) y `GET /api/documents/taxpayer/:id`.
- `backend/src/index.ts`: Montaje de ruta de documentos y servicio estático de archivos `/uploads`.
- `frontend/src/types/document.ts`: Categorías oficiales con colores y etiquetas (IVA, Renta, ATS, ICE, Supercias, RUC, Nombramiento, IESS/SUT, Firma .p12).
- `frontend/src/app/clientes/[id]/page.tsx`: Expediente 360° completo del cliente con:
  - **Semáforo Tributario Dinámico**: 🟢 Verde si la declaración del mes ya se subió, 🟡 Amarillo si está pendiente, 🔴 Rojo si falta 1 día para el vencimiento (según 9no dígito).
  - **Sub-pestaña Ficha Técnica**: Todos los datos tributarios, claves con 1-clic de copiado y checks de obligaciones.
  - **Sub-pestaña Bóveda Digital**: Carpetas visuales agrupadas por Año, tarjetas de archivos categorizados por color y botón modal para subir nuevos archivos (con opción de auto-envío por WhatsApp).
  - **Sub-pestaña Contabilidad**: Solo visible para `ADMIN_MAYRA` y `COBRADOR` (oculta por completo para `ASISTENTE`), con movimientos del libro contable y estado de cuenta.

**Validaciones de Calidad:**
- Backend: `tsc` compila al 100% (0 errores).
- Frontend: `next build` exitoso (6 rutas: `/`, `/_not-found`, `/clientes`, `/clientes/[id]`, `/dashboard`, `/login`).

---

### 🗓️ 2026-11-09 — FASE 4 COMPLETADA

**Motor Contable ("Bolsa de Deuda"), 3 Bancos, Cronjobs, Modo Ciego 3ra Edad y PDF de Estado de Cuenta:**

**Archivos creados y actualizados:**
- `backend/src/services/BillingCron.ts`: Cronjob con `node-cron` que corre el día 1 de cada mes a las `00:05 AM` aumentando honorarios periódicos (`MENSUAL`, `SEMESTRAL` en Ene/Jul, `ANUAL` en Mar/Abr) con adición automática de 15% IVA cuando `appliesVat == true`. Incluye endpoint de ejecución manual.
- `backend/src/services/PdfService.ts`: Generador vectorial en PDF (usando `pdfmake`) del Estado de Cuenta Consolidado institucional de Mayra Castillo con desglose multi-empresa, detalle de cargos/abonos y cuentas de transferencia.
- `backend/src/routes/ledger.ts`:
  - `GET /api/ledger/banks-summary`: Agrupación de ingresos del mes para los 3 bancos y total de cartera vencida.
  - `POST /api/ledger/charge`: Cargo manual libre en dólares.
  - `POST /api/ledger/payment`: Abono con selector obligatorio de `BANCO_PICHINCHA`, `BANCO_DE_LOJA`, `COOPERATIVA_JEP`, `EFECTIVO`, `CRUCE_CUENTAS`.
  - `POST /api/ledger/dev-iva`: Modo Ciego para asistentes (registran lo pedido al SRI sin ver comisiones ni ganancias).
  - `GET /api/ledger/statement-pdf/:clientOwnerId`: Generación y descarga directa del PDF.
- `frontend/src/app/dashboard/page.tsx`: Rediseño completo según la maqueta Fintech:
  - Tarjeta superior con Cartera Total por Cobrar y Recaudación del Mes.
  - **Las 3 Burbujas de Bancos**: Banco Pichincha, Cooperativa JEP (destacado corporativo), Banco de Loja y Efectivo.
  - Modal interactivo de registro rápido de abonos/pagos con recálculo en vivo.
  - Vista operativa alternativa para Asistentes (Modo Ciego 100% libre de dinero).
- `frontend/src/app/clientes/[id]/page.tsx`: Botón directo para descargar el Estado de Cuenta en PDF desde el expediente 360°.

**Validaciones de Calidad:**
- Backend: `tsc` compila sin errores (0 advertencias).
- Frontend: `next build` compiló exitosamente (6 rutas optimizadas).

---

### 🗓️ 2026-11-09 — FASE 5 COMPLETADA

**Bot de WhatsApp (Evolution API), Bandeja de Chats y Cobranza:**

**Archivos creados y actualizados:**
- `backend/src/services/EvolutionApiService.ts`: Conexión directa a Evolution API (`/message/sendText` y `/message/sendMedia`) con soporte para envío de textos y documentos PDF directos desde BunnyCDN.
- `backend/src/services/WhatsAppBotEngine.ts`: Motor de los 5 flujos del bot:
  1. Identificación por número, filtro VIP con alerta a Mayra y exigencia de PIN de 4 dígitos para claves o firmas.
  2. Autoservicio automático de declaraciones y RUC desde la Bóveda Digital (Bunny.net).
  3. Derivación de trámites operativos (facturas, planillas IESS) a la bandeja `OPERATIVA_CHICAS`.
  4. Flujo de venta de firmas electrónicas con solicitud de requisitos y cuentas bancarias.
  5. Detección y registro de compromisos de pago en `PaymentPromise` pausando la insistencia.
- `backend/src/routes/whatsapp.ts`: Webhook receptor oficial `POST /api/whatsapp/webhook`, consulta de chats clasificados por colas (`GET /api/whatsapp/chats`), respuestas humanas (`POST /api/whatsapp/send-reply`) y simulador en vivo (`POST /api/whatsapp/test-message`).
- `backend/src/index.ts`: Montaje de rutas de WhatsApp y emisión en vivo por WebSocket (`io.emit`).
- `frontend/src/app/whatsapp/page.tsx`: Centro de Mensajes estilo WhatsApp Web (3 columnas) con:
  - Selector de bandejas (`Chicas`, `Mayra`, `Cobranza`).
  - Hilo de conversación en vivo con indicador de cliente, bot y agente.
  - Panel lateral con la ficha del cliente, empresas, RUCs y accesos a documentos de la Bóveda.
  - **Simulador Interactivo Superior**: Permite probar los 5 flujos en desarrollo local sin requerir túneles ni exponer el servidor.
- `frontend/src/components/Navbar.tsx`: Enlace añadido a `/whatsapp` con ícono de mensajería.

**Validaciones de Calidad:**
- Backend: Compilación `tsc` sin errores (0 advertencias).
- Frontend: `next build` exitoso (7 rutas optimizadas: `/`, `/_not-found`, `/clientes`, `/clientes/[id]`, `/dashboard`, `/login`, `/whatsapp`).

---

### 📅 2026-11-09 — FASE 6 Y AUDITORÍA FINAL COMPLETADA

**Superintendencia de Compañías, Proyecciones de Renta y Correcciones de Auditoría:**

**Archivos creados y actualizados:**
- `backend/src/services/SuperciasService.ts`: Generador en PDF con `pdfmake` de los 3 documentos anuales obligatorios de la Supercias (*Acta de Junta General Universal*, *Informe del Representante Legal/Gerente*, *Notas a los Estados Financieros*).
- `backend/src/routes/supercias.ts`: Endpoints `POST /api/supercias/generate-pdf` (descarga del paquete de 3 documentos) y `POST /api/supercias/send-renta-projections` (envío masivo semestral por WhatsApp).
- `frontend/src/app/supercias/page.tsx`: Pantalla completa para configurar balance de compañía, generar/descargar PDF y disparar proyecciones de renta por WhatsApp.
- `ecosystem.config.js`: Archivo físico PM2 en la raíz para despliegue en producción con clúster y logs independientes.
- `package.json` (raíz): Configurado con `concurrently` para ejecutar `npm run dev` en una sola consola.
- `backend/src/services/WhatsAppBotEngine.ts`: Incorporado el embudo multi-paso interactivo para la solicitud y venta de **Firma Electrónica** (pregunta Con/Sin RUC, solicita cédula, selfie y comprobante de pago, creando ticket con requisitos listos en `OPERATIVA_CHICAS`).
- `backend/src/services/BillingCron.ts`: 4 Cronjobs activos (Facturación Día 1 a las 00:05, Cobranza masiva WhatsApp Días 1-5 a las 09:00 AM, Recordatorio diario de `PaymentPromise` a las 09:00 AM, y Alerta de expiración de firmas .p12 a las 08:00 AM).
- `backend/src/routes/whatsapp.ts`: Acceso de `ASISTENTE` a `/whatsapp` con restricción estricta en el backend a la cola `OPERATIVA_CHICAS` únicamente; nuevo endpoint `GET /api/whatsapp/tax-alerts` para el Semáforo Tributario y caducidad de firmas.
- `frontend/src/app/whatsapp/page.tsx`: Adaptación de la UI para que rol `ASISTENTE` solo vea la pestaña de "Chicas" y no acceda a colas gerenciales o de cobranza.
- `frontend/src/app/dashboard/page.tsx`: Añadido el panel visual del **Semáforo Tributario del mes** (🟢 Al día, 🟡 Pendiente, 🔴 Vence/Venció), lista de **Firmas por Caducar (≤ 5 días)** y botón funcional **[Disparar Cobranza Mensual WhatsApp]**.
- `frontend/src/app/clientes/page.tsx`: Añadida columna con badges visuales de semáforo en tiempo real para cada contribuyente/empresa.

**Validaciones Finales:**
- Backend: `tsc` compila con 0 errores.
- Frontend: `next build` genera con éxito 9 rutas estáticas y dinámicas optimizadas.

---

### 📅 2026-11-12 — ARQUITECTURA DEL BOT DE WHATSAPP: BLOQUE 1 Y BLOQUE 2 COMPLETADOS

**Blindaje de Base de Datos, Cero Alucinación, Multimedia Real en BunnyCDN, Voz y Cola Anti-Baneo:**

**Bloque 1 (Base de Datos, Sesión SQL y Tools Determinísticas):**
- `BotSession` en MySQL: Eliminado almacenamiento en memoria RAM. Historial de últimos 12 mensajes y estado conversacional persistidos en base de datos.
- Anti-Contaminación de `ClientOwner`: Removida la inserción automática de remitentes desconocidos en el directorio maestro de clientes. Permanecen como tickets con `clientOwnerId = null` hasta aprobación manual.
- Escudo Anti-Eco `fromMe`: Registro de `evolutionMessageId` salientes en `ProcessedWebhookEvent` para evitar que el bot se auto-pause con sus propios mensajes.
- 6 Tools Determinísticas en TypeScript:
  1. `client_lookup`
  2. `check_balance`
  3. `request_credential_or_p12` (con validación de PIN en TypeScript)
  4. `verify_pin` (PIN temporal con expiración de 10 minutos)
  5. `send_tax_document` (envío de PDF desde BunnyCDN)
  6. `escalate_to_human` (clasificación a `GERENCIAL_MAYRA` u `OPERATIVA_CHICAS` y pausa del bot)
- Human-Bot Coexistence: Botones funcionales en `/whatsapp` para pausar bot, reactivar bot y cerrar ticket.

**Bloque 2 (Multimedia, Notas de Voz y Cola Anti-Baneo):**
- Soporte multimedia en `ChatMessage`: Columnas `mediaType`, `mediaUrl`, `mimeType`, `fileName` agregadas al esquema Prisma y sincronizadas con `prisma db push`.
- Desencriptación de archivos de WhatsApp: `MediaIngestionService.ts` implementa la llamada a `POST /chat/getBase64FromMediaMessage/{instance}` evitando descargas inválidas de archivos `.enc`.
- Almacenamiento seguro en BunnyCDN: Subida de archivos binarios a `/whatsapp-media/{phone}/{timestamp}_{fileName}` con fallback local seguro.
- Transcripción de notas de voz: Soporte de transcripción vía Groq Whisper / OpenAI Whisper con fallback tolerante a fallos si no se definen API keys.
- Cola Outbound Persistente `OutboundQueueJob`:
  - `OutboundQueueService.ts` procesa envíos 1 a 1 con intervalos aleatorios de 25 a 55 segundos.
  - Restricción horaria estricta de Ecuador (`America/Guayaquil` de lunes a sábado de 08:30 a 19:00).
  - Integración en `BillingCron.ts` para cobranza masiva, recordatorios de promesas y avisos de firmas .p12 por caducar.
- Interfaz en `/whatsapp`:
  - Renderizado de reproductor nativo `<audio controls>` para notas de voz.
  - Lightbox para imágenes recibidas y tarjeta de descarga de documentos PDF.
  - Badge de monitoreo en tiempo real del estado de la cola anti-baneo con indicador de horario laboral.
- Endpoint `GET /api/whatsapp/queue-status` con autenticación JWT.
- Compilación `tsc` en backend limpia (0 errores) y `next build` en frontend optimizado al 100%.
