import { env } from '../config/env';
import { Business } from './business-factory';
import { Zendesk } from './channels/zendesk';

// Horário de atendimento é sempre em horário de São Paulo (ver `getCurrentHour`), não importa
// onde o servidor estiver rodando. 10h–20h por padrão; configurável via env sem mexer no código.
// A BuyTicket ainda não distingue semana de fim de semana — mesmo horário nos dois casos até
// virar um requisito real.
const BUSINESS_HOURS_START_HOUR = env.LUNA_BUSINESS_HOURS_START_HOUR ?? 10;
const BUSINESS_HOURS_END_HOUR = env.LUNA_BUSINESS_HOURS_END_HOUR ?? 20;

export const buyticket = Business({
  name: 'Buyticket',
  id: env.LUNA_TENANT_ID,
  workingHours: {
    week: { start: BUSINESS_HOURS_START_HOUR, end: BUSINESS_HOURS_END_HOUR },
    weekend: { start: BUSINESS_HOURS_START_HOUR, end: BUSINESS_HOURS_END_HOUR },
  },
  channel: Zendesk({
    appId: env.ZENDESK_APP_ID,
    switchboards: {
      human: env.ZENDESK_HUMAN_SWITCHBOARD_ID,
      ai_agent: env.ZENDESK_AI_AGENT_SWITCHBOARD_ID,
    },
  }),
});
