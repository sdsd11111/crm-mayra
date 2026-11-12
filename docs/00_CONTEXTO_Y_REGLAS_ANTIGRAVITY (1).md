# 00. CONTEXTO MAESTRO Y REGLAS PARA ANTIGRAVITY (CRM + BOT MAYRA CASTILLO)

> **INSTRUCCIÓN OBLIGATORIA PARA EL AGENTE (ANTIGRAVITY):**
> Lee este archivo antes de ejecutar cualquier tarea. Cada vez que completes una subtarea o fase descrita en `05_ROADMAP_Y_BITACORA.md`, **debes actualizar el estado de la casilla `[ ]` a `[x]`** y documentar cualquier decisión técnica o endpoint creado en ese mismo archivo.

---

## 1. Resumen del Proyecto
Sistema integral **CRM Contable + Bóveda Digital + Motor de Cartera + Bot de WhatsApp (Evolution API)** diseñado a medida para el **Estudio Contable Mayra Castillo** (Loja, Ecuador).

### Problemas Reales que Resuelve:
1. **Descentralización Operativa:** Mayra recibe todas las solicitudes por su WhatsApp personal y pierde medio día redireccionando tareas a sus asistentes ("las chicas"). El nuevo sistema enruta tareas operativas directamente a las asistentes.
2. **Bóveda Digital Propia (Independencia del SRI y Supercias):** Las páginas gubernamentales suelen caerse cuando un cliente pide documentos urgentes (declaraciones de IVA, Renta, RUC, nombramientos). Todo trabajo realizado se guarda en **Bunny.net Storage** y el bot lo envía automáticamente cuando el cliente lo solicita.
3. **Motor de Cobranza Automática y Cuenta Corriente ("Bolsa de Deuda"):** Mayra tiene más de $20,000 en cartera vencida. El sistema automatiza los cargos periódicos (Cronjob mensual, semestral, anual), registra comisiones por porcentaje (10% u 8% en Devolución de IVA de Tercera Edad), permite registrar cargos/abonos manuales clasificados por banco (**Banco Pichincha, Banco de Loja, Cooperativa JEP, Efectivo**) y envía estados de cuenta en PDF del **1 al 5 de cada mes**.
4. **Ceguera Financiera para Asistentes (Seguridad de Roles):** Las asistentes ("las chicas") **NO pueden ver precios, honorarios, carteras vencidas ni saldos bancarios**. Solo ven datos tributarios, claves, vencimientos, archivos y tickets operativos.

---

## 2. Stack Tecnológico Oficial (Innegociable)
- **Entorno:** VPS Linux (Dockerizado o PM2).
- **Lenguaje Único:** TypeScript (tanto Backend como Frontend). **NO usar Python.**
- **Backend (`/backend`):** **Node.js + Express + TypeScript + Prisma + Socket.io + node-cron** (Corriendo en puerto `4000` como proceso dedicado 24/7 para no perder WebSockets ni Cronjobs cuando se recompile el Frontend).
- **ORM y Base de Datos:** Prisma ORM + MySQL (o PostgreSQL). Todos los valores monetarios deben usar `Decimal(10, 2)` (jamás `Float`).
- **Almacenamiento de Archivos (Bóveda):** Bunny.net Storage API (con URLs privadas o servidas vía proxy del backend para proteger archivos `.p12`, RUCs y declaraciones).
- **Motor de WhatsApp:** Evolution API + OpenAI/Gemini Function Calling (Tools) para consultar la base de datos y enviar PDFs.
- **Generación de PDFs:** `pdfmake` o `@react-pdf/renderer` para Estados de Cuenta e Informes de Superintendencia.
- **Frontend (`/frontend`):** **Next.js (App Router) + React + TypeScript + TailwindCSS + Lucide Icons** (Corriendo en puerto `3000`).

---

## 3. REGLA ESTRICTA DE AUTENTICACIÓN (LOGIN SIMPLE)
- **PROHIBIDO usar correos electrónicos (`email`), OAuth, Magic Links, verificación en 2 pasos o sistemas complejos para el Login del personal.**
- El inicio de sesión al CRM se hace **EXCLUSIVAMENTE con `username` (nombre de usuario corto, ej. `mayra`, `chica1`, `chica2`, `esposo`) y `password`**.
- Autenticación directa mediante JWT (`jsonwebtoken`) + `bcrypt` guardando la sesión en `localStorage` o cookie `httpOnly`.
- Solo existen **3 Roles en el sistema**:
  1. `ADMIN_MAYRA` (Acceso total: Finanzas, 3 Bancos, Cartera, Precios, Clientes, Archivos, Chats).
  2. `ASISTENTE` (Acceso limitado: Directorio de Clientes sin precios, Claves, Subida de Archivos, Monto Solicitado en Devolución IVA sin ver comisión, Bandeja Operativa de WhatsApp).
  3. `COBRADOR` (Acceso para el esposo de Mayra: Lista de morosos, Estados de cuenta PDF, promesas de pago y registro de llamadas/abonos).

---

## 4. Estructura de la Documentación Modular
1. `00_CONTEXTO_Y_REGLAS_ANTIGRAVITY.md` -> Este documento (Reglas globales, Stack y Login).
2. `01_BASE_DE_DATOS_Y_PRISMA.md` -> Esquema exacto `schema.prisma`, relación Dueño -> Empresas, Tabla Fija de Clientes y Bolsa Contable.
3. `02_LOGICA_CONTABLE_Y_CARTERA.md` -> Cómo funcionan los precios manuales, el Cron de aumentos automáticos, el % de Tercera Edad, los 3 bancos y la ceguera de precios para las chicas.
4. `03_FRONTEND_UI_UX_Y_PANTALLAS.md` -> Paleta de colores oficial (`#1E80C1` y `#1E2A3C`), estilo Glassmorphism/Fintech y especificación de las 4 pantallas.
5. `04_BOT_WHATSAPP_EVOLUTION_API.md` -> Flujos del Bot, seguridad por PIN de 4 dígitos, autoservicio de PDFs desde Bunny.net, embudo de Firmas Electrónicas y Cobranza (días 1-5).
6. `05_ROADMAP_Y_BITACORA.md` -> Orden exacto de programación (Fase 1 a Fase 6) y checklist vivo que Antigravity debe ir marcando.
