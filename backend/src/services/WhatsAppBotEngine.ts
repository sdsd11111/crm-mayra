// backend/src/services/WhatsAppBotEngine.ts
import { prisma } from '../lib/prisma';
import { EvolutionApiService } from './EvolutionApiService';
import { DeepSeekAiService } from './DeepSeekAiService';
import { io } from '../index';

export interface IncomingMessage {
  fromPhone: string;
  senderName?: string;
  messageText: string;
}

// ══════════════════════════════════════════════════════════════════════
// SESIONES EN MEMORIA para flujos multi-paso (Firma Electrónica)
// Key: número de teléfono, Value: estado del flujo actual
// ══════════════════════════════════════════════════════════════════════
interface SessionState {
  flow: 'FIRMA_TIPO' | 'FIRMA_CEDULA' | 'FIRMA_SELFIE' | 'FIRMA_COMPROBANTE';
  firmaType?: 'CON_RUC' | 'SIN_RUC';
  cedula?: boolean;
  selfie?: boolean;
  clientName: string;
  startedAt: Date;
}

const activeSessions = new Map<string, SessionState>();

// Limpiar sesiones viejas (> 30 minutos) cada 10 minutos
setInterval(() => {
  const now = new Date();
  for (const [phone, session] of activeSessions.entries()) {
    const minutesElapsed = (now.getTime() - session.startedAt.getTime()) / 60000;
    if (minutesElapsed > 30) {
      activeSessions.delete(phone);
    }
  }
}, 10 * 60 * 1000);

