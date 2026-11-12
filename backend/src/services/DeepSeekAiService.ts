// backend/src/services/DeepSeekAiService.ts
/**
 * Servicio de Inteligencia Artificial para el Bot de WhatsApp del Estudio Contable Mayra Castillo.
 * Utiliza DeepSeek API (modelo deepseek-chat compatible con OpenAI schema).
 */

export interface AiMessageContext {
  clientName: string;
  isRegistered: boolean;
  phone: string;
  isVip?: boolean;
  companies?: { razonSocial: string; ruc: string | null }[];
  saldoPendiente?: number;
}

export class DeepSeekAiService {
  private static apiKey = process.env.DEEPSEEK_API_KEY || '';
  private static apiUrl = 'https://api.deepseek.com/chat/completions';
  private static model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  /**
   * Genera una respuesta inteligente con contexto del Estudio Contable Mayra Castillo.
   */
  public static async generateResponse(
    userMessage: string,
    context: AiMessageContext
  ): Promise<{ text: string; intent?: string } | null> {
    if (!this.apiKey) {
      console.warn('⚠️ [DeepSeek] No hay DEEPSEEK_API_KEY configurada.');
      return null;
    }

    const systemPrompt = `Eres "Asistente Virtual del Estudio Contable Mayra Castillo", un chatbot inteligente, amable, profesional y conciso para el estudio contable liderado por la Ing. Mayra Castillo en Loja, Ecuador.

CONTEXTO DEL CLIENTE ACTUAL:
- Nombre: ${context.clientName}
- Teléfono: ${context.phone}
- Registrado en el sistema: ${context.isRegistered ? 'SÍ' : 'NO (Nuevo contacto)'}
${context.isVip ? '- Cliente VIP: SÍ' : ''}
${context.companies && context.companies.length > 0 ? `- Empresas/RUCs asociados: ${context.companies.map((c) => `${c.razonSocial} (${c.ruc || 'S/N'})`).join(', ')}` : ''}

SERVICIOS DEL ESTUDIO CONTABLE:
1. Declaraciones tributarias ante el SRI (IVA mensual/semestral, Impuesto a la Renta personas y sociedades).
2. Anexos transaccionales (ATS), ICE, proyecciones de gastos personales.
3. Facturación electrónica y planillas del IESS / contratos SUT (Ministerio de Trabajo).
4. Emisión y renovación de Firmas Electrónicas (con RUC o sin RUC).
5. Trámites ante la Superintendencia de Compañías (balances, actas de junta, informes de gerente).
6. Devolución de IVA para personas de la Tercera Edad.
7. Asesoría contable y tributaria personalizada con la Ing. Mayra Castillo.

REGLAS ESTRICTAS DE RESPUESTA:
- Tono: Muy educado, cálido, profesional y ejecutivo ecuatoriano ("Hola estimado/a", "Con mucho gusto", "Quedamos a tus órdenes"). Usa emojis sobrios (💼, 📄, 📞, 🤝, 💙).
- Longitud: Respuestas CONCISAS y directas al grano (máximo 3 a 4 párrafos cortos). La gente lee en WhatsApp.
- SEGURIDAD: NUNCA inventes claves del SRI, firmas ni números de cuenta inventados. Si el cliente pide claves confidenciales o archivos de firma, indícale amablemente que por seguridad tributaria y protección de datos se requiere su PIN de 4 dígitos.
- Si el cliente es NUEVO, dale una cálida bienvenida, pregúntale quién lo recomendó y qué trámite contable o tributario necesita para que la Ing. Mayra o su equipo lo atienda.
- Si el cliente tiene dudas generales de plazos o requisitos tributarios ecuatorianos (SRI, IESS, etc.), puedes orientarlo con seguridad.
- Termina ofreciendo canalizarlo con las asistentes o con la Ing. Mayra si requiere trámite operativo.`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.6,
          max_tokens: 450,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error('⚠️ [DeepSeek] Error respuesta API:', errData);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) return null;

      return { text: content };
    } catch (error: any) {
      console.error('❌ [DeepSeek] Error al consultar LLM:', error.message);
      return null;
    }
  }
}

