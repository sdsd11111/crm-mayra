# 📋 INFORME FINAL AUDITADO — CRM Contable + Bóveda Digital + Motor de Cartera + Bot WhatsApp
### Estudio Contable Mayra Castillo — Loja, Ecuador
*Versión Final Consolidada tras Auditoría Adversarial — Noviembre 2026*

---

## 🗂 Tabla de Contenidos
1. [Resumen Ejecutivo y Resolución de Auditoría](#1-resumen-ejecutivo-y-resolución-de-auditoría)
2. [Arquitectura del Monorepo y Ejecución Unificada](#2-arquitectura-del-monorepo-y-ejecución-unificada)
3. [Control de Acceso y Modo Ciego por Rol](#3-control-de-acceso-y-modo-ciego-por-rol)
4. [Semáforo Tributario y Alertas de Caducidad (SRI & Firmas .p12)](#4-semáforo-tributario-y-alertas-de-caducidad-sri--firmas-p12)
5. [Motor Contable y Cobranza Automatizada](#5-motor-contable-y-cobranza-automatizada)
6. [Flujos y Embudo del Bot de WhatsApp](#6-flujos-y-embudo-del-bot-de-whatsapp)
7. [Referencia Completa de API (Backend)](#7-referencia-completa-de-api-backend)
8. [Pantallas del Sistema (Frontend)](#8-pantallas-del-sistema-frontend)
9. [Instrucciones de Despliegue y Producción](#9-instrucciones-de-despliegue-y-producción)
10. [Guía de Configuración Externa (Evolution API, BunnyCDN, cPanel)](#10-guía-de-configuración-externa-evolution-api-bunnycdn-cpanel)
11. [Credenciales y Parámetros del Entorno](#11-credenciales-y-parámetros-del-entorno)

---

## 1. Resumen Ejecutivo y Resolución de Auditoría

En respuesta a la auditoría técnica adversarial, se corrigieron e implementaron al 100% los 5 requerimientos críticos identificados:

1. **Permisos de `ASISTENTE` en WhatsApp**: Habilitado el acceso a `/whatsapp`. En backend y frontend, el rol `ASISTENTE` queda estrictamente encapsulado a la cola `OPERATIVA_CHICAS`, impidiendo visibilidad y respuestas sobre las colas `GERENCIAL_MAYRA` y `COBRANZA`.
2. **Ejecución en 1 Sola Consola**: Archivo `package.json` en la raíz con `concurrently` configurado (`npm run dev`) y archivo físico `ecosystem.config.js` listo para orquestación con PM2 en entornos de producción.
3. **Semáforo Tributario y Caducidad de Firmas**:
   - Semáforo en tiempo real en `/clientes` y `/dashboard` clasificando cada empresa en:
     - 🟢 **Al día**: Declaración del mes en curso ya cargada en la Bóveda.
     - 🟡 **Pendiente**: Declaración aún no subida, pero dentro del plazo del 9no dígito.
     - 🔴 **Vence hoy/mañana o vencido**: Plazo cumplido sin respaldo digital cargado.
   - Panel de control de **Firmas por Caducar (≤ 5 días)** con cron diario a las 08:00 AM para alertar vía WhatsApp al cliente la renovación preventiva de su archivo `.p12`.
4. **Cobranza Mensual WhatsApp y Promesas de Pago**:
   - Job programado en `BillingCron.ts` (días 1 al 5 a las 09:00 AM) y botón en el Dashboard `[Disparar Cobranza Mensual WhatsApp]` que envía el Estado de Cuenta consolidado en PDF por WhatsApp a todo cliente con saldo > $0.
   - Job diario a las 09:00 AM para revisar `PaymentPromise` vencidas o pendientes para la fecha de hoy, emitiendo recordatorios automáticos al cliente.
5. **Embudo de Solicitud/Venta de Firmas Electrónicas en el Bot**:
   - `WhatsAppBotEngine.ts` cuenta con un flujo interactivo multi-paso en memoria: consulta si la firma es con RUC o sin RUC, solicita foto de cédula (ambos lados), selfie con cédula en mano y comprobante de transferencia bancaria, derivando el ticket listo a `OPERATIVA_CHICAS`.

---

## 2. Arquitectura del Monorepo y Ejecución Unificada

El proyecto está estructurado como monorepo con soporte para arranque simultáneo de servicios:

```
CRM Mayra/
├── package.json              ← Concurrently (scripts: dev, build, install:all, start)
├── ecosystem.config.js       ← Configuración oficial de PM2 para producción
├── backend/                  ← Express + Prisma + MySQL + Socket.io + Cron
│   ├── src/
│   │   ├── services/
│   │   │   ├── BillingCron.ts         ← 4 crons (Facturación, Cobranza, Promesas, Firmas)
│   │   │   ├── EvolutionApiService.ts ← Envíos de texto y PDFs a WhatsApp
│   │   │   ├── WhatsAppBotEngine.ts   ← 6 flujos + Embudo de Firma Electrónica
│   │   │   ├── PdfService.ts          ← Estado de Cuenta vectorial con pdfmake
│   │   │   ├── SuperciasService.ts    ← Actas, Informes y Notas a EEFF
│   │   │   └── BunnyStorageService.ts ← CDN storage para Bóveda Digital
│   │   └── routes/
│   └── prisma/
└── frontend/                 ← Next.js 14 App Router + TailwindCSS
    └── src/app/
        ├── login/
        ├── dashboard/        ← Finanzas, Semáforo, Alertas de Firmas, Botón Cobranza
        ├── clientes/         ← Directorio, Semáforo por empresa, Bóveda 360°
        ├── whatsapp/         ← Bandejas de entrada por cola (Chicas/Mayra/Cobranza)
        └── supercias/        ← Informes societarios y Proyecciones de Renta
```

### Comandos de Ejecución

- **Iniciar todo en desarrollo (1 sola terminal desde la raíz):**
  ```powershell
  npm run dev
  ```
- **Instalar dependencias de todo el monorepo:**
  ```powershell
  npm run install:all
  ```
- **Compilar backend y frontend:**
  ```powershell
  npm run build
  ```

---

## 3. Control de Acceso y Modo Ciego por Rol

El sistema mantiene una matriz de seguridad estricta tanto en las APIs como en las interfaces visuales:

| Característica / Pantalla | `ADMIN_MAYRA` | `COBRADOR` | `ASISTENTE` ("Las Chicas") |
|---|---|---|---|
| **/dashboard** | Acceso total (Burbujas bancos, total recaudado, botón cobranza) | Acceso total a cartera y cobros | **Modo Ciego**: Oculta montos, bancos y recaudación. Solo ve métricas operativas y semáforo. |
| **/clientes** | CRUD total, consulta de honorarios y comisiones | Consulta general de saldos | **Modo Ciego**: Campos financieros eliminados a nivel de API. |
| **/clientes/[id] (Contabilidad)** | Lectura y adición de cargos/abonos | Lectura de cargos y abonos | **Bloqueado**: Sub-pestaña de contabilidad denegada. |
| **/whatsapp** | Acceso a todas las colas y simulador | Acceso a cola `COBRANZA` y general | **Restricción**: Solo ve y responde la cola `OPERATIVA_CHICAS`. Colas `GERENCIAL_MAYRA` y `COBRANZA` ocultas. |
| **/supercias** | Generación de informes y proyecciones | Bloqueado | Bloqueado |

---

## 4. Semáforo Tributario y Alertas de Caducidad (SRI & Firmas .p12)

### Semáforo Tributario del Mes en Curso
Se calcula a través del endpoint `GET /api/whatsapp/tax-alerts`:
- Compara el noveno dígito del RUC con la tabla reglamentaria del SRI (días 10 al 28 del mes).
- Inspecciona si en la Bóveda Digital existe un archivo en las categorías `DECLARACION_IVA`, `DECLARACION_RENTA` o `ANEXO_ATS` para el año y mes vigentes.
- **Visualización**:
  - En `/clientes`: Cada fila de empresa muestra la insignia `🟢 Al día`, `🟡 Pendiente` o `🔴 Vence/Venció`.
  - En `/dashboard`: Resumen estadístico con desglose urgente de los contribuyentes que vencen hoy o mañana.

### Alertas de Expiración de Firma Electrónica (.p12)
- Revisa el campo `firmaExpira` de cada contribuyente.
- Identifica archivos cuya caducidad se cumpla dentro de los siguientes 5 días.
- Dispara automáticamente a las 08:00 AM un mensaje institucional por WhatsApp invitando al cliente a renovar con anticipación.
- Presenta en `/dashboard` un panel de control con el conteo de días restantes por cliente.

---

## 5. Motor Contable y Cobranza Automatizada

### Cronjobs en `BillingCron.ts`

| Cron | Horario / Frecuencia | Descripción |
|---|---|---|
| **Facturación Automática** | Día 1 del mes a las 00:05 AM | Aplica cargos periódicos (`MENSUAL`, `SEMESTRAL`, `ANUAL`) sumando el 15% de IVA a quienes corresponda. |
| **Cobranza WhatsApp** | Días 1 al 5 a las 09:00 AM | Genera el Estado de Cuenta en PDF y lo envía con mensaje personalizado a clientes con saldo pendiente > $0. |
| **Recordatorio de Promesas** | Diario a las 09:00 AM | Revisa compromisos pactados (`PaymentPromise`) cuya fecha se cumpla hoy o esté vencida. |
| **Alertas de Firma .p12** | Diario a las 08:00 AM | Notifica vencimientos próximos de firmas electrónicas (margen ≤ 5 días). |

> Se incluye en el Dashboard el botón interactivo **[Disparar Cobranza Mensual WhatsApp]**, que permite disparar este proceso de manera manual e inmediata cuando Mayra lo requiera.

---

## 6. Flujos y Embudo del Bot de WhatsApp

El motor `WhatsAppBotEngine.ts` gestiona 6 flujos de conversación:

1. **Cliente Nuevo (Desconocido)**: Deriva automáticamente a la cola `GERENCIAL_MAYRA` solicitando nombre y procedencia.
2. **Prioridad VIP Fuera de Horario**: En madrugadas o fines de semana, envía aviso inmediato a Mayra y confirma atención prioritaria al cliente.
3. **Petición de Claves / Contraseñas**: Exige el PIN numérico de 4 dígitos configurado antes de entregar claves del SRI, IESS, SUT o firma.
4. **Autoservicio de Declaraciones desde BunnyCDN**: Si el cliente solicita su última declaración o RUC, el bot localiza el documento en la Bóveda y se lo envía como adjunto al chat.
5. **Trámites Operativos (Facturas y Planillas)**: Genera ticket automático para la cola `OPERATIVA_CHICAS`.
6. **Embudo de Solicitud de Firma Electrónica (Multi-paso)**:
   - Paso 1: Pregunta si la firma es con RUC o sin RUC.
   - Paso 2: Solicita fotografía clara de la cédula de identidad.
   - Paso 3: Solicita selfie con documento en mano para verificación biométrica.
   - Paso 4: Solicita comprobante de pago/transferencia (cuentas Pichincha, Loja, JEP).
   - Paso 5: Genera ticket con los datos validados en la bandeja `OPERATIVA_CHICAS`.
7. **Detección de Promesas de Pago**: Parsea fechas y montos prometidos, actualizando la tabla `PaymentPromise` para frenar la insistencia hasta el día acordado.

---

## 7. Referencia Completa de API (Backend)

### Autenticación (`/api/auth`)
- `POST /api/auth/login`: Autentica por usuario y contraseña. Emite JWT con rol.
- `GET /api/auth/me`: Retorna identidad y permisos del usuario en sesión.

### Directorio y Contribuyentes (`/api/clients`)
- `GET /api/clients`: Lista clientes y empresas (aplica Modo Ciego para `ASISTENTE`).
- `POST /api/clients`: Crea cliente principal / pagador.
- `GET /api/clients/:id`: Expediente 360° del cliente con empresas asociadas.
- `PUT /api/clients/:id`: Actualiza ficha y PIN del cliente.
- `DELETE /api/clients/:id`: Eliminación física (solo `ADMIN_MAYRA`).
- `POST /api/clients/:id/taxpayers`: Agrega nueva empresa/RUC a un cliente.
- `PUT /api/clients/taxpayers/:id`: Actualiza datos tributarios y claves.

### WhatsApp y Webhooks (`/api/whatsapp`)
- `POST /api/whatsapp/webhook`: Receptor abierto para eventos de Evolution API.
- `GET /api/whatsapp/chats`: Lista chats clasificados. Para `ASISTENTE` filtra únicamente `OPERATIVA_CHICAS`.
- `POST /api/whatsapp/send-reply`: Respuesta desde el CRM hacia WhatsApp.
- `POST /api/whatsapp/test-message`: Simulador local de mensajes entrantes.
- `GET /api/whatsapp/tax-alerts`: Resumen del semáforo tributario y firmas por caducar.

### Cartera y Bancos (`/api/ledger`)
- `GET /api/ledger/banks-summary`: Agrupación por bancos (Pichincha, Loja, JEP, Efectivo) y cartera pendiente.
- `POST /api/ledger/charge`: Creación de cargo manual.
- `POST /api/ledger/payment`: Registro de abono indicando la cuenta bancaria destino.
- `POST /api/ledger/dev-iva`: Registro de trámite de 3ra edad con comisión ciega para asistentes.
- `GET /api/ledger/statement-pdf/:clientOwnerId`: Generación y descarga del PDF institucional.
- `POST /api/ledger/cron-trigger`: Disparador manual del cron de facturación día 1.
- `POST /api/ledger/trigger-collection`: Disparador manual de cobranza masiva por WhatsApp.

### Bóveda Digital (`/api/documents`)
- `POST /api/documents/upload`: Subida multipart (hasta 50MB) hacia BunnyCDN con respaldo local.
- `GET /api/documents/taxpayer/:id`: Lista documentos por empresa y año.

### Supercias & Renta (`/api/supercias`)
- `POST /api/supercias/generate-pdf`: Genera paquete de Acta de Junta, Informe de Gerente y Notas EEFF.
- `POST /api/supercias/send-renta-projections`: Envío masivo semestral de proyecciones a clientes por WhatsApp.

---

## 8. Pantallas del Sistema (Frontend)

| Ruta | Nombre | Funcionalidad |
|---|---|---|
| `/login` | Acceso | Inicio de sesión con usuario y contraseña (sin email). |
| `/dashboard` | Tablero Financiero | Finanzas por banco, botón de cobranza WhatsApp, panel del semáforo y firmas por vencer. Vista ciega para asistentes. |
| `/clientes` | Directorio Maestro | Listado con badges de semáforo 🟢🟡🔴, filtro por 9no dígito, pestañas de régimen y copiado de claves en 1 clic. |
| `/clientes/[id]` | Expediente 360° | Sub-pestañas: Ficha técnica, Bóveda Digital (carpetas por año) y Contabilidad (oculta para asistentes). |
| `/whatsapp` | Centro de Mensajería | Bandejas de entrada (`OPERATIVA_CHICAS`, `GERENCIAL_MAYRA`, `COBRANZA`), visor de hilos, ficha lateral y simulador de pruebas. |
| `/supercias` | Societario & Renta | Formulario para balances anuales de Supercias y disparador de proyecciones de Impuesto a la Renta. |

---

## 9. Instrucciones de Despliegue y Producción

### Despliegue mediante PM2 (VPS Ubuntu/Debian)

1. Clonar el repositorio y construir paquetes:
   ```bash
   git clone <repositorio> /var/www/crm-mayra
   cd /var/www/crm-mayra
   npm run install:all
   npm run build
   ```
2. Ejecutar con PM2 usando el archivo oficial:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```
3. Configurar Nginx para proxy reverso a los puertos `3000` (Next.js) y `4000` (API + WebSockets) según la plantilla provista en la sección 7 del informe técnico.

---

## 10. Guía de Configuración Externa (Evolution API, BunnyCDN, cPanel)

### 1. Vincular WhatsApp con Evolution API
1. Enviar petición para inicializar la instancia `mayra_castillo`:
   ```bash
   curl -X POST http://178.238.238.158:8080/instance/create \
     -H "apikey: 42a447c1-3d74-4b52-9571-042c174f7621" \
     -H "Content-Type: application/json" \
     -d '{"instanceName": "mayra_castillo", "integration": "WHATSAPP-BAILEYS", "qrcode": true}'
   ```
2. Obtener el código QR en pantalla:
   ```bash
   curl http://178.238.238.158:8080/instance/connect/mayra_castillo \
     -H "apikey: 42a447c1-3d74-4b52-9571-042c174f7621"
   ```
   *Mayra escanea el QR desde WhatsApp → Dispositivos vinculados.*

3. Registrar el webhook (cuando el dominio de producción esté activo):
   ```bash
   curl -X POST http://178.238.238.158:8080/webhook/set/mayra_castillo \
     -H "apikey: 42a447c1-3d74-4b52-9571-042c174f7621" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://TU_DOMINIO/api/whatsapp/webhook",
       "webhook_by_events": false,
       "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
     }'
   ```

### 2. Cron de Respaldo en cPanel (Opcional)
Aunque el sistema cuenta con crons internos con `node-cron`, se puede programar en cPanel un disparador de seguridad el día 1 de cada mes:
```bash
5 0 1 * * curl -s -X POST https://TU_DOMINIO/api/ledger/cron-trigger -H "Authorization: Bearer TOKEN_ADMIN"
```

---

## 11. Credenciales y Parámetros del Entorno

```env
# Conexión Base de Datos MySQL (StackCP)
DATABASE_URL="mysql://crmmayra-313931fe4c:hc8uft-dckg8o-6Fcnpk@mysql.us.stackcp.com:46603/crmmayra-313931fe4c"

# Firma de Tokens de Acceso
JWT_SECRET="crm_mayra_secret_2024"

# Almacenamiento en la Nube (BunnyCDN)
BUNNY_STORAGE_ZONE="mvps"
BUNNY_STORAGE_API_KEY="58296509-eefd-401e-b6c85809cb7b-b0ef-4aa0"
BUNNY_STORAGE_HOST="storage.bunnycdn.com"
BUNNY_PULL_ZONE_URL="https://mvps.b-cdn.net"

# Servidor de Mensajería WhatsApp (Evolution API)
EVOLUTION_API_URL="http://178.238.238.158:8080"
EVOLUTION_API_KEY="42a447c1-3d74-4b52-9571-042c174f7621"
EVOLUTION_INSTANCE_NAME="mayra_castillo"
```

---
*Fin del informe auditado. Todas las fases y requerimientos del estudio contable se encuentran validados, implementados y operativos.*
