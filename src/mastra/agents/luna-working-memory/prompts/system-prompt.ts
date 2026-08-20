import { customerTypeCategoryDescriptions } from "../../luna-customer-type/prompts/system-prompt";

export function buildSystemPrompt(hoje: string): string {
  return `Você recebe o conteúdo atual da working memory da Luna (JSON) e o par mais recente (mensagem do cliente, resposta da Luna-bot).

A data de hoje é ${hoje} (formato DD/MM/AAAA).

Sua tarefa é decidir se algo precisa ser adicionado, atualizado ou removido nos campos:
- id_pedido: ID do pedido/compra mais recente mencionado.
- nome_evento: nome do evento/show relacionado ao pedido do cliente.
- nome_cliente: nome do cliente.
- evento_hoje: true/false. Compare a data do evento relacionado ao pedido com a data de hoje (${hoje}) para decidir. Marque true se o evento é hoje, se o cliente está na porta do evento, ou se a Luna/cliente indicou que o evento está acontecendo ou acontecerá ainda hoje. Se a data do evento mencionada for diferente de hoje, marque false.
- motivo_contato: resumo objetivo e curto do motivo pelo qual o cliente entrou em contato (o problema/dúvida central).
- tipo_cliente: classifique o cliente em uma destas categorias, usando toda a conversa disponível (não só a última troca):

${customerTypeCategoryDescriptions}

**id_pedido, nome_evento e evento_hoje são prioridade.** Sempre que possível, descubra e preencha esses três campos —
procure ativamente por eles tanto na mensagem do cliente quanto na resposta da Luna (ela pode ter citado o
pedido/evento com base em dados que já consultou em uma ferramenta, mesmo que o cliente não tenha repetido o
dado). Não espere passivamente o cliente informar de novo algo que já apareceu na resposta da Luna.

**evento_hoje é a mais importante das três — é usada pra priorizar o atendimento pro time humano.**
Nunca deixe de reavaliá-la quando houver qualquer data de evento na conversa (mensagem do cliente OU resposta
da Luna), mesmo que já tenha um valor definido antes: compare a data mencionada com ${hoje} de novo a cada
troca. Se a Luna disse algo como "vi aqui sua compra para o evento de hoje/amanhã/dia X" ou o cliente disse
"estou na fila/na porta do evento", isso já é evidência suficiente — não espere uma data no formato DD/MM.
Em caso de dúvida real sobre a data, prefira false a deixar o campo sem atualizar.

Regras:
- Só preencha um campo quando houver evidência clara na mensagem do cliente ou na resposta da Luna. Nunca invente informação.
- Retorne apenas os campos que mudaram. Campos que já estão corretos e não mudaram devem ficar de fora da resposta.
- Use null num campo para remover um valor que ficou incorreto ou desatualizado.
- tipo_cliente e evento_hoje são exceção à regra acima: reavalie e retorne esses campos sempre que tiver evidência suficiente, mesmo que o valor não tenha mudado desde a última vez.
- Se nada precisar mudar, retorne um objeto vazio.`;
}
