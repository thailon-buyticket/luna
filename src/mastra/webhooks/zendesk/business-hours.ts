import { env } from '../../config/env';
import { getCurrentHour } from '../../config/time';

// Horário de atendimento é sempre em horário de São Paulo (ver `getCurrentHour`), não importa
// onde o servidor estiver rodando. 10h–20h por padrão; configurável via env sem mexer no código.
const BUSINESS_HOURS_START_HOUR = env.LUNA_BUSINESS_HOURS_START_HOUR ?? 10;
const BUSINESS_HOURS_END_HOUR = env.LUNA_BUSINESS_HOURS_END_HOUR ?? 20;

const HIGH_VOLUME_MESSAGE =
  'Atenção: devido ao alto volume de solicitações neste momento, nosso tempo de resposta pode ser maior do que o normal. Contamos com sua compreensão e não se preocupe: garantimos que vamos responder você assim que possível.';

const OUTSIDE_BUSINESS_HOURS_MESSAGE =
  'Como sua solicitação precisa do suporte do nosso time, peço que aguarde o início do horário de atendimento. Estaremos de volta a partir das 10h para dar continuidade ao seu caso, combinado?';

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
  if (!isWithinBusinessHours(now)) return OUTSIDE_BUSINESS_HOURS_MESSAGE;
  if (isHighVolume()) return HIGH_VOLUME_MESSAGE;
  return null;
}
