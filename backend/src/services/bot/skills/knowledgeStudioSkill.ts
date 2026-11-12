// backend/src/services/bot/skills/knowledgeStudioSkill.ts

export class KnowledgeStudioSkill {
  /**
   * Base de Conocimiento Oficial del Estudio Contable Mayra Castillo
   * Fuente de verdad para identidad, servicios, límites y reglas de negocio.
   */
  public static getStudioKnowledge(): string {
    return `
=== IDENTIDAD Y PERFIL DEL DESPACHO ===
- Nombre oficial: Estudio Contable y Tributario Mayra Castillo.
- Titular y Directora General: Ing. Mayra Castillo (Contadora Pública y Asesora Tributaria Senior en Loja, Ecuador).
- Equipo de trabajo: Ing. Mayra Castillo (Dirección e impuestos complejos) y su equipo de asistentes contables para la parte operativa.
- Modalidad y Cobertura: Atención personalizada a personas naturales (RIMPE negocio popular, emprendedores, régimen general) y personas jurídicas (sociedades y empresas) en Loja y a nivel nacional.

=== CATÁLOGO DE SERVICIOS DEL ESTUDIO ===
1. Declaraciones de Impuestos ante el SRI:
   - IVA mensual y semestral.
   - Impuesto a la Renta personas naturales y jurídicas.
   - Retenciones en la fuente y anexos transaccionales (ATS).
2. Devolución de IVA para Tercera Edad y Personas con Discapacidad:
   - Trámite digital y presencial ante el SRI.
3. Facturación Electrónica y Firmas Electrónicas:
   - Asesoramiento en emisión de comprobantes autorizados.
   - Emisión y renovación de firmas electrónicas (.p12 en archivo o token).
4. Asesoría Societaria y Laboral:
   - Cumplimiento ante la Superintendencia de Compañías (balances anuales, estados financieros, actas de juntas).
   - Plataforma del Ministerio de Trabajo (SUT) y planillas del IESS.
5. Regularización Tributaria:
   - Levantamiento de clausuras, impugnaciones, liquidación de multas e intereses.

=== POLÍTICA DE CUENTAS BANCARIAS PARA PAGOS Y HONORARIOS ===
Cuentas receptoras oficiales del Estudio Contable:
1. Banco Pichincha (Cuenta Corriente / Ahorros autorizada).
2. Banco de Loja.
3. Cooperativa JEP.
4. Efectivo / Caja en oficina.
* Regla: Toda transferencia debe acompañarse del comprobante con número de referencia y nombre del contribuyente para conciliarlo en la cartera.

=== REGLAS DE ORO DE SEGURIDAD Y PRIVACIDAD ===
1. PIN de Seguridad: Las claves personales del SRI, IESS o firmas electrónicas NUNCA se envían por WhatsApp a menos que el cliente ingrese su PIN de 4 dígitos registrado en el sistema.
2. Modo Ciego: Las asistentes nunca tratan temas de comisiones de devolución de IVA ni saldos globales directos de Mayra; la IA solo menciona saldo al titular autenticado.
3. Horario y Descanso: El bot recibe mensajes 24/7, pero si el cliente escribe de noche o madrugada, se le aclara cordialmente que su trámite o revisión humana será atendida a primera hora del siguiente día laborable.
`;
  }
}

