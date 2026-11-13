// backend/src/services/bot/skills/debounceQueueSkill.ts

interface QueuedBuffer {
  texts: string[];
  timer: NodeJS.Timeout;
  resolves: Array<(value: string) => void>;
}

export class DebounceQueueSkill {
  private static bufferMap = new Map<string, QueuedBuffer>();
  
  private static getDebounceMs(): number {
    if (process.env.BOT_DEBOUNCE_MS !== undefined) {
      const parsed = parseInt(process.env.BOT_DEBOUNCE_MS, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 10000;
  }

  /**
   * Limpia buffers pendientes (útil para pruebas y reinicios)
   */
  public static clearAll(): void {
    for (const [, val] of this.bufferMap.entries()) {
      clearTimeout(val.timer);
    }
    this.bufferMap.clear();
  }

  /**
   * Agrupa los mensajes que un usuario envía en ráfaga dentro de una ventana de tiempo
   */
  public static enqueueMessage(phone: string, text: string): Promise<string> {
    const debounceMs = this.getDebounceMs();
    return new Promise<string>((resolve) => {
      const cleanPhone = phone.replace(/\D/g, '');
      const existing = this.bufferMap.get(cleanPhone);

      if (existing) {
        clearTimeout(existing.timer);
        existing.texts.push(text);
        existing.resolves.push(resolve);

        existing.timer = setTimeout(() => {
          const combined = existing.texts.join(' ');
          this.bufferMap.delete(cleanPhone);
          for (const res of existing.resolves) {
            res(combined);
          }
        }, debounceMs);
      } else {
        const bufferEntry: QueuedBuffer = {
          texts: [text],
          resolves: [resolve],
          timer: setTimeout(() => {
            const combined = bufferEntry.texts.join(' ');
            this.bufferMap.delete(cleanPhone);
            for (const res of bufferEntry.resolves) {
              res(combined);
            }
          }, debounceMs),
        };

        this.bufferMap.set(cleanPhone, bufferEntry);
      }
    });
  }
}

