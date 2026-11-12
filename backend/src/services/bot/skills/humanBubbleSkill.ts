// backend/src/services/bot/skills/humanBubbleSkill.ts

export class HumanBubbleSkill {
  /**
   * Divide un mensaje largo en 2 burbujas humanas cortas (como en el bot de QueComerEnLoja),
   * evitando que el cliente reciba un muro de texto abrumador.
   */
  public static splitBubbles(fullText: string): string[] {
    const clean = String(fullText || '').trim();
    if (!clean) return [];

    // Si es un mensaje corto (< 160 caracteres), se envía en una sola burbuja
    if (clean.length < 160) {
      return [clean];
    }

    // Si tiene párrafos explícitos (\n\n)
    const paragraphs = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length >= 2) {
      const last = paragraphs.pop()!;
      const first = paragraphs.join('\n\n');
      return [first, last];
    }

    // Si tiene una pregunta al final, se separa como segunda burbuja
    const lastQuestionIdx = clean.lastIndexOf('¿');
    if (lastQuestionIdx > 60) {
      const firstPart = clean.slice(0, lastQuestionIdx).trim();
      const questionPart = clean.slice(lastQuestionIdx).trim();
      return [firstPart, questionPart];
    }

    return [clean];
  }
}

