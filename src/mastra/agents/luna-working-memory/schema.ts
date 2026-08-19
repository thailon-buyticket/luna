import { z } from 'zod';
import { customerTypeCategories } from '../luna-customer-type/schema';

export const lunaWorkingMemorySchema = z.object({
  nome_cliente: z
    .string()
    .nullable()
    .optional()
    .describe('Nome do cliente.'),
  id_pedido: z
    .string()
    .nullable()
    .optional()
    .describe(
      'PRIORIDADE. ID do pedido/compra mais recente mencionado pelo cliente',
    ),
  nome_evento: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Nome do evento/show relacionado ao pedido do cliente',
    ),
  evento_hoje: z
    .boolean()
    .nullable()
    .optional()
    .describe('PRIORIDADE: Se o evento relacionado ao pedido do cliente é hoje'),
  motivo_contato: z
    .string()
    .nullable()
    .optional()
    .describe('Resumo objetivo do motivo pelo qual o cliente entrou em contato'),
  tipo_cliente: z
    .enum(customerTypeCategories)
    .nullable()
    .optional()
    .describe('Tipo de cliente (vendedor, comprador, etc.)'),
});

export type LunaWorkingMemory = z.infer<typeof lunaWorkingMemorySchema>;