export class WhatsAppBotEngine {
  /**
   * Procesa un mensaje entrante (desde Webhook real o desde Simulador)
   * ejecutando los 6 flujos del Bot de Mayra Castillo.
   */
  public static async handleIncomingMessage(msg: IncomingMessage): Promise<{
    handled: boolean;
    replyText: string;
    flow: string;
    ticketCreated?: boolean;
    mediaSent?: boolean;
  }> {
    const rawPhone = msg.fromPhone.replace(/\D/g, '');
    const cleanText = msg.messageText.trim().toLowerCase();
    const originalText = msg.messageText.trim();

    console.log(`🤖 [BotEngine] Mensaje recibido de ${rawPhone}: "${originalText}"`);

    // ══════════════════════════════════════════════════════════════════
    // FLUJO MULTI-PASO: FIRMA ELECTRÓNICA (sesión activa tiene prioridad)
    // ══════════════════════════════════════════════════════════════════
    if (activeSessions.has(rawPhone)) {
      return this.handleFirmaSession(rawPhone, originalText, cleanText);
    }

    // 1. Buscar si el teléfono pertenece a un cliente registrado (ClientOwner)
    const client = await prisma.clientOwner.findFirst({
      where: {
        OR: [
          { whatsappPhone: rawPhone },
          { whatsappPhone: { endsWith: rawPhone.slice(-9) } },
        ],
      },
      include: {
        taxpayers: {
          include: {
            documents: true,
          },
        },
        ledgerEntries: true,
      },
    });

    // ══════════════════════════════════════════════════════════════════
    // CASO 1: CLIENTE NO REGISTRADO (DESCONOCIDO)
    // ══════════════════════════════════════════════════════════════════
    if (!client) {
      // ¿Pide firma electrónica siendo desconocido?
      if (
        cleanText.includes('firma electronica') ||
        cleanText.includes('firma electrónica') ||
        cleanText.includes('firma digital') ||
        (cleanText.includes('firma') && cleanText.includes('token'))
      ) {
        return this.startFirmaFlow(rawPhone, originalText, 'Cliente Nuevo');
      }

      if (
        cleanText.includes('nuevo') ||
        cleanText.includes('asesoria') ||
        cleanText.includes('asesoría') ||
        cleanText.includes('costo') ||
        cleanText.includes('precio')
      ) {
        await prisma.chatTicket.create({
          data: {
            whatsappPhone: rawPhone,
            queueType: 'GERENCIAL_MAYRA',
            subject: `Cliente Nuevo / Consulta: "${originalText.slice(0, 80)}"`,
            status: 'ABIERTO',
          },
        });

        const reply =
          '¡Hola! Bienvenido(a) al Estudio Contable de la Ing. Mayra Castillo. 😊\n\n' +
          'He derivado tu consulta a la Ing. Mayra para coordinar tu caso personalmente. ' +
          '¿Quién te recomendó con nosotros y cuál es tu nombre completo?';

        await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
        this.broadcastMessageToCrm(rawPhone, originalText, reply, 'GERENCIAL_MAYRA', 'Desconocido');

        return { handled: true, replyText: reply, flow: 'CLIENTE_NUEVO_GERENCIAL', ticketCreated: true };
      }

      // Saludo inicial a desconocido
      const reply =
        '¡Hola! Bienvenido al Estudio Contable de la Ing. Mayra Castillo en Loja, Ecuador. 👋\n\n' +
        '¿Eres un *cliente nuevo* o nos escribes de parte de alguna *empresa ya registrada*?';

      await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
      this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', 'Desconocido');

      return { handled: true, replyText: reply, flow: 'SALUDO_DESCONOCIDO' };
    }

    // ══════════════════════════════════════════════════════════════════
    // CASO 2: CLIENTE REGISTRADO — REGLA VIP (MADRUGADAS O FINES DE SEMANA)
    // ══════════════════════════════════════════════════════════════════
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado
    const hour = now.getHours();
    const isOffHours = dayOfWeek === 0 || dayOfWeek === 6 || hour < 8 || hour >= 19;

    if (client.isVip && isOffHours) {
      const reply =
        `Estimado(a) ${client.fullName}, recibimos tu mensaje. ` +
        `Por ser cliente prioritario de la Ing. Mayra, ya le notificamos a su celular personal para atenderte a la brevedad posible. 🌟`;

      await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
      this.broadcastMessageToCrm(rawPhone, originalText, reply, 'GERENCIAL_MAYRA', client.fullName);

      return { handled: true, replyText: reply, flow: 'VIP_ALERTA_PERSONAL' };
    }

    // ══════════════════════════════════════════════════════════════════
    // FLUJO FIRMA ELECTRÓNICA (cliente registrado que pide nueva firma)
    // ══════════════════════════════════════════════════════════════════
    if (
      cleanText.includes('firma electronica') ||
      cleanText.includes('firma electrónica') ||
      cleanText.includes('firma digital') ||
      cleanText.includes('renovar firma') ||
      cleanText.includes('nueva firma') ||
      (cleanText.includes('firma') && (cleanText.includes('renovar') || cleanText.includes('nueva') || cleanText.includes('token')))
    ) {
      return this.startFirmaFlow(rawPhone, originalText, client.fullName);
    }

    // ══════════════════════════════════════════════════════════════════
    // FLUJO 1: PETICIÓN DE CLAVES SENSIBLES → EXIGE PIN DE SEGURIDAD
    // ══════════════════════════════════════════════════════════════════
    if (cleanText.includes('clave') || cleanText.includes('contraseña') || cleanText.includes('password')) {
      const hasPin = cleanText.includes(client.securityPin);

      if (!hasPin) {
        const reply =
          `🔒 Por tu seguridad tributaria y protección de datos, para entregarte claves requerimos tu *PIN de seguridad de 4 dígitos*.\n\n` +
          `Por favor responde indicando tu PIN.`;

        await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
        this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', client.fullName);

        return { handled: true, replyText: reply, flow: 'SOLICITUD_PIN_SEGURIDAD' };
      }

      // Si colocó el PIN correcto, le proporcionamos sus claves autorizadas
      const primaryTaxpayer = client.taxpayers[0];
      const clavesList = [
        primaryTaxpayer?.claveSri ? `• Clave SRI: ${primaryTaxpayer.claveSri}` : null,
        primaryTaxpayer?.claveFirma ? `• Clave Firma: ${primaryTaxpayer.claveFirma}` : null,
        primaryTaxpayer?.claveIess ? `• Clave IESS: ${primaryTaxpayer.claveIess}` : null,
        primaryTaxpayer?.claveSut ? `• Clave SUT: ${primaryTaxpayer.claveSut}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const reply =
        `✅ *Identidad verificada exitosamente.*\n\n` +
        `Aquí tienes las claves de ${primaryTaxpayer?.razonSocial || client.fullName}:\n\n` +
        `${clavesList || 'No constan claves registradas en el sistema.'}\n\n` +
        `_Recuerda mantener esta información en estricta confidencialidad._`;

      await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
      this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', client.fullName);

      return { handled: true, replyText: reply, flow: 'ENTREGA_CLAVES_AUTORIZADA' };
    }

    // ══════════════════════════════════════════════════════════════════
    // FLUJO 2: AUTOSERVICIO DE DOCUMENTOS DESDE BÓVEDA BUNNY.NET
    // ══════════════════════════════════════════════════════════════════
    if (
      cleanText.includes('declaracion') ||
      cleanText.includes('declaraciones') ||
      cleanText.includes('iva') ||
      cleanText.includes('renta') ||
      cleanText.includes('ruc') ||
      cleanText.includes('prestamo') ||
      cleanText.includes('préstamo')
    ) {
      const allDocs = client.taxpayers.flatMap((t) => t.documents);

      if (allDocs.length > 0) {
        const latestDoc = allDocs.sort((a, b) => b.id - a.id)[0];

        const reply =
          `📄 Estimado(a) ${client.fullName}, hemos localizado tu documento en nuestra Bóveda Digital:\n\n` +
          `*${latestDoc.title}* (${latestDoc.periodYear})\n` +
          `Enlace: ${latestDoc.bunnyUrl}\n\n` +
          `Si requieres periodos adicionales, indícanos el año o mes exacto.`;

        await EvolutionApiService.sendMediaMessage({
          number: rawPhone,
          mediaUrl: latestDoc.bunnyUrl,
          fileName: `${latestDoc.title}.pdf`,
          caption: `Documento contable: ${latestDoc.title}`,
        });

        this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', client.fullName);
        return { handled: true, replyText: reply, flow: 'AUTOSERVICIO_BOVEDA_BUNNY', mediaSent: true };
      } else {
        await prisma.chatTicket.create({
          data: {
            clientOwnerId: client.id,
            whatsappPhone: rawPhone,
            queueType: 'OPERATIVA_CHICAS',
            subject: `Subir documento pendiente solicitado por cliente: "${originalText.slice(0, 80)}"`,
            status: 'ABIERTO',
          },
        });

        const reply =
          `Hola ${client.fullName}, tu solicitud de documentos ya fue recibida. ` +
          `En unos minutos una de nuestras asistentes te prepara y envía el archivo por este medio.`;

        await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
        this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', client.fullName);

        return { handled: true, replyText: reply, flow: 'DOCUMENTO_PENDIENTE_SUBIDA', ticketCreated: true };
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // FLUJO 3: ENRUTAMIENTO OPERATIVO (FACTURAS O PLANILLAS IESS)
    // ══════════════════════════════════════════════════════════════════
    if (
      cleanText.includes('factura') ||
      cleanText.includes('planilla') ||
      cleanText.includes('iess') ||
      cleanText.includes('sut')
    ) {
      await prisma.chatTicket.create({
        data: {
          clientOwnerId: client.id,
          whatsappPhone: rawPhone,
          queueType: 'OPERATIVA_CHICAS',
          subject: `Trámite operativo: "${originalText.slice(0, 80)}"`,
          status: 'ABIERTO',
        },
      });

      const reply =
        `Entendido ${client.fullName}. He ingresado tu requerimiento a la bandeja operativa de nuestras asistentes. ` +
        `Apenas emitan tu documento te lo remitimos por aquí inmediatamente. 📋`;

      await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
      this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', client.fullName);

      return { handled: true, replyText: reply, flow: 'OPERATIVA_CHICAS', ticketCreated: true };
    }

    // ══════════════════════════════════════════════════════════════════
    // FLUJO 4: COBRANZA Y PROMESAS DE PAGO
    // ══════════════════════════════════════════════════════════════════
    const promiseMatch = cleanText.match(/(?:pago|transfiero|cancelo|espero|abono).*?(\d{1,2})/i);
    if (promiseMatch || cleanText.includes('quincena') || cleanText.includes('fin de mes')) {
      const day = promiseMatch ? parseInt(promiseMatch[1], 10) : 15;
      const targetDate = new Date();
      targetDate.setDate(day > 0 && day <= 31 ? day : 15);

      await prisma.paymentPromise.create({
        data: {
          clientOwnerId: client.id,
          promisedDate: targetDate,
          status: 'PENDIENTE',
          notes: `Promesa pactada por WhatsApp: "${originalText.slice(0, 100)}"`,
        },
      });

      const reply =
        `Perfecto ${client.fullName}, te agendamos el recordatorio para el día ${day}. ` +
        `Si deseas puedes adelantar un abono a nuestras cuentas (Pichincha, Loja o JEP) y enviarnos el comprobante. ¡Gracias por tu compromiso! 🙏`;

      await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
      this.broadcastMessageToCrm(rawPhone, originalText, reply, 'COBRANZA', client.fullName);

      return { handled: true, replyText: reply, flow: 'PROMESA_PAGO_REGISTRADA' };
    }

    // ══════════════════════════════════════════════════════════════════
    // INTELIGENCIA ARTIFICIAL (DeepSeek LLM) con contexto tributario
    // ══════════════════════════════════════════════════════════════════
    const aiResponse = await DeepSeekAiService.generateResponse(originalText, {
      clientName: client.fullName,
      phone: rawPhone,
      isRegistered: true,
      isVip: client.isVip,
      companies: client.taxpayers.map((t) => ({ razonSocial: t.razonSocial, ruc: t.ruc })),
    });

    const reply =
      aiResponse?.text ||
      `Hola ${client.fullName}, gracias por comunicarte con el Estudio Contable Mayra Castillo. 💙\n\n` +
      `¿En qué te podemos ayudar hoy?\n` +
      `1️⃣ Solicitar declaraciones de IVA / Renta / RUC\n` +
      `2️⃣ Emisión de facturas o planillas del IESS\n` +
      `3️⃣ Consultar claves o estado de cuenta\n` +
      `4️⃣ Firma Electrónica (nueva o renovación)\n` +
      `5️⃣ Asesoría con la Ing. Mayra`;

    await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
    this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', client.fullName);

    return {
      handled: true,
      replyText: reply,
      flow: aiResponse ? 'DEEPSEEK_AI_RESPONSE' : 'MENU_PRINCIPAL',
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // FLUJO 5: VENTA / GESTIÓN DE FIRMA ELECTRÓNICA (multi-paso)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Inicia el flujo de solicitud de firma electrónica.
   */
  private static async startFirmaFlow(
    rawPhone: string,
    originalText: string,
    clientName: string
  ): Promise<{ handled: boolean; replyText: string; flow: string; ticketCreated?: boolean }> {
    // Iniciar sesión multi-paso
    activeSessions.set(rawPhone, {
      flow: 'FIRMA_TIPO',
      clientName,
      startedAt: new Date(),
    });

    const reply =
      `🔑 *Solicitud de Firma Electrónica* — Estudio Contable Mayra Castillo\n\n` +
      `Hola *${clientName}*, con gusto te ayudamos con tu Firma Electrónica. 😊\n\n` +
      `Para comenzar el proceso, dime: ¿La firma es *con RUC* (empresa / profesional con RUC activo) ` +
      `o *sin RUC* (persona natural sin actividad tributaria)?\n\n` +
      `Responde *1* para Con RUC o *2* para Sin RUC.`;

    await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
    this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', clientName);

    return { handled: true, replyText: reply, flow: 'FIRMA_INICIO' };
  }

  /**
   * Maneja los pasos del flujo de Firma Electrónica.
   */
  private static async handleFirmaSession(
    rawPhone: string,
    originalText: string,
    cleanText: string
  ): Promise<{ handled: boolean; replyText: string; flow: string; ticketCreated?: boolean }> {
    const session = activeSessions.get(rawPhone)!;
    let reply = '';

    switch (session.flow) {
      // PASO 1: Tipo de firma (con RUC o sin RUC)
      case 'FIRMA_TIPO': {
        const isConRuc =
          cleanText.includes('1') ||
          cleanText.includes('con ruc') ||
          cleanText.includes('ruc') ||
          cleanText.includes('empresa');
        const isSinRuc =
          cleanText.includes('2') ||
          cleanText.includes('sin ruc') ||
          cleanText.includes('natural') ||
          cleanText.includes('persona');

        if (!isConRuc && !isSinRuc) {
          reply =
            `Por favor responde *1* para Firma con RUC o *2* para Firma sin RUC. 🙏`;
          await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
          return { handled: true, replyText: reply, flow: 'FIRMA_TIPO_REINTENTAR' };
        }

        session.firmaType = isConRuc ? 'CON_RUC' : 'SIN_RUC';
        session.flow = 'FIRMA_CEDULA';
        activeSessions.set(rawPhone, session);

        const reqsConRuc = `• Foto nítida de *cédula de identidad* (ambos lados)\n• *Selfie* sosteniendo la cédula\n• *Comprobante de pago* del servicio`;
        const reqsSinRuc = `• Foto nítida de *cédula de identidad* (ambos lados)\n• *Selfie* sosteniendo la cédula\n• *Comprobante de pago* del servicio`;

        reply =
          `✅ Perfecto. Para Firma Electrónica *${isConRuc ? 'con RUC' : 'sin RUC'}* necesitamos los siguientes requisitos:\n\n` +
          `${isConRuc ? reqsConRuc : reqsSinRuc}\n\n` +
          `Comencemos: *Por favor envía la foto de tu cédula de identidad* (pueden ser 2 fotos: anverso y reverso). 📸`;

        await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
        this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', session.clientName);
        return { handled: true, replyText: reply, flow: 'FIRMA_TIPO_SELECCIONADO' };
      }

      // PASO 2: Recepción de foto de cédula
      case 'FIRMA_CEDULA': {
        // Asumimos que cualquier respuesta en este paso es la confirmación de envío de cédula
        // (en producción, se verificaría que sea una imagen via body.message.imageMessage)
        session.cedula = true;
        session.flow = 'FIRMA_SELFIE';
        activeSessions.set(rawPhone, session);

        reply =
          `✅ ¡Recibido! Foto de cédula registrada.\n\n` +
          `Ahora necesitamos una *selfie* tuya sosteniendo la cédula de identidad junto a tu rostro. 🤳\n\n` +
          `Por favor envía la foto cuando estés listo/a.`;

        await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
        this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', session.clientName);
        return { handled: true, replyText: reply, flow: 'FIRMA_CEDULA_RECIBIDA' };
      }

      // PASO 3: Recepción de selfie
      case 'FIRMA_SELFIE': {
        session.selfie = true;
        session.flow = 'FIRMA_COMPROBANTE';
        activeSessions.set(rawPhone, session);

        reply =
          `✅ ¡Perfecto! Selfie con cédula registrada.\n\n` +
          `Último paso: Envíanos el *comprobante de pago* del servicio de Firma Electrónica. 💳\n\n` +
          `Valor referencial: Firma sin RUC ~$30 | Con RUC ~$35. ` +
          `Nuestras cuentas: *Banco Pichincha*, *Banco de Loja* o *Cooperativa JEP*.`;

        await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
        this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', session.clientName);
        return { handled: true, replyText: reply, flow: 'FIRMA_SELFIE_RECIBIDA' };
      }

      // PASO 4: Recepción de comprobante → crear ticket y cerrar flujo
      case 'FIRMA_COMPROBANTE': {
        // Limpiar la sesión
        activeSessions.delete(rawPhone);

        // Crear ticket en OPERATIVA_CHICAS con toda la info
        await prisma.chatTicket.create({
          data: {
            whatsappPhone: rawPhone,
            queueType: 'OPERATIVA_CHICAS',
            subject: `🔑 FIRMA ELECTRÓNICA ${session.firmaType === 'CON_RUC' ? 'CON RUC' : 'SIN RUC'} — ${session.clientName} — Requisitos completos recibidos`,
            status: 'ABIERTO',
          },
        });

        reply =
          `🎉 *¡Requisitos completos recibidos!*\n\n` +
          `Hemos registrado tu solicitud de *Firma Electrónica ${session.firmaType === 'CON_RUC' ? 'con RUC' : 'sin RUC'}*.\n\n` +
          `✅ Cédula de identidad: Recibida\n` +
          `✅ Selfie con cédula: Recibida\n` +
          `✅ Comprobante de pago: Recibido\n\n` +
          `Nuestras asistentes procesarán tu solicitud y te enviarán la firma en un plazo de *1 a 2 días hábiles*. ` +
          `Si tienes alguna consulta adicional, con gusto te atendemos. ¡Gracias! 💙`;

        await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
        this.broadcastMessageToCrm(rawPhone, originalText, reply, 'OPERATIVA_CHICAS', session.clientName);

        return { handled: true, replyText: reply, flow: 'FIRMA_SOLICITUD_COMPLETA', ticketCreated: true };
      }

      default: {
        activeSessions.delete(rawPhone);
        reply = `Gracias por tu mensaje. ¿En qué más te podemos ayudar?`;
        await EvolutionApiService.sendTextMessage({ number: rawPhone, text: reply });
        return { handled: true, replyText: reply, flow: 'FIRMA_SESION_RESET' };
      }
    }
  }

  /**
   * Notifica en vivo por WebSocket a la Pantalla de WhatsApp en el Frontend.
   */
  private static broadcastMessageToCrm(
    phone: string,
    incoming: string,
    reply: string,
    queue: string,
    clientName: string
  ): void {
    try {
      io.emit('whatsapp:new-message', {
        phone,
        clientName,
        incomingMessage: incoming,
        botReply: reply,
        queueType: queue,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error emitiendo websocket:', err);
    }
  }
}
