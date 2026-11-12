# 03. DISEÑO FRONTEND, UI/UX Y MAPA DE PANTALLAS (NEXT.JS + REACT + TYPESCRIPT + TAILWINDCSS)

## 1. Identidad Visual y Paleta de Colores Oficial
Extraída directamente de los archivos `Logo.jpg`, `logo-cuadrado.png` y la referencia de interfaz Fintech (`5e1de619bc38a85edba57fc13109e660.jpg`):

- **Color Primario (Azul Mayra Castillo):** `#1E80C1` (Usado en botones principales, barras activas, íconos destacados y bordes de foco).
- **Color Secundario / Texto Oscuro (Navy Corporativo):** `#1E2A3C` (Usado en tipografía principal, menú lateral activo y botones de acción secundaria).
- **Fondo General de la Aplicación (Fintech Soft Gradient):** Gradiente suave de `#EEF3FA` a `#E2EAF6`.
- **Tarjetas (Glassmorphism Limpio):** Fondo `bg-white/85` con `backdrop-blur-md`, bordes `border border-white/60`, sombra suave `shadow-sm` y esquinas redondeadas `rounded-2xl`.
- **Semáforo de Estados:**
  - 🟢 **Al día / Pagado / Declarado:** `#10B981` (Emerald 500)
  - 🟡 **Pendiente / Próximo a vencer:** `#F59E0B` (Amber 500)
  - 🔴 **Vencido / Moroso / Urgente (1 día antes del 9no dígito):** `#EF4444` (Red 500)

---

## 2. Mapa Detallado de las 5 Pantallas del Sistema

### PANTALLA 0: Login Minimalista (`/login`)
- Tarjeta central estilo Glassmorphism con el logo oficial de **Mayra Castillo**.
- **Únicamente 2 campos:**
  1. `Usuario` (`username`, texto plano sin formato de email).
  2. `Contraseña` (`password`).
- Botón `#1E2A3C`: `Ingresar al Sistema`.
- Dependiendo del rol (`ADMIN_MAYRA`, `ASISTENTE`, `COBRADOR`), redirige a la vista correspondiente.

---

### PANTALLA 1: Dashboard Principal (`/dashboard`) — Inspirado en la Imagen de Referencia
El contenido del Dashboard cambia dinámicamente según quién inició sesión:

#### A. Vista Exclusiva de `ADMIN_MAYRA`:
1. **Tarjeta Superior Principal (Inspirada en el bloque "Total Balance" de la referencia):**
   - Muestra en grande el **Total Recaudado en el Mes ($)** y a un costado el **Total en Cartera por Cobrar ($)**.
   - Adentro contiene las **3 Burbujas / Círculos Interactivos** de sus cuentas bancarias:
     - **Círculo 1:** `Banco Pichincha` (`$X,XXX.XX`)
     - **Círculo 2 (Destacado en degradado azul `#1E80C1`):** `Cooperativa JEP` (`$X,XXX.XX`)
     - **Círculo 3:** `Banco de Loja` (`$X,XXX.XX`)
     - *(Más indicador pequeño de `Efectivo`)*.
   - Botones rápidos a la derecha: `[+ Registrar Abono]` y `[Disparar Cobranza WhatsApp]`.
2. **Fila Media (2 Tarjetas):**
   - **Izquierda ("Estadística de Ingresos Mensuales"):** Gráfico de barras verticales limpias (Enero a Diciembre) mostrando cuánto ingresó mes a mes.
   - **Derecha ("Salud de Declaraciones del Mes"):** Porcentaje de declaraciones completadas en el mes actual (ej. `85% completado`) con línea de progreso.
3. **Tarjeta Inferior ("Vencimientos Tributarios de Hoy y Mañana" + "Firmas por Caducar"):**
   - Lista estilo *"Upcoming payments"* de la imagen de referencia: muestra los clientes cuyo **9no dígito del RUC** vence hoy o mañana y que aún no tienen subido su PDF del mes, más las firmas `.p12` que vencen en los próximos 5 días.

#### B. Vista de `ASISTENTE` ("Las Chicas"):
- **NO se renderiza ninguna tarjeta de dinero ni bancos.**
- En la parte superior ven 3 contadores operativos: `Declaraciones que vencen HOY`, `Tickets de WhatsApp Abiertos` y `Firmas Electrónicas por Vencer`.
- Debajo ven directamente la lista de trabajo del día ordenada por el 9no dígito del RUC.

---

### PANTALLA 2: Directorio Maestro de Clientes (`/clientes`) — Las Tablas de `Mayra 1.xlsx`
Reemplaza el Excel `LISTADO_CLIENTES_` manteniendo exactamente la disposición mental que ellas ya dominan:

