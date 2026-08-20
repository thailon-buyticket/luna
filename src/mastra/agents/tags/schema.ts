import { z } from 'zod';

// Tags de tabulação — uma por atendimento, escolhida pelo `tagsAgent` a partir do `tipo_cliente`
// (working memory da Luna) e da transcript da conversa. Cada lista é a "regra de negócio" de tags
// válidas para aquele tipo de cliente; pros demais tipos (improdutivo, parceiro_afiliado, imprensa,
// funcionario), sem regra própria ainda, `buildSystemPrompt` usa o merge das duas listas.
export const vendedorTabulacaoTags = [
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
] as const;

export const compradorTabulacaoTags = [
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
] as const;

export const tabulacaoTags = [...vendedorTabulacaoTags, ...compradorTabulacaoTags] as const;

export const tabulacaoOutputSchema = z.object({
  tag: z.enum(tabulacaoTags).nullable().describe('Tag de tabulação do atendimento, ou null se nenhuma se aplicar claramente.'),
});

export type TabulacaoTag = (typeof tabulacaoTags)[number];
export type TabulacaoOutput = z.infer<typeof tabulacaoOutputSchema>;
