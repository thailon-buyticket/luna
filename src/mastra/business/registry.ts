import type { Business } from './business-factory';
import { buyticket } from './buyticket';

// Toda empresa cadastrada no sistema. Uma nova empresa entra aqui — e só aqui — depois de criar
// seu arquivo `business/<nome>.ts` (ver `buyticket.ts` como referência).
const businesses: Business[] = [buyticket];

// Liga um evento recebido (hoje, `app.id` do webhook do Zendesk) à empresa dona daquele canal.
// `routes/zendesk-webhook.ts` usa isto pra descobrir de qual empresa é a mensagem antes de
// aplicar qualquer regra de negócio.
export function resolveBusinessByAppId(appId: string): Business {
  const business = businesses.find((candidate) => candidate.appId === appId);
  if (!business) {
    throw new Error(`No business registered for Zendesk app "${appId}". Check ZENDESK_APP_ID for each business in business/.`);
  }
  return business;
}
