# 02. LÓGICA CONTABLE, CARTERA Y ROLES ("BOLSA DE DEUDA")

## 1. Cómo Funciona la Contabilidad de Mayra (Regla de la "Bolsa Común")
A diferencia de un facturador tradicional donde cada pago mata una factura específica, Mayra maneja un sistema de **Cuenta Corriente Acumulada (Ledger)** por cada `ClientOwner`:

$$	ext{Saldo Pendiente Actual} = \sum (	ext{Cargos Automáticos} + 	ext{Cargos Manuales} + 	ext{Comisiones Dev. IVA}) - \sum (	ext{Abonos} + 	ext{Descuentos/Cruces})$$

### Reglas de Negocio Obligatorias:
1. **Precios Variables por Cliente:** Mayra no cobra un tarifario fijo general. A una empresa le cobra `$69/mes`, a otra en cero le cobra `$23/mes`, y a una persona natural le cobra `$5/mes`. Por eso el monto se configura individualmente en cada `Taxpayer` o se digita a mano al crear un cargo.
2. **Desglose por Empresas de un mismo Dueño:**
   - Si *Pedro Rojas* tiene 3 empresas (*Dharma*, *Tulp Farma* y *Pedro Rojas Personal*), cada cargo se registra indicando a qué `taxpayerId` pertenece.
   - Así, cuando el sistema genera el **PDF de Estado de Cuenta**, agrupa visualmente los trabajos por empresa, pero muestra **un único Saldo Total a Pagar** al final y descuenta los abonos generales que haya hecho el dueño.

---

## 2. Automatización de Aumentos de Saldo (El Cronjob)
En el perfil de cada empresa (`Taxpayer`), Mayra configura:
- `autoBillFreq`: `NONE` | `MENSUAL` | `SEMESTRAL` | `ANUAL`.
- `autoBillAmount`: Valor en dólares (ej. `$50.00`).
- `appliesVat`: Si es `true`, el sistema le suma el 15% de IVA al cargo (ej. `$50 + $7.50 = $57.50`, como hace en los Excels de *Padfit*, *Pascaltech* y *Mojifruit*).

### Ejecución del Cronjob (`node-cron`):
- Corre todos los días **1 de cada mes a las 00:05 AM**:
  - Si `autoBillFreq == 'MENSUAL'`, inserta automáticamente un `LedgerEntry` de tipo `CARGO_AUTOMATICO` con el concepto `"Honorarios Contables [Mes/Año] - [Razón Social]"`.
  - Si `autoBillFreq == 'SEMESTRAL'` y el mes actual es **Enero (1)** o **Julio (7)**, inserta el cargo semestral automáticamente.
  - Si `autoBillFreq == 'ANUAL'` y el mes actual es **Marzo (3)** (Personas Naturales) o **Abril (4)** (Compañías), inserta el cargo anual configurado.

---

## 3. Lógica de Devolución de IVA Tercera Edad (Porcentaje Variable + Modo Ciego)
En los clientes de Tercera Edad, el cobro no es un monto fijo mensual, sino un **porcentaje de lo que se solicita devolver al SRI** (normalmente `10%`, pero en casos como *Mauro Guzmán* es el `8%`).

### Flujo Exacto en el Sistema:
1. **Configuración (Solo Mayra):** Al crear o editar el RUC del jubilado, Mayra deja puesto `devIvaPercent = 10.00` (o `8.00`).
2. **Operación Mensual (Las Chicas - Modo Ciego):**
   - La asistente entra a la pestaña de **Devolución IVA** del cliente.
   - Solo ve un formulario que pide: `Año`, `Mes` y `Monto Solicitado al SRI ($)` (ej. `$138.00`).
   - La asistente **NO ve** el porcentaje ni cuánto gana Mayra.
3. **Cálculo Interno Automático:**
   - Al guardar, el backend lee `Taxpayer.devIvaPercent` (`10%`), calcula `$138.00 * 0.10 = $13.80`, guarda el registro en `DevIvaRecord` e **inserta automáticamente un `LedgerEntry` de `+$13.80`** en la cuenta corriente privada de Mayra.

---

## 4. Registro de Abonos y las 3 Cuentas Bancarias de Mayra
Cuando un cliente paga todo o da un abono parcial (ej. *"Mairita, le transferí $100"*):
1. Mayra entra al cliente y hace clic en **`[+ Registrar Abono / Pago]`**.
2. Ingresa:
   - **Monto Abonado:** Ej. `$100.00`.
   - **Destino del Dinero (Selector Obligatorio):**
     - `🏦 Banco Pichincha`
     - `🏦 Banco de Loja`
     - `🏦 Cooperativa JEP`
     - `💵 Efectivo`
     - `🔄 Cruce de Cuentas / Descuento (Ej. Arriendo o Nota de Crédito)`
   - **Fecha y Observación / Comprobante (opcional).**
3. El sistema resta automáticamente esos `$100.00` del Saldo Pendiente del cliente y suma `$100.00` al contador mensual del banco seleccionado en el Dashboard de Mayra.

---

## 5. Matriz Estricta de Visibilidad (Mayra vs. Las Chicas)

| Elemento / Acción en el CRM | Rol `ADMIN_MAYRA` | Rol `ASISTENTE` ("Las Chicas") |
|:---|:---|:---|
| Ver montos en dólares (`$`), saldos pendientes o historial de pagos | ✅ Visible y Editable | ❌ **OCULTO POR COMPLETO** (Ni en API ni en UI) |
| Ver los 3 círculos de Bancos (Pichincha, Loja, JEP) | ✅ Visible en Dashboard | ❌ **OCULTO POR COMPLETO** |
| Configurar cuánto se le cobra a un cliente (Cron o % Dev IVA) | ✅ Visible y Editable | ❌ **OCULTO POR COMPLETO** |
| Ver Tabla Fija de Clientes (RUC, 9no dígito, Claves, Obligaciones) | ✅ Visible y Editable | ✅ Visible y Editable |
| Subir PDFs/XMLs a la Carpeta del Cliente (Bunny.net) | ✅ Permitido | ✅ Permitido (Su función principal) |
| Ingresar el "Monto Solicitado al SRI" en Devolución de IVA | ✅ Permitido | ✅ Permitido (Ve lo solicitado al SRI, no la comisión) |
