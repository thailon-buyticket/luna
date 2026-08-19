export const customerTypeCategoryDescriptions = `
  vendedor — Usuário com uma venda efetivada, vendeu algo pela plataforma, quer realizar um saque, enviou o ingresso para o comprador, está com problemas no recebimento de dinheiro pela plataforma, o comprador não responde, venda de ingresso, solicita cadastro de evento para vender ingresso.
  comprador — Usuário com compra efetivada, comprou pela plataforma, quer receber o ingresso, não recebeu o ingresso do vendedor, o vendedor não responde, está com problemas na compra de ingresso, não recebeu o ingresso, compra de ingresso, solicita cadastro de evento para comprar ingresso, quer criar uma conta.
  Improdutivo — Contato de alguém que não é cliente. Marketing de outras empresas ou assuntos não relacionados à Buyticket, SAC ou dúvidas. Assuntos aleatórios sem relação com a empresa.
  Parceiro/Afiliado — Contato de parceria da Buyticket. Assuntos como comissão, divulgação de ingressos, taxa de conversão, cupons, UGC, influencers ou marketing.
  Imprensa — Contato da mídia para divulgar a Buyticket. Perfis do Instagram, revistas, jornais, manchetes, divulgação, televisão, canais do YouTube ou anúncios.
  Funcionário — Contato de um funcionário interno da Buyticket, ou seja, um próprio funcionário entrando em contato com a empresa.`;


export function buildSystemPrompt(): string {
  return `Classify the user role on the conversation into one of the following categories. Don't explain, only output the json.
  ${customerTypeCategoryDescriptions}`;
}
