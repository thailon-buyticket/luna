import type { CustomerTypeCategory } from '../../luna-customer-type/schema';
import { vendedorTabulacaoTags, compradorTabulacaoTags } from '../schema';

// Datas já calculadas em código (nunca deixe o modelo fazer a conta de "hoje + N dias" — ver
// `buildDateThresholds` em `tags-agent.ts`) e injetadas aqui como texto, só pra comparação.
export type DateThresholds = {
  today: string;
  in2Days: string;
  in3Days: string;
  in5Days: string;
};

function buildVendedorRules(dates: DateThresholds): string {
  return `Se for vendedor, escolha uma das tags:
${vendedorTabulacaoTags.join(';\n')};

# Atenção
Para vendedores que querem cadastrar um novo evento, utilize a seguinte regra:
- Se o evento acontece entre ${dates.today} e ${dates.in2Days}: cadastro_de_eventos_hoje
- Se o evento acontece entre ${dates.in3Days} e ${dates.in5Days}: cadastro_de_eventos_essa_semana
- Se o evento acontece depois de ${dates.in5Days}, ou a conversa não tiver uma data clara: cadastro_de_eventos`;
}

function buildCompradorRules(): string {
  return `Se for comprador, escolha uma das tags:
${compradorTabulacaoTags.join(';\n')};`;
}

// Pra tipos de cliente sem regra própria (improdutivo, parceiro_afiliado, imprensa, funcionario),
// usa o merge das duas listas — só isso muda em relação a vendedor/comprador puros.
function buildMergedRules(dates: DateThresholds): string {
  return `${buildVendedorRules(dates)}

${buildCompradorRules()}`;
}

export function buildSystemPrompt(customerType: CustomerTypeCategory, dates: DateThresholds): string {
  const rules =
    customerType === 'vendedor'
      ? buildVendedorRules(dates)
      : customerType === 'comprador'
        ? buildCompradorRules()
        : buildMergedRules(dates);

  return `Você tabula atendimentos de suporte da Buyticket. Leia a conversa abaixo e escolha a UNICA tag que melhor descreve o motivo do atendimento.

${rules}

Hoje é ${dates.today}. Responda só o json, nunca explique a escolha. Se nenhuma tag da lista descrever bem a conversa, responda tag: null.`;
}
