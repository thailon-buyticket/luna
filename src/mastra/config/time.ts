const TIMEZONE = 'America/Sao_Paulo';

export function formatNow(now: Date): string {
  return now.toLocaleString('pt-BR', { timeZone: TIMEZONE, dateStyle: 'full', timeStyle: 'short' });
}

// Sempre o horário de SP, não importa o fuso do servidor: `timeZone` é passado explicitamente
// pro Intl, então isso não depende de `TZ`/locale da máquina rodando o processo (diferente de
// `now.getHours()`, que usaria o fuso local do servidor).
export function getCurrentHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: 'numeric', hourCycle: 'h23' }).format(now));
}
