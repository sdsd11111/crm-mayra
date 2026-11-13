# 09. ESPECIFICACIÓN ADVERSARIAL DE CIERRE TOTAL (LISTÓN 100/100 — CERO EXCUSAS, CERO PLACEHOLDERS)

> **REGLA SUPREMA DE ESTE DOCUMENTO:**
> Ningún fallo es "marginal" ni "aceptable". Un `78/80` con auto-justificaciones es RECHAZADO por el Árbitro Adversarial. El único listón válido para cerrar el sistema del Estudio Contable Mayra Castillo es **100% PASS verificable en código, base de datos, red HTTP y compilación**, ejecutando el ciclo autónomo:
> **`PLANIFICAR ➔ CONSTRUIR ➔ PROBAR ➔ ARBITRAR (ATACAR) ➔ CORREGIR ➔ REPETIR`** hasta alcanzar **0 fallos**.

---

## 1. VEREDICTO DEL ÁRBITRO ADVERSARIAL SOBRE EL REPORTE `08_REPORTE_EJECUCION_QA_BOT.md`

El Árbitro rechaza las dos excusas del reporte anterior y destapa **6 brechas estructurales adicionales** en el resto del sistema que deben cerrarse en este loop:

### 🔴 Brecha 1: `T69` (Fallo de Máquina de Estados al cancelar trámite en curso)
- **Excusa rechazada:** *"Derivó a atención pero no ejecutó la consulta de saldo en el mismo turno"*.
- **Impacto real en producción:** Si un cliente inicia `FIRMA_STEPS` por curiosidad y luego dice *"Olvídalo, mejor dime cuánto te debo de Dharma"*, derivarlo a humano activa `botPaused = true`, silencia el bot innecesariamente y le carga basura operativa a Mayra.
- **Solución exigida (Sin parches de texto):**
  1. Agregar/actualizar en `botToolsRegistry.ts` la capacidad determinística `cancel_active_flow_and_reset()` (o permitir que cualquier tool de consulta como `get_account_balance_and_banks` o `send_client_document` pueda invocarse en paralelo/secuencia reseteando `BotSession.currentFlow = 'IDLE'` y `flowData = null` sin llamar a `transfer_to_human`).
  2. Regla explícita en el orquestador: cancelar un trámite (`FIRMA_STEPS` o `AWAITING_PIN`) **NO** pausa el bot ni transfiere a humano; limpia `BotSession` a `IDLE` y responde la nueva pregunta ejecutando la tool correspondiente en ese mismo turno.

### 🔴 Brecha 2: `T75` (Cuello de Botella `N+1` en Encolado Masivo SQL)
- **Excusa rechazada:** *"4,894 ms por latencia de StackCP en EE.UU. con 50 INSERT individuales"*.
- **Impacto real en producción:** Con 200 clientes morosos y generación de PDFs, 200 `INSERT` secuenciales/individuales agotarán el pool de conexiones de Prisma en StackCP (`Too many connections`) o causarán timeout HTTP en el botón `[Disparar Cobranza]`.
- **Solución exigida:** Usar inserción por lote atómica `prisma.outboundQueueJob.createMany({ data: jobsBatch })` reduciendo los 50 registros de `4,894 ms` a **`< 400 ms` reales** contra StackCP.

### 🔴 Brecha 3: Exposición Pública de Archivos Sensibles (`.p12`, Claves y Declaraciones) en BunnyCDN
- **Riesgo Crítico (Trauma real de hackeo de Mayra):** En el informe inicial se documentó que `Document.bunnyUrl` devuelve URLs públicas directas `https://mvps.b-cdn.net/...`. Si un link de una firma `.p12` se filtra o se indexa, cualquiera descarga el certificado bancario/tributario sin autenticación.
- **Solución exigida:**
  1. Crear el endpoint protegido **`GET /api/documents/:id/download`** en el backend:
     - Exige JWT válido (`authMiddleware`).
     - Si el documento es `FIRMA_ELECTRONICA_P12` y quien descarga o consulta detalles de claves sensibles necesita permisos válidos, valida acceso y transmite el archivo vía stream/buffer desde Bunny Storage (o genera URL firmada temporal SHA256 si Bunny Token Auth está activo), registrando quién lo descargó.
  2. En el Frontend (`/clientes/[id]`), los botones `[Descargar / Ver]` deben consumir el endpoint autenticado del backend en lugar de exponer rutas crudas predecibles en el HTML público.

### 🔴 Brecha 4: Auditoría Adversarial del Modo Ciego (`ASISTENTE`) en TODA la API REST
- **Riesgo:** No basta con ocultar la pestaña "Contabilidad" en React. Si `sofia` (`ASISTENTE`) abre DevTools (F12 -> Network) o llama por Postman a:
  - `GET /api/clients` o `GET /api/clients/:id`
  - `GET /api/ledger/banks-summary`, `GET /api/ledger/top-debtors`, `GET /api/ledger/statement-pdf/:id`
  - `POST /api/ledger/charge` o `POST /api/ledger/payment`
  - `GET /api/whatsapp/chats` (intentando forzar `?queue=GERENCIAL_MAYRA` o `?queue=COBRANZA`)
