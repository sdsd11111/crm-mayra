# DESIGN SYSTEM · CRM ESTUDIO CONTABLE MAYRA CASTILLO

## 1. Product Type & Tone
- **Tipo de producto:** CRM / Sistema de Gestión Contable, Bóveda Digital Tributaria y Motor de Cartera.
- **Tono visual:** Profesional, sobrio, denso y orientado a datos numéricos y tributarios ecuatorianos (RUC, SRI, IESS, Supercias).
- **Estilo:** Glassmorphism suave (fondos degradados claros con tarjetas blancas semitransparentes `backdrop-blur-md`).

---

## 2. Colors & Tokens
Los colores base están configurados en `frontend/tailwind.config.js`:

| Token | Hex | Uso |
| :--- | :--- | :--- |
| `mayra-blue` (Primary) | `#1E80C1` | Botones de acción principal, enlaces activos, acentos de marca, focus rings |
| `mayra-navy` (Dark/Surface) | `#1E2A3C` | Títulos principales, navegación activa, botones oscuros de confirmación |
| `mayra-bg-from` | `#EEF3FA` | Inicio del degradado de fondo general de pantalla |
| `mayra-bg-to` | `#E2EAF6` | Fin del degradado de fondo general de pantalla |
| `semaforo-verde` (Success) | `#10B981` | Obligaciones al día, declaraciones subidas, saldos en $0.00 |
| `semaforo-amarillo` (Warning) | `#F59E0B` | Obligación pendiente (con tiempo disponible) |
| `semaforo-rojo` (Danger) | `#EF4444` | Vence hoy/mañana sin subir declaración, clientes morosos |

### Neutros y Superficies:
- **Card Surface:** `rgba(255, 255, 255, 0.90)` o `bg-white/90` con borde `border-white/70` o `border-gray-100`.
- **Text Primary:** `#1E2A3C` (alto contraste contra fondos claros).
- **Text Secondary / Muted:** `#6B7280` (`text-gray-500`) y `#9CA3AF` (`text-gray-400`).
- **Dividers:** `border-gray-100` o `border-gray-200/60`.

---

## 3. Typography
- **Fuente Principal:** `Inter` (importada desde `next/font/google` en `RootLayout`).
- **Escala de fuentes:**
  - `text-2xl` (24px) / `font-extrabold`: Títulos de página principales.
  - `text-lg` (18px) / `font-bold`: Cabeceras de sección y modales.
  - `text-sm` (14px) / `font-semibold`: Nombres de clientes, campos de formulario principales.
  - `text-xs` (12px) / `font-medium`: Etiquetas secundarias, navegación, botones estándar.
  - `text-[10px]` - `text-[11px]`: Fechas SRI, códigos RUC, badges de obligaciones (`font-mono` para números/claves).

---

## 4. Spacing, Radius & Shadows
- **Radio de Bordes:**
  - Tarjetas y contenedores: `rounded-2xl` (16px) a `rounded-3xl` (24px).
  - Botones y inputs: `rounded-xl` (12px) o `rounded-lg` (8px).
  - Badges y píldoras de estado: `rounded-full`.
- **Sombras:**
  - `shadow-xs` / `shadow-sm` para tarjetas en reposo.
  - `shadow-md` en hover para tarjetas interactivas.

---

## 5. Components in Use
- **Navbar / Sidebar:** Barra superior minimalista (`h-14`) con menú hamburguesa deslizable que da acceso a Dashboard, Clientes, WhatsApp y Supercias.
- **Stat Cards (Dashboard):** Tarjetas cuadradas con métrica numérica grande, icono temático y desglose en miniatura.
- **Client Cards (Cuadrícula compacta en `/clientes`):** Tarjetas en grilla de 4 columnas con cabecera de saldo, avatar de cliente, sub-tarjetas de RUC/empresas, botones de claves en 1 clic y badges de obligaciones.
- **Table / List View:** Vista tabular densa de clientes para modo administrativo masivo.
- **WhatsApp Inbox Drawer:** Panel de mensajería con separación estricta de colas (`OPERATIVA_CHICAS`, `GERENCIAL_MAYRA`, `COBRANZA`).
- **Action Buttons:** Botón primario con gradiente o fondo sólido `#1E80C1` / `#1E2A3C`, texto blanco y altura mínima de 40px.

---

## 6. Density Rules
- **Filas de Tabla:** Altura compacta de `36px` a `44px` para permitir ver múltiples contribuyentes sin scroll excesivo.
- **Inputs de Formulario:** Altura de `38px` (`py-2 px-3 text-xs` o `text-sm`).
- **Badges de Obligaciones (DECLA, IVA, ANX, IESS, SUT, SUP):** Píldoras ultra-compactas (`px-1.5 py-0.5 text-[9px] font-bold`).
- **Botones de Clave (SRI / IESS / Firma):** Botones con icono + texto + botón copiar en 1 solo clic (`px-1.5 py-0.5 font-mono text-[9px]`).

---

## 7. Do's & Don'ts Específicos
- ✅ **DO:** Usar siempre `font-mono` para RUCs, cédulas, contraseñas y teléfonos.
- ✅ **DO:** Acompañar siempre el color con un icono o texto explícito (ej. 🟢 Al día, 🟡 Pendiente, 🔴 Vence).
- ✅ **DO:** Mantener las tarjetas cuadradas proporcionadas y ordenadas en 4 columnas en pantallas de escritorio.
- ❌ **DON'T:** No usar texto largo redundante en barras de navegación superiores.
- ❌ **DON'T:** No usar contrastes inferiores a 4.5:1 en textos informativos (verificar con `check_contrast.py`).
- ❌ **DON'T:** No mostrar datos financieros o precios a usuarios con rol `ASISTENTE` (Modo Ciego Operativo).

