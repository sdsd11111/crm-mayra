// backend/src/services/bot/skills/debounceQueueSkill.ts

interface QueuedBuffer {
  texts: string[];
  timer: NodeJS.Timeout;
  resolve: (value: string) => void;
}

export class DebounceQueueSkill {
  private static bufferMap = new Map<string, QueuedBuffer>();
  // 10 segundos como solicitaste (tiempo ideal para que el cliente termine de escribir sus 2-3 líneas)
  private static DEBOUNCE_MS = 10000;

  /**
   * Agrupa los mensajes que un usuario envía en ráfaga dentro de una ventana de 10 segundos
   */
  public static enqueueMessage(phone: string, text: string): Promise<string> {
    return new Promise<string>((resolve) => {
      const cleanPhone = phone.replace(/\D/g, '');
      const existing = this.bufferMap.get(cleanPhone);

      if (existing) {
        clearTimeout(existing.timer);
        existing.texts.push(text);

        existing.timer = setTimeout(() => {
          const combined = existing.texts.join(' ');
          this.bufferMap.delete(cleanPhone);
          existing.resolve(combined);
        }, this.DEBOUNCE_MS);
      } else {
        const bufferEntry: QueuedBuffer = {
          texts: [text],
          resolve,
          timer: setTimeout(() => {
            const combined = bufferEntry.texts.join(' ');
            this.bufferMap.delete(cleanPhone);
            resolve(combined);
          }, this.DEBOUNCE_MS),
        };

        this.bufferMap.set(cleanPhone, bufferEntry);
      }
    });
  }
}