- **Solución exigida:**
  - Todas las rutas financieras de `/api/ledger/*` (excepto `POST /api/ledger/dev-iva` en modo ciego que **NO debe devolver `commissionPct` ni `commissionTotal` en el JSON de respuesta** cuando el rol es `ASISTENTE`) deben responder **`403 Forbidden`** para `ASISTENTE`.
  - En `GET /api/clients` y `GET /api/clients/:id`, si `req.user.role === 'ASISTENTE'`, el serializador del backend debe **eliminar físicamente del objeto JSON** (`delete` / `omit`) los campos: `autoBillFreq`, `autoBillAmount`, `appliesVat`, `devIvaPercent`, `ledgerEntries`, `balance`, `totalDebt`. **0 bytes financieros en el cable.**

### 🔴 Brecha 5: Tabla Fija de Mayra, Multi-Empresa y PDF Consolidado Real
- **Solución exigida sin prototipos:**
  1. `/clientes` y `/clientes/[id]` deben soportar y mostrar sin faltantes las columnas reales del sistema de Mayra: `Dueño/Pagador`, `Razón Social`, `RUC`, `Fecha/9no dígito` (autocalculado al tipear el RUC en el formulario), `Régimen`, `Email`, todas las claves (`SRI, Firma + fecha expiración, IESS, SUT, Salario, Supercias + Expediente, Sercop`) con copiado en 1 clic, y los 8 checks (`DECLA, ICE, ANEXO, IVA, SALAR, SUT, IESS, SUPERCIAS/PATENTE`).
  2. El PDF de Estado de Cuenta (`PdfService.ts`) para un `ClientOwner` con múltiples empresas (ej. *Pedro Rojas -> Dharma + Tulp Farma*) debe desglosar cargos agrupados con **Subtotal por cada Razón Social**, listar los **Abonos/Descuentos realizados** con su fecha/banco, y mostrar el **Saldo Total Neto a Pagar** exacto al centavo (`Decimal`), incluyendo pie institucional con las 3 cuentas de pago de Mayra.

### 🔴 Brecha 6: Monorepo de 1 Sola Terminal y Cero Placeholders en Código
- **Solución exigida:**
  1. Verificar existencia física y funcionamiento real de `/package.json` en la raíz con `concurrently` (`npm run dev`, `npm run build`, `npm run qa:all`) y `/ecosystem.config.js` para PM2.
  2. Escaneo estático anti-placeholders en `backend/src` y `frontend/src`: **0 `TODO`, 0 `FIXME`, 0 mocks hardcodeados en rutas de producción, 0 botones muertos sin `onClick` real.**

---

## 2. MATRIZ DE 25 PRUEBAS E2E DEL SISTEMA COMPLETO (`S01` – `S25`)
*(Complementa las 80 pruebas del Bot `T01–T80` para llegar a **105 pruebas automatizadas totales**)*

