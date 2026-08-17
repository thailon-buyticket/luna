import { z } from 'zod';
import { customerTypeCategories } from '../luna-customer-type/schema';

export const lunaWorkingMemorySchema = z.object({
  nome_cliente: z
    .string()
    .nullable()
    .optional()
    .describe('Nome do cliente. Envie null para remover um valor anterior que ficou incorreto.'),
  id_pedido: z
    .string()
    .nullable()
    .optional()
    .describe(
      'PRIORIDADE. ID do pedido/compra mais recente mencionado pelo cliente. Envie null para remover.',
    ),
  nome_evento: z
    .string()
    .nullable()
    .optional()
    .describe(
      'PRIORIDADE. Nome do evento/show relacionado ao pedido do cliente. Envie null para remover.',
    ),
  evento_hoje: z
    .boolean()
    .nullable()
    .optional()
    .describe('Se o evento relacionado ao pedido do cliente é hoje. Envie null se ainda não souber.'),
  motivo_contato: z
    .string()
    .nullable()
    .optional()
    .describe('Resumo objetivo do motivo pelo qual o cliente entrou em contato. Envie null para remover.'),
  tipo_cliente: z
    .enum(customerTypeCategories)
    .nullable()
    .optional()
    .describe('Tipo de cliente (vendedor, comprador, etc.), classificado por um agente especialista — não decidido por este agente.'),
});

// Campos decididos pelo lunaWorkingMemoryAgent. tipo_cliente fica de fora — quem classifica
// isso é o customerTypeAgent (agents/luna-customer-type), chamado separadamente no output-processor.
export const lunaWorkingMemoryUpdateSchema = lunaWorkingMemorySchema.omit({ tipo_cliente: true });

export type LunaWorkingMemory = z.infer<typeof lunaWorkingMemorySchema>;
export type LunaWorkingMemoryUpdate = z.infer<typeof lunaWorkingMemoryUpdateSchema>;
