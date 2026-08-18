import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { findLunaCustomerByPhone } from '../customer-lookup';

export const buscarDadosClienteTool = createTool({
  id: 'buscar_dados_cliente',
  description: `Dados para melhorar sua conversa com o cliente.
SEMPRE use na primeira mensagem para verificar se existe algum dado útil disponível.

Dados disponiveis (user_fields):
- Ultimas compras/vendas
- Status (concluída, cancelada ou estornada)
- Vendedor oficial
- Limite diário de saque
- Metodos de pagamento
- Tipo do ingresso
- Data do evento comprado

Se só existir dados de compra: Assuma que é um comprador
Se só existir dados de venda: Assuma que é um vendedor
Se existir dados de ambos ou nenhum: questione.

Se o cliente informar que teve algum problema com a venda/compra, utilize SEMPRE a mais recente (pela data do evento, considerando a data atual informada na mensagem do usuário)

Se não retornar nenhum dado útil, não diga nada ao cliente nem informe que o dado não está disponível.

nunca informe os dados da outra parte. é proibido dar os dados do vendedor pro comprador. ou do comprador pro vendedor`,
  inputSchema: z.object({}),
  requestContextSchema: z.object({
    user_phone: z.string(),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    user_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  execute: async (_input, { requestContext }) => {
    const phone = requestContext.get('user_phone');

    if (!phone) {
      return { found: false };
    }

    const userFields = await findLunaCustomerByPhone(phone);

    if (!userFields) {
      return { found: false };
    }

    return { found: true, user_fields: userFields };
  },
});
