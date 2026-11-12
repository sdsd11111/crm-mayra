// backend/src/services/bot/skills/reasonerLlmSkill.ts
import { ChatMessageItem, ClientProfileData, BotTurnOutput, CallCenterQueue } from '../types';
import { KnowledgeStudioSkill } from './knowledgeStudioSkill';
import { BotToolsRegistry } from '../tools/botToolsRegistry';

export class ReasonerLlmSkill {
  private static TOOL_DEFINITIONS = [
    {
      type: 'function',
      function: {
        name: 'verify_security_pin',
        description: 'Valida el PIN de 4 dígitos proporcionado por el cliente para acceder a datos confidenciales.',
        parameters: {
          type: 'object',
          properties: {
            pin: { type: 'string', description: 'El PIN numérico de 4 dígitos enviado por el cliente.' },
          },
          required: ['pin'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_client_document',
        description: 'Busca y envía un documento PDF oficial del cliente (declaración SRI, firma, certificado).',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Categoría del documento (ej. DECLARACION_IVA, FIRMA_ELECTRONICA_P12, RUC_SRI).' },
            year: { type: 'number', description: 'Año del periodo tributario.' },
            month: { type: 'number', description: 'Mes del periodo tributario.' },
            ruc: { type: 'string', description: 'RUC específico si el cliente tiene varias empresas.' },
          },
          required: ['category'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_account_balance_and_banks',
        description: 'Consulta el saldo pendiente real en la cartera contable y obtiene los datos de las cuentas bancarias oficiales.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'register_payment_promise',
        description: 'Registra un compromiso formal de pago con fecha acordada con el cliente.',
        parameters: {
          type: 'object',
          properties: {
            promisedDate: { type: 'string', description: 'Fecha prometida en formato YYYY-MM-DD.' },
            amount: { type: 'number', description: 'Monto comprometido si lo especificó.' },
            notes: { type: 'string', description: 'Notas adicionales del compromiso.' },
          },
          required: ['promisedDate'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_firma_electronica_step',
        description: 'Registra el avance del trámite de emisión de Firma Electrónica (.p12).',
        parameters: {
          type: 'object',
          properties: {
            stepCompleted: { type: 'string', description: 'Paso cumplido (CEDULA_SUBIDA, SELFIE_SUBIDA, PAGO_REGISTRADO, DATOS_COMPLETOS).' },
            hasRuc: { type: 'boolean' },
            years: { type: 'number' },
          },
          required: ['stepCompleted'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'transfer_to_human',
        description: 'Transfiere la conversación a una asistente operativa o a la Ing. Mayra Castillo pausando el bot.',
        parameters: {
          type: 'object',
          properties: {
            queue: { type: 'string', enum: ['OPERATIVA_CHICAS', 'GERENCIAL_MAYRA'] },
            summary: { type: 'string', description: 'Motivo claro y resumido de la derivación.' },
          },
          required: ['queue', 'summary'],
        },
      },
    },
  ];

  /**
   * Genera el turno conversacional usando DeepSeek con Tools determinísticas nativas
   */
  public static async executeTurn({
    incomingText,
    summary,
    recentMessages,
    clientProfile,
    phone,
    ticketId,
  }: {
    incomingText: string;
    summary: string;
    recentMessages: ChatMessageItem[];
    clientProfile: ClientProfileData | null;
    phone: string;
    ticketId: number;
  }): Promise<BotTurnOutput> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY no está configurada en el backend.');
    }

    const ecTime = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
    const studioKnowledge = KnowledgeStudioSkill.getStudioKnowledge();

    const systemPrompt = `
Eres la Asistente Virtual Oficial del Estudio Contable y Tributario Mayra Castillo en Loja, Ecuador.
Fecha y hora actual en Ecuador: ${ecTime}.

${studioKnowledge}

TU ROL Y ESTILO:
- Eres amable, profesional, ecuatoriana natural, respetuosa (de "usted") y precisa.
- CERO ALUCINACIONES: Tienes TERMINANTEMENTE PROHIBIDO inventar saldos, cuentas bancarias, fechas o cotizaciones de honorarios en el texto libre.
- Para consultar saldos o cuentas, DEBES llamar a 'get_account_balance_and_banks'.
- Para enviar documentos o firmas, DEBES llamar a 'send_client_document'.
- Si el cliente da su PIN de 4 dígitos, DEBES llamar a 'verify_security_pin'.
- Si el cliente solicita cotizaciones de planes contables o una consulta tributaria compleja / auditoría, NO inventes precios: llama a 'transfer_to_human' con queue 'GERENCIAL_MAYRA'.

DATOS DEL CLIENTE EN SISTEMA:
${clientProfile ? JSON.stringify(clientProfile, null, 2) : 'No registrado en la base de datos (posible prospecto).'}

HISTORIAL RESUMIDO:
${summary ? summary : 'Sin historial acumulado.'}
`;

    const messagesPayload: any[] = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: incomingText },
    ];

    // Primer llamada a DeepSeek con tools
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messagesPayload,
        temperature: 0.1, // Baja temperatura para cero alucinaciones
        tools: this.TOOL_DEFINITIONS,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Error en API DeepSeek: ${err}`);
    }

    const json = await response.json();
    const choice = json?.choices?.[0]?.message;

    let targetQueue: CallCenterQueue = 'OPERATIVA_CHICAS';
    let requiresHuman = false;
    let humanReason = undefined;

    // Si DeepSeek decidió llamar a una Tool determinística
    if (choice?.tool_calls && choice.tool_calls.length > 0) {
      const toolCall = choice.tool_calls[0];
      const toolName = toolCall.function.name;
      let toolArgs: any = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        toolArgs = {};
      }

      const ctx = {
        phone,
        clientOwnerId: clientProfile?.id,
        ticketId,
      };

      let toolResult: any = null;

      if (toolName === 'verify_security_pin') {
        toolResult = await BotToolsRegistry.verifySecurityPin(ctx, toolArgs);
      } else if (toolName === 'send_client_document') {
        toolResult = await BotToolsRegistry.sendClientDocument(ctx, toolArgs);
      } else if (toolName === 'get_account_balance_and_banks') {
        toolResult = await BotToolsRegistry.getAccountBalanceAndBanks(ctx);
        targetQueue = 'COBRANZA';
      } else if (toolName === 'register_payment_promise') {
        toolResult = await BotToolsRegistry.registerPaymentPromise(ctx, toolArgs);
        targetQueue = 'COBRANZA';
      } else if (toolName === 'save_firma_electronica_step') {
        toolResult = await BotToolsRegistry.saveFirmaElectronicaStep(ctx, toolArgs);
        targetQueue = 'OPERATIVA_CHICAS';
      } else if (toolName === 'transfer_to_human') {
        toolResult = await BotToolsRegistry.transferToHuman(ctx, toolArgs);
        targetQueue = toolArgs.queue;
        requiresHuman = true;
        humanReason = toolArgs.summary;
      }

      // Segunda pasada: retroalimentar a DeepSeek con el resultado real de la Tool
      messagesPayload.push(choice);
      messagesPayload.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });

      const secondRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messagesPayload,
          temperature: 0.1,
        }),
      });

      if (secondRes.ok) {
        const secondJson = await secondRes.json();
        const finalContent = secondJson?.choices?.[0]?.message?.content?.trim();
        return {
          replyText: finalContent || toolResult?.message || 'Con gusto, su solicitud ha sido procesada.',
          targetQueue,
          needsClarification: false,
          requiresHuman,
          humanReason,
        };
      }
    }

    return {
      replyText: choice?.content?.trim() || 'Buenas tardes, con gusto le asisto. ¿En qué trámite del estudio contable le podemos colaborar hoy?',
      targetQueue,
      needsClarification: false,
      requiresHuman,
      humanReason,
    };
  }

  /**
   * Comprime un bloque antiguo de conversación en un resumen conciso de 2 líneas
   */
  public static async compressHistory(historyText: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return '';

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'Eres un sintetizador de contexto para un estudio contable. Resume los hechos clave, acuerdos, documentos enviados o deudas en máximo 3 oraciones concisas en tercera persona.',
          },
          { role: 'user', content: historyText },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) return '';
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  }
}

