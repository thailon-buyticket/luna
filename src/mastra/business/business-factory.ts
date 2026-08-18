import { getCurrentHour, isWeekend } from '../config/time';
import { PREDEFINED_MESSAGES } from '../predefined-messages';
import type { Channel } from './channel';

export interface WorkingHoursRange {
  start: number;
  end: number;
}

export interface WorkingHours {
  week: WorkingHoursRange;
  weekend: WorkingHoursRange;
}

export interface BusinessConfig {
  name: string;
  id: string | undefined;
  workingHours: WorkingHours;
  channel: Channel;
}

export interface Business {
  readonly name: string;
  readonly id: string | undefined;
  readonly channel: Channel;
  isWithinWorkingHours(now?: Date): boolean;
  isHighVolume(): boolean;
  getHandoffNoticeMessage(now?: Date): string | null;
  handoffToHuman(conversationId: string): Promise<void>;
}

// Uma empresa cadastrada no sistema: regras de negócio (horário de atendimento, volume de
// conversas, aviso de handoff) mais o canal (Zendesk, WhatsApp etc) por onde ela fala com o
// cliente. Cada empresa registrada vive em `business/<nome>.ts` e entra no lookup em
// `business/registry.ts`, que resolve qual empresa trata cada webhook recebido.
export function Business(config: BusinessConfig): Business {
  function isWithinWorkingHours(now: Date = new Date()): boolean {
    const hour = getCurrentHour(now);
    const range = isWeekend(now) ? config.workingHours.weekend : config.workingHours.week;
    return hour >= range.start && hour < range.end;
  }

  // TODO: hoje é sempre `true`; vira uma consulta real (volume de conversas em aberto no
  // tenant) assim que essa métrica existir no banco.
  function isHighVolume(): boolean {
    return true;
  }

  // Aviso pro cliente antes de transferir a conversa pra um humano:
  // - Fora do horário de atendimento: avisa que só volta a ser atendido no próximo expediente.
  // - Dentro do horário e em alto volume: avisa sobre o tempo de resposta maior que o normal.
  // - Dentro do horário e sem alto volume: nenhum aviso configurado ainda — retorna null e a
  //   transferência acontece em silêncio.
  function getHandoffNoticeMessage(now: Date = new Date()): string | null {
    if (!isWithinWorkingHours(now)) return PREDEFINED_MESSAGES.business.outside_hours;
    if (isHighVolume()) return PREDEFINED_MESSAGES.business.high_volume;
    return null;
  }

  // Avisa o cliente (regra de negócio acima) e só então devolve a conversa pro time humano —
  // as duas coisas sempre andam juntas num handoff, independente do canal.
  async function handoffToHuman(conversationId: string): Promise<void> {
    const notice = getHandoffNoticeMessage();
    if (notice) await config.channel.sendMessage(conversationId, notice);
    await config.channel.connectHuman(conversationId);
  }

  return {
    name: config.name,
    id: config.id,
    channel: config.channel,
    isWithinWorkingHours,
    isHighVolume,
    getHandoffNoticeMessage,
    handoffToHuman,
  };
}