1. **Barra Superior de Filtros y Buscador:**
   - Buscador en tiempo real por: *Nombre del Dueño, Razón Social o RUC*.
   - Pestañas de filtro rápido: `[Todos]` | `[Mensuales]` | `[Semestrales]` | `[Anuales]` | `[Compañías Supercias]` | `[Devolución IVA 3ra Edad]` | `[Cerrados/Sacados]`.
   - Filtro por **Día de Vencimiento (9no dígito):** Botones rápidos `[9] [10] [12] [14] [16] [18] [20] [22] [24] [26] [28]`.
2. **La Tabla Fija de Clientes:**
   - Columnas visibles:
     `Dueño/Pagador` | `Razón Social` | `Fecha Decla (9no dígito)` | `RUC` | `Régimen` | `Claves Rápidas (SRI / Firma / IESS / SUT / Supercias)` | `Checks de Obligaciones (DECLA, ICE, ANEXO, IVA, SALAR, SUT, IESS)` | `Estado del Mes (🟢/🟡/🔴)`.
   - **Botones de "Copiar Clave" en 1 clic:** Al hacer clic sobre la clave del SRI o IESS en la fila, se copia al portapapeles con un toast `"¡Clave SRI copiada!"` sin tener que seleccionar texto.
   - *(La columna `Saldo Pendiente ($)` solo aparece si el usuario logueado es `ADMIN_MAYRA` o `COBRADOR`)*.

---

### PANTALLA 3: Expediente 360° del Cliente (`/clientes/:id`)
Al hacer clic en un cliente, se abre su vista detallada. Si el dueño tiene varias empresas (ej. *Pedro Rojas* -> *Dharma*, *Tulp Farma*, *Personal*), arriba aparece un selector de pestañas para alternar entre sus empresas o ver el consolidado.

Tiene **3 Sub-Pestañas Internas**:

1. **Sub-Pestaña 1: Ficha Técnica, Claves y Obligaciones:**
   - Formulario limpio con todos los campos fijos de la tabla (`Razón Social, RUC, Fecha, Email, Claves SRI/SUT/IESS/Supercias, Archivo Firma .p12 con fecha de vencimiento y Checkboxes de obligaciones`).
2. **Sub-Pestaña 2: Bóveda Digital / Carpetas (Conectada a Bunny.net):**
   - Vista visual de **Carpetas por Año (`2024`, `2025`, `2026`)** y dentro subcarpetas por tipo (`Declaraciones IVA`, `Renta`, `Anexo ATS`, `Supercias`, `RUC y Escrituras`, `Facturas Emitidas`).
   - Botón destacado: **`[+ Subir Documento a la Carpeta]`**.
   - Al subir un archivo (ej. *IVA Mayo 2026*), tiene un check opcional: `[✓] Enviar automáticamente este PDF por WhatsApp al cliente al guardar`.
   - En cada archivo guardado hay dos botones: `[Descargar / Ver]` y `[Reenviar por WhatsApp]`.
   - Si el cliente es de **Tercera Edad (`DEV. IVA`)**, aquí aparece la cajita rápida para las chicas: `Registrar Monto Solicitado al SRI este mes ($)`.
3. **Sub-Pestaña 3: Contabilidad y Estado de Cuenta *(BLOQUEADA PARA LAS CHICAS)*:**
   - **Bloque Superior:** Configuración del Cron Automático (`Monto: $XX.XX`, `Frecuencia: Mensual/Semestral/Anual`, `¿Más IVA 15%?`, `% Comisión Devolución: 10%`).
   - **Botones de Acción para Mayra:** `[+ Agregar Cargo Manual]`, `[+ Registrar Abono / Pago]` (con selector de los 3 bancos: *Pichincha, Loja, JEP, Efectivo*), y `[📄 Descargar / Enviar PDF Estado de Cuenta]`.
   - **Tabla de Movimientos (La Bolsa):** Lista cronológica de cargos (`+`) y abonos (`-`) mostrando el **Saldo Pendiente Total** en grande.

---

### PANTALLA 4: Centro de Mensajes WhatsApp y Tickets (`/whatsapp`)
Interfaz estilo WhatsApp Web conectada por WebSockets a Evolution API:
- **Columna Izquierda:** Lista de conversaciones filtrada por pestañas:
  - `🛠️ Bandeja Operativa (Chicas)`: Solicitudes de facturas, planillas IESS, requisitos de firmas.
  - `👑 Bandeja Mayra`: Clientes nuevos, asesorías contables, casos especiales.
  - `💰 En Cobranza`: Hilos donde el bot está cobrando o negociando fechas de pago.
- **Columna Central:** El chat en vivo con soporte para enviar textos, audios y adjuntar directamente archivos desde la **Bóveda Digital (Bunny.net)** del cliente con 1 clic.
- **Columna Derecha:** Resumen rápido del cliente con el que se está chateando (qué empresas tiene, sus claves y botón rápido para subirle la factura que acaba de pedir).
