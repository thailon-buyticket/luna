import { z } from 'zod';
import type { CustomerTypeCategory } from '../luna-customer-type/schema';

// Fonte única das tags de tabulação por tipo de cliente — pra adicionar, remover ou mudar uma tag
// de vendedor/comprador, mexa só neste dicionário. Tanto o texto do prompt
// (`prompts/system-prompt.ts`) quanto o enum do structured output (`buildTabulacaoOutputSchema`
// abaixo) leem daqui, então os dois nunca ficam fora de sincronia. Pros demais tipos (improdutivo,
// parceiro_afiliado, imprensa, funcionario), sem regra própria ainda, usa o merge das duas listas
// (decisão explícita do usuário: "se não for comprador nem vendedor, pode ser o merge dos dois
// casos") — ver `mergedTabulacaoTags` e `buildTabulacaoOutputSchema`.
export const TABULACAO_TAGS_BY_CUSTOMER_TYPE = {
  vendedor: [
    'ajuda_com_venda',
    'cancelar_venda',
    'cancelamento_de_venda',
    'seguranca',
    'golpe',
    'problema_com_saque',
    'saque',
    'duvidas_vendedor',
    'transferencia_de_ingresso',
    'atualizar_conta_e_perfil',
    'quero_cadastrar_um_evento_',
    'cadastro_de_evento_solicitado',
    'cadastro_de_eventos',
    'cadastro_de_eventos_hoje',
    'cadastro_de_eventos_essa_semana',
    'evento_hoje',
  ],
  comprador: [
    'acessar_meu_ingresso',
    'cancelar_compra',
    'cancelamento_de_compra',
    'cancelamento_reembolso',
    'cadastro_de_eventos',
    'cadastro_de_evento_solicitado',
    'atualizar_conta_e_perfil',
    'duvidas_comprador',
    'evento_hoje',
    'fraude_ou_golpe_evento_nao_e_hoje',
    'fraude_ou_golpe_evento_e_hoje',
    'seguranca',
    'nao_recebi_o_ingresso',
    'problemas_na_plataforma',
    'outro_problema',
  ],
} as const;

// Só usado internamente pro enum dos tipos sem regra própria — algumas tags se repetem entre
// vendedor e comprador (ex.: "seguranca"), mas duplicata numa lista de valores válidos do zod é
// inofensiva, não afeta a validação.
const mergedTabulacaoTags = [...TABULACAO_TAGS_BY_CUSTOMER_TYPE.vendedor, ...TABULACAO_TAGS_BY_CUSTOMER_TYPE.comprador] as const;

export type TabulacaoTag = (typeof mergedTabulacaoTags)[number];

const TAGS_DESCRIPTION = 'Todas as tags de tabulação com evidência clara na conversa — lista vazia se nenhuma se aplicar claramente.';

// Schema placeholder usado só na criação do `tagsAgent` (mesma ideia da instruction placeholder em
// `tags-agent.ts`) — `classifyHandoffTags` nunca usa este de verdade, sempre chama
// `buildTabulacaoOutputSchema(customerType)` no `generate()`. Se dependesse deste placeholder, o
// enum aceitaria qualquer tag (vendedor + comprador juntas) pra qualquer tipo de cliente — ex.: o
// modelo escolher `saque` (tag de vendedor) numa conversa de comprador.
export const tabulacaoOutputSchema = z.object({
  tags: z.array(z.enum(mergedTabulacaoTags)).describe(TAGS_DESCRIPTION),
});

export type TabulacaoOutput = z.infer<typeof tabulacaoOutputSchema>;

// Schema de verdade usado em cada chamada de `classifyHandoffTags` — trava o enum na lista certa do
// `customerType` da vez (vendedor, comprador, ou o merge das duas pros demais tipos). O agent pode
// retornar 0, 1 ou várias tags — uma conversa pode ter mais de um assunto.
export function buildTabulacaoOutputSchema(customerType: CustomerTypeCategory) {
  const tags =
    customerType === 'vendedor'
      ? TABULACAO_TAGS_BY_CUSTOMER_TYPE.vendedor
      : customerType === 'comprador'
        ? TABULACAO_TAGS_BY_CUSTOMER_TYPE.comprador
        : mergedTabulacaoTags;

  return z.object({
    tags: z.array(z.enum(tags)).describe(TAGS_DESCRIPTION),
  });
}

// Tags críticas/prioritárias — cross-cutting, não dependem do `tipo_cliente` (evento_hoje importa
// igual pra vendedor, comprador ou qualquer outro tipo). São reavaliadas pelo agente de tags
// especiais (`special-tags-agent.ts`), que roda em paralelo ao de tags de operação — a duplicata
// entre os dois é inofensiva, o `Set` em `buildHandoffTags` (`webhooks/zendesk/handoff-tags.ts`)
// já deduplica o resultado final.
export const CRITICAL_TAGS: readonly TabulacaoTag[] = ['evento_hoje', 'cadastro_de_eventos', 'cadastro_de_eventos_hoje', 'cadastro_de_eventos_essa_semana'];

// Schema do agente de tags especiais — enum = `CRITICAL_TAGS` (fixas) + os títulos de tag
// "priority" configurados pelo time de suporte no HiveOps (dinâmicos, vêm de
// `getHiveOps().getPriorityTags()` a cada chamada). `CRITICAL_TAGS` garante que a lista nunca
// fica vazia, então o cast de tupla não-vazia é seguro mesmo sem tags priority cadastradas.
export function buildSpecialTagsOutputSchema(hiveOpsPriorityTagTitles: readonly string[]) {
  const tags = [...CRITICAL_TAGS, ...hiveOpsPriorityTagTitles] as [string, ...string[]];

  return z.object({
    tags: z.array(z.enum(tags)).describe(TAGS_DESCRIPTION),
  });
}
