import { Agent } from '@mastra/core/agent';
import type { CustomerTypeCategory } from '../luna-customer-type/schema';
import { buildSystemPrompt, type DateThresholds } from './prompts/system-prompt';
import { buildTabulacaoOutputSchema, tabulacaoOutputSchema, type TabulacaoTag } from './schema';

export const tagsAgent = new Agent({
  id: 'tags',
  name: 'Tags',
  description: 'Escolhe todas as tags de tabulação do atendimento com evidência clara na conversa, a partir do tipo de cliente e da transcript, pra mandar pro Zendesk no handoff.',
  // Instrução real é montada por chamada (depende de tipo_cliente e da data de hoje) — ver
  // `buildSystemPrompt` e `classifyHandoffTags`, que passa `instructions` no `generate()`.
  // Placeholder também pro schema — `classifyHandoffTags` sempre sobrescreve com
  // `buildTabulacaoOutputSchema(customerType)` no `generate()`, senão o enum aceitaria tag de
  // qualquer tipo de cliente (ver comentário em `schema.ts`).
  instructions: 'Aguardando instruções específicas do atendimento.',
  model: 'openai/gpt-4.1-mini',
  defaultOptions: {
    structuredOutput: {
      schema: tabulacaoOutputSchema,
    },
  },
});

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDatePtBr(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function buildDateThresholds(today: Date): DateThresholds {
  return {
    today: formatDatePtBr(today),
    in2Days: formatDatePtBr(addDays(today, 2)),
    in3Days: formatDatePtBr(addDays(today, 3)),
    in5Days: formatDatePtBr(addDays(today, 5)),
  };
}

export async function classifyHandoffTags(
  transcript: string,
  customerType: CustomerTypeCategory,
): Promise<TabulacaoTag[]> {
  const instructions = buildSystemPrompt(customerType, buildDateThresholds(new Date()));
  const { object } = await tagsAgent.generate(transcript, {
    instructions,
    structuredOutput: { schema: buildTabulacaoOutputSchema(customerType) },
  });
  return [...new Set(object.tags)];
}
