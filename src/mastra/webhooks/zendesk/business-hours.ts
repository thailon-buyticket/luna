import { env } from '../../config/env';
import { getCurrentHour } from '../../config/time';
import { PREDEFINED_MESSAGES } from '../../predefined-messages';

// Horário de atendimento é sempre em horário de São Paulo (ver `getCurrentHour`), não importa
// onde o servidor estiver rodando. 10h–20h por padrão; configurável via env sem mexer no código.
const BUSINESS_HOURS_START_HOUR = env.LUNA_BUSINESS_HOURS_START_HOUR ?? 10;
const BUSINESS_HOURS_END_HOUR = env.LUNA_BUSINESS_HOURS_END_HOUR ?? 20;

function isWithinBusinessHours(now: Date): boolean {
  const hour = getCurrentHour(now);
  return hour >= BUSINESS_HOURS_START_HOUR && hour < BUSINESS_HOURS_END_HOUR;
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
export function getHandoffNoticeMessage(now: Date = new Date()): string | null {
  if (!isWithinBusinessHours(now)) return PREDEFINED_MESSAGES.business.outside_hours;
  if (isHighVolume()) return PREDEFINED_MESSAGES.business.high_volume;
  return null;
}
