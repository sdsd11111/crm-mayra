---
trigger: always_on
---

# Arquitectura Backend — CRM Mayra Castillo

## Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Express 4.x
- **ORM:** Prisma (cliente singleton en `lib/prisma.ts`)
- **Real-time:** Socket.io (instancia exportada desde `index.ts`)
- **Crons:** node-cron (inicializados en `BillingCron.init()`)
- **APIs externas:** Evolution API (WhatsApp), DeepSeek AI, Bunny.net CDN, Superintendencia de Compañías

## Mapa de capas (respetar siempre)

| Carpeta | Responsabilidad | Qué NO poner aquí |
|---|---|---|
| `routes/` | Validación HTTP, control de acceso por rol, respuesta JSON. Delega a servicios. | Lógica de negocio, queries complejas de Prisma, cálculos. |
| `services/` | Lógica de negocio, orquestación de APIs externas, crons. Clases estáticas. | Objetos `req`/`res` de Express; no importar Express aquí. |
| `utils/` | Funciones puras reutilizables sin side-effects. | Acceso a BD, llamadas HTTP, estado mutable. |
| `lib/` | Clientes singleton (Prisma, etc). | Lógica de negocio. |
| `middleware/` | Auth JWT, guards de rol, rate limiting. | Lógica de dominio. |
| `types/` | Interfaces, type declarations, augmentations de Express. | Implementaciones. |

## Utilidades existentes (usar antes de crear nuevas)

- **`utils/balanceUtils.ts`** → `calculateClientBalance(ledgerEntries)`: Cálculo de saldo pendiente. Fuente única de verdad para débitos/créditos. **Nunca** re-implementar esta lógica inline.
- **`utils/sanitizeUtils.ts`** → `sanitizeTaxpayerForRole(taxpayer, isAssistant)`: Limpia campos financieros según rol. Usar en toda ruta que devuelva taxpayers.
- **`utils/sriUtils.ts`** → `extractNovenoDigito(ruc)`, `calculateFechaDecla(ruc, regimen)`: Cálculos tributarios del SRI Ecuador.

## Reglas de dominio CRM

1. **Roles:** `ADMIN_MAYRA` (acceso total), `COBRADOR` (acceso financiero), `ASISTENTE` (Modo Ciego: sin datos monetarios).
2. **Colas de WhatsApp:** `GERENCIAL_MAYRA`, `OPERATIVA_CHICAS`, `COBRANZA`. Las asistentes solo ven `OPERATIVA_CHICAS`.
3. **Claves sensibles:** Solo se entregan por WhatsApp tras verificar el PIN de 4 dígitos del cliente.
4. **Facturación automática:** Los cargos se generan mensual/semestral/anual según `autoBillFreq` del Taxpayer. El cron verifica duplicados por `periodText` antes de crear.
5. **WebSocket:** Todo mensaje procesado por el bot emite `whatsapp:new-message` al frontend vía `io.emit()`.

