// backend/src/services/bot/skills/slidingMemorySkill.ts
import { prisma } from '../../../lib/prisma';
import { ChatMessageItem } from '../types';

export class SlidingMemorySkill {
  private static MAX_SLIDING_MESSAGES = 10;

  /**
   * Obtiene la memoria activa (resumen histórico + últimos 10 mensajes)
   */
  public static async getMemory(phone: string): Promise<{
    summary: string;
    recentMessages: ChatMessageItem[];
  }> {
    const ticket = await prisma.chatTicket.findFirst({
      where: {
        OR: [
          { whatsappPhone: phone },
          { whatsappPhone: { endsWith: phone.slice(-9) } },
        ],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!ticket) {
      return { summary: '', recentMessages: [] };
    }

    // Convertir y ordenar cronológicamente
    const ordered = (ticket.messages || [])
      .slice()
      .reverse()
      .map((m: any) => ({
        role: (m.sender === 'CLIENT' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt.toISOString(),
      }));

    // Tomar los últimos MAX_SLIDING_MESSAGES
    const recent = ordered.slice(-this.MAX_SLIDING_MESSAGES);
    const summary = ticket.aiSummary || '';

    return { summary, recentMessages: recent };
  }

  /**
   * Actualiza el ticket con el resumen acumulativo si hay más de 10 mensajes
   */
  public static async updateSummaryIfNeeded(
    ticketId: number,
    currentSummary: string,
    allMessagesCount: number,
    summarizerFn: (historyText: string) => Promise<string>
  ): Promise<string> {
    if (allMessagesCount <= this.MAX_SLIDING_MESSAGES) {
      return currentSummary;
    }

    // Si ya creció, obtenemos los mensajes que saldrán de la ventana para resumirlos
    const olderMessages = await prisma.chatMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      take: allMessagesCount - this.MAX_SLIDING_MESSAGES,
    });

    if (olderMessages.length === 0) return currentSummary;

    const historyChunk = olderMessages
      .map((m: any) => `${m.sender === 'CLIENT' ? 'Cliente' : 'Estudio'}: ${m.content}`)
      .join('\n');

    try {
      const newSummaryPart = await summarizerFn(
        `Resumen previo:\n${currentSummary}\n\nNuevos mensajes anteriores a comprimir:\n${historyChunk}`
      );

      await prisma.chatTicket.update({
        where: { id: ticketId },
        data: { aiSummary: newSummaryPart },
      });

      return newSummaryPart;
    } catch (err) {
      console.error('[SlidingMemorySkill] Error al compactar resumen:', err);
      return currentSummary;
    }
  }
}
