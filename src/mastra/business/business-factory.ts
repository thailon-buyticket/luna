import { getCurrentHour, isWeekend } from '../config/time';
import { PREDEFINED_MESSAGES } from '../predefined-messages';

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
  // `app.id` do webhook do Zendesk (Sunshine Conversations) — é o que liga um evento recebido a
  // esta empresa no `business/registry.ts`. `undefined` até `ZENDESK_APP_ID` ser configurado.
  appId: string | undefined;
  workingHours: WorkingHours;
}

export interface Business {
  readonly name: string;
  readonly id: string | undefined;
  readonly appId: string | undefined;
  isWithinWorkingHours(now?: Date): boolean;
  isHighVolume(): boolean;
  getHandoffNoticeMessage(now?: Date): string | null;
}

// Regras de negócio de uma empresa cadastrada no sistema: horário de atendimento, volume de
// conversas, aviso antes de transferir pra um humano. Só isso — nenhuma dependência de canal
// (Zendesk, WhatsApp) ou de fonte de dados (HiveOps) mora aqui, só cálculo puro em cima da
// config. Enviar mensagens e trocar de switchboard é responsabilidade de quem chama (ver
// `webhooks/zendesk/zendesk.ts`). Cada empresa registrada vive em `business/<nome>.ts` e entra
// no lookup em `business/registry.ts`.
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

  return {
    name: config.name,
    id: config.id,
    appId: config.appId,
    isWithinWorkingHours,
    isHighVolume,
    getHandoffNoticeMessage,
  };
}
