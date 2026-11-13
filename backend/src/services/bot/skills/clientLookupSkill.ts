// backend/src/services/bot/skills/clientLookupSkill.ts
import { prisma } from '../../../lib/prisma';
import { ClientProfileData } from '../types';
import { calculateClientBalance } from '../../../utils/balanceUtils';
import { extractNovenoDigito } from '../../../utils/sriUtils';

export class ClientLookupSkill {
  /**
   * Tabla SRI para día de vencimiento según noveno dígito
   */
  private static getSriDueDay(ruc?: string | null): number | null {
    const noveno = extractNovenoDigito(ruc);
    if (noveno === null) return null;
    const days: Record<number, number> = {
      1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28
    };
    return days[noveno] || 28;
  }

  /**
   * Busca cliente por número telefónico o crea un prospecto temporal si no existe
   */
  public static async identifyClient(phone: string, pushName?: string): Promise<{
    client: ClientProfileData | null;
    isNewClient: boolean;
  }> {
    const cleanPhone = phone.replace(/\D/g, '');

    const found = await prisma.clientOwner.findFirst({
      where: {
        OR: [
          { whatsappPhone: cleanPhone },
          { whatsappPhone: { endsWith: cleanPhone.slice(-9) } },
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

    if (found) {
      // Balance real usando la utilidad centralizada de finanzas
      const balance = calculateClientBalance(found.ledgerEntries);

      return {
        isNewClient: false,
        client: {
          id: found.id,
          fullName: found.fullName,
          whatsappPhone: found.whatsappPhone,
          securityPin: found.securityPin,
          isVip: found.isVip,
          taxpayers: found.taxpayers.map(t => {
            return {
              id: t.id,
              razonSocial: t.razonSocial,
              ruc: t.ruc,
              regimen: t.regimen,
              dueDay: this.getSriDueDay(t.ruc),
              claveSri: t.claveSri,
              claveIess: t.claveIess,
              fechaFirmaExpira: t.firmaExpira ? t.firmaExpira.toISOString() : null,
              documentsCount: t.documents.length,
            };
          }),
          saldoPendienteTotal: balance,
        },
      };
    }

    // REGLA ARQUITECTURA: NO insertar números desconocidos en ClientOwner para no contaminar el directorio oficial de Mayra
    return {
      client: null,
      isNewClient: true,
    };
  }
}