| ID | Módulo Auditado | Prueba Adversarial de Sistema (API + DB + Reglas) | Criterio Estricto de PASS |
|:---:|:---|:---|:---|
| **S01** | Auth Simple | Login con `username: "mayra"` (sin email) devuelve JWT válido con `role: "ADMIN_MAYRA"`. | `200 OK` + JWT válido. |
| **S02** | Auth Seguridad | Login con password erróneo o usuario inexistente rechaza con `401` sin filtrar si existe el usuario. | `401 Unauthorized`. |
| **S03** | Modo Ciego API | `sofia` (`ASISTENTE`) hace `GET /api/clients` y `GET /api/clients/:id`: inspección recursiva del JSON confirma **0 claves financieras** (`autoBillAmount`, `devIvaPercent`, `ledgerEntries`, `balance`). | JSON 100% limpio de `$`. |
| **S04** | Modo Ciego Bloqueo | `sofia` (`ASISTENTE`) intenta `GET /api/ledger/banks-summary` y `GET /api/ledger/top-debtors`. | `403 Forbidden` en ambos. |
| **S05** | Modo Ciego Bloqueo | `sofia` (`ASISTENTE`) intenta `GET /api/ledger/statement-pdf/:id` y `POST /api/ledger/charge`. | `403 Forbidden` en ambos. |
| **S06** | Modo Ciego 3ra Edad | `sofia` (`ASISTENTE`) envía `POST /api/ledger/dev-iva` con `requestedAmount: 138` en cliente con `8%`: la respuesta HTTP a `sofia` **NO contiene `$11.04` ni `8%`**, pero en MySQL sí se creó el `LedgerEntry` de `+$11.04` para Mayra. | Cálculo exacto + respuesta ciega. |
| **S07** | SRI 9no Dígito | Crear `Taxpayer` con RUC `1191797243001` autocalcula `novenoDigito = 4` y vencimiento día `16`. (Probar todos los dígitos `1..9` y `0 -> 28`). | 10/10 dígitos exactos SRI Ecuador. |
| **S08** | Multi-Empresa | Crear 1 `ClientOwner` con 3 `Taxpayer` hijos mantiene integridad relacional y permite editar claves/checks independientes por cada RUC. | 3 empresas aisladas bajo 1 pagador. |
| **S09** | Precisión Decimal | Cargos con centavos complejos (`$138.43 * 10%`, IVA `15%` sobre `$55.00 = $63.25`, abonos `$396.54`) suman al centavo exacto sin errores de punto flotante (`0.000000002`). | Exactitud matemática a 2 decimales. |
| **S10** | Los 4 Receptores | Abonos a `BANCO_PICHINCHA`, `BANCO_DE_LOJA`, `COOPERATIVA_JEP` y `EFECTIVO` cuadran exactamente en `GET /api/ledger/banks-summary` del mes actual. | Cuadre contable exacto. |
| **S11** | Cruce / Descuento | Registrar `DESCUENTO_CRUCE` (ej. arriendo `$100` o factura anulada por error `$2`) reduce la cartera del cliente **sin** inflar falsamente el dinero entrante en los bancos. | Cartera baja, bancos no se inflan. |
| **S12** | Top Deudores | `GET /api/ledger/top-debtors` devuelve orden descendente exacto excluyendo clientes con saldo `<= 0`. | Orden y montos reales verificados. |
| **S13** | BillingCron IVA 15% | Ejecutar lógica de `BillingCron` en empresa `MENSUAL` con `autoBillAmount = 50` y `appliesVat = true` genera cargo exacto de **`$57.50`** y evita duplicar el cobro si el cron corre 2 veces el mismo mes. | Idempotencia mensual + IVA exacto. |
| **S14** | BillingCron Semestral | Empresa `SEMESTRAL` solo genera cargo en Enero (1) y Julio (7), ignorando otros meses. | 0 cargos fuera de Ene/Jul. |
| **S15** | PDF Consolidado | `PdfService` para dueño con 2 empresas genera buffer `%PDF-1.` válido `> 2KB` que incluye ambas razones sociales, abonos y saldo neto consolidado. | PDF binario válido y completo. |
| **S16** | Bóveda Segura | `GET /api/documents/:id/download` sin token JWT devuelve `401`; con token válido entrega el archivo correctamente. | Cero acceso anónimo a documentos. |
| **S17** | Semáforo Tributario | `Taxpayer` cuyo 9no dígito vence mañana sin `Document` del mes actual sale `ROJO` en `/api/clients/tax-alerts`; apenas se sube `DECLARACION_IVA` de este mes, cambia inmediatamente a `VERDE`. | Transición `ROJO ➔ VERDE` en vivo. |
| **S18** | Alerta Firma `.p12` | `Taxpayer` con `firmaExpira = hoy + 4 días` aparece en alertas de caducidad del Dashboard; si es `hoy + 30 días` no contamina alertas urgentes. | Filtro de ventana `<= 5 días` exacto. |
| **S19** | Promesas Hoy | `GET /api/ledger/promises-today` lista promesas `PENDIENTE` vencidas o de hoy y deja de mostrarlas al marcarse `CUMPLIDA`. | Ciclo de vida de promesa completo. |
| **S20** | Supercias Legal | `POST /api/supercias/generate-pdf` con saldos contables genera documento PDF válido sin texto `Lorem ipsum` ni `TODO`, bloqueado para `ASISTENTE` (`403`). | PDF legal limpio + guard de rol. |
| **S21** | Bypass Cola WhatsApp | `sofia` (`ASISTENTE`) fuerza `GET /api/whatsapp/chats?queue=GERENCIAL_MAYRA` -> Backend ignora el query param malicioso y fuerza `OPERATIVA_CHICAS`. | Anti-tampering de query params OK. |
| **S22** | Testigo Digital Hoy | Contador de actividad del día refleja exactamente cuántos documentos subieron las asistentes hoy. | Conteo exacto `createdAt >= hoy`. |
| **S23** | Escaneo Anti-Placeholder | Escaneo automatizado del árbol `backend/src` y `frontend/src` buscando `TODO`, `FIXME`, `placeholder` de lógica falsa o endpoints vacíos. | 0 hallazgos prohibidos. |
| **S24** | Monorepo Raíz | Verificación física y sintáctica de `/package.json` (`concurrently`) y `/ecosystem.config.js` en la raíz del proyecto. | Archivos válidos y operativos. |
| **S25** | Compilación Producción | `npm run build` compila tanto `backend` (`tsc`) como `frontend` (`next build`) con **0 errores y 0 rutas rotas**. | Build de producción 100% limpio. |
