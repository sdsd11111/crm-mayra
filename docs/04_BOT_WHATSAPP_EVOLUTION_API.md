# 04. ARQUITECTURA DEL BOT DE WHATSAPP (EVOLUTION API + IA)

## 1. Infraestructura y Conexión
- **Canal:** Número corporativo de la oficina conectado vía **Evolution API** (corriendo en Docker en el mismo VPS).
- **Comunicación con el Backend:** Evolution API envía un Webhook `messages.upsert` por cada mensaje entrante a `POST /api/whatsapp/webhook`.
- **Control Híbrido (Bot vs. Humano):**
  - Cada chat tiene un estado `botActive: boolean`.
  - Si el bot deriva la conversación a las chicas o a Mayra, o si una humana escribe desde el CRM, el bot se pausa en ese chat hasta que marquen el ticket como `CERRADO`.

---

## 2. Los 5 Flujos Principales del Bot

### FLUJO 1: Identificación, Seguridad por PIN y Regla VIP
Cada vez que entra un mensaje de un número `whatsappPhone`:
1. **Búsqueda en Base de Datos:** El backend busca en `ClientOwner.whatsappPhone`.
2. **Caso A – ES el Cliente VIP (`isVip == true`) y escribe en fin de semana, feriado o madrugada:**
   - El bot envía una alerta inmediata al WhatsApp **personal** de Mayra: *"🚨 Mairita, tu cliente VIP [Nombre] te acaba de escribir al número de la oficina: '[Mensaje]'"*.
3. **Caso B – Número Registrado (`ClientOwner` encontrado):**
   - El bot lo saluda por su nombre y sabe exactamente qué empresas (`Taxpayer`) tiene asociadas.
   - Si pide información pública o trámites operativos, avanza directo.
   - **Filtro Anti-Hackeo / Empleados Infiltrados:** Si pide información ultrasensible (**Claves del SRI, Clave o archivo de Firma Electrónica**), el bot le pide su `securityPin` de 4 dígitos antes de responder.
4. **Caso C – Número NO Registrado (Desconocido):**
   - El bot pregunta:
     *"¡Hola! Bienvenido al Estudio Contable de la Ing. Mayra Castillo. 😊 ¿Eres un **cliente nuevo** o nos escribes de parte de algún **cliente ya registrado**?"*
   - Si dice **Cliente Nuevo** -> Le pregunta *"¿Quién te recomendó con nosotros y en qué servicio necesitas ayuda?"*, crea un ticket en la `GERENCIAL_MAYRA` y le avisa a Mayra para que ella cotice y cierre el negocio.
   - Si dice **Cliente Registrado desde otro número** -> Le pide el número de RUC/Cédula + el **PIN de seguridad de 4 dígitos** para validar su identidad.

---

### FLUJO 2: Autoservicio de Documentos desde Bunny.net (Ahorro de Tiempo Total)
Cuando un cliente validado escribe:
- *"Mairita, necesito mi RUC y las 6 últimas declaraciones de IVA para un préstamo"* o *"Pásame la declaración de renta del 2025"*.
- **Acción del Bot (vía Tool/Function Calling `get_client_documents`):**
  1. Consulta la tabla `Document` filtrando por el `taxpayerId` del cliente, la categoría (`DECLARACION_IVA`, `RUC_CERTIFICADO`, `DECLARACION_RENTA`, `NOMBRAMIENTO_ESCRITURA`) y el periodo pedido.
  2. Si los archivos existen en Bunny.net, el bot descarga los PDFs y se los envía directamente al WhatsApp del cliente en segundos con el mensaje: *"Aquí tienes tus documentos descargados de nuestra bóveda digital. 📄"*
  3. Si algún archivo histórico aún no ha sido subido a la bóveda, el bot crea una alerta silenciosa a las chicas: *"El cliente [Nombre] solicitó [Documento] y no está en su carpeta. Por favor súbanlo"*, y le dice al cliente: *"En unos minutos una de nuestras asistentes te envía el documento"*.

---

### FLUJO 3: Enrutamiento Operativo Directo a "Las Chicas"
Cuando el cliente necesita que le **hagan** algo operativo:
1. **Emisión de Facturas Electrónicas:** *"Hola, necesito que me hagan una factura para tal cliente por $100"*.
2. **Planillas del IESS / Contratos SUT / Certificados:** *"Ayúdeme descargando la planilla del IESS para ir a pagar"*.
- **Acción del Bot:**
  - Recopila los datos de la factura o requerimiento.
  - Crea un `ChatTicket` en la cola `OPERATIVA_CHICAS` (aparece con alerta sonora en el CRM de las asistentes, **sin molestar a Mayra**).
  - Cuando la asistente hace la factura en el SRI, la sube desde el CRM -> El sistema guarda el PDF en la carpeta de Bunny.net y se lo envía por WhatsApp al cliente.

---

### FLUJO 4: Embudo Automático de Venta de Firmas Electrónicas
Cuando alguien solicita una **Firma Electrónica**:
1. El bot pregunta: *"¿La necesitas **con RUC** o **sin RUC** y por cuántos años (1, 2, 3 o 4 años)?"*
2. Le envía la lista exacta de requisitos y le va pidiendo que suba ahí mismo por WhatsApp:
   - Foto frontal y posterior de la cédula.
   - Foto selfie sosteniendo la cédula.
   - Correo electrónico y celular.
3. Una vez que el cliente envía los requisitos, el bot los guarda en su carpeta de Bunny.net y le envía los números de cuenta de Mayra (*Pichincha, Loja o JEP*) pidiendo la foto del comprobante de pago.
4. Cuando el cliente manda la foto de la transferencia, el bot notifica a las chicas: *"✅ Orden de Firma Electrónica lista con requisitos y comprobante de pago adjunto para [Cliente]"*.

---

### FLUJO 5: Motor de Cobranza Automática y Compromisos (Días 1 al 5)
1. **Disparo Mensual (Del 1 al 5 de cada mes):**
   - El sistema toma todos los `ClientOwner` cuyo saldo en la bolsa (`LedgerEntry`) sea mayor a `$0`.
   - Genera al vuelo el **PDF de Estado de Cuenta Consolidado** (desglosando sus empresas si tiene varias) y se lo envía por WhatsApp:
     *"Hola [Nombre], te saludamos del Estudio Contable Mayra Castillo. Adjunto el resumen actualizado de tus servicios contables hasta la fecha (Saldo pendiente: **$XX.XX**). ¿Para qué día de esta semana te agendamos el pago o prefieres realizar un abono parcial hoy?"*
2. **Negociación y Registro de Promesas de Pago:**
   - Si el cliente responde: *"Mairita, espéreme hasta el 15 que me pagan"*, el bot está instruido para responder:
     *"Perfecto [Nombre], te agendo el recordatorio para el día 15. Si deseas, puedes adelantar hoy un pequeño abono de $20 para ir bajando tu saldo y el 15 completamos el resto. ¿Te parece bien?"*
   - El bot guarda la fecha `15` en la tabla `PaymentPromise` y **pausa los cobros para ese cliente hasta el día 15**.
   - El día 15 a las 09:00 AM, si Mayra aún no ha registrado el abono en el CRM, el bot retoma el hilo: *"¡Hola [Nombre]! Hoy es 15, te escribo como quedamos para confirmar tu transferencia..."*.
   - Si no responde o incumple la promesa, pasa a la vista de **`COBRADOR` (Esposo de Mayra)** para llamada telefónica directa.
