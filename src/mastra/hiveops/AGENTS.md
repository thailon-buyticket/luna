# AGENTS.md — hiveops

Leia este arquivo antes de alterar qualquer coisa nesta pasta.

## Objetivo

HiveOps é o sistema interno da Buyticket onde ficam as configurações operacionais da Luna (habilidades/playbooks, bases de conhecimento, incidências, tarefas, tags de handoff, estado de conversas). Essa pasta existe pra ninguém no resto do app (`agents/`, `webhooks/`) precisar saber que isso hoje é Supabase — só conhecem a interface `HiveOpsProvider`.

## Por que existe (ports & adapters)

- `hiveops-provider.ts` — a interface `HiveOpsProvider` (o "port"). É o único contrato que o resto do app enxerga.
- `supabase-hiveops-provider.ts` — `SupabaseHiveOpsProvider`, a implementação atual (o "adapter"), usando `services/supabase.ts`.
- `index.ts` — `getHiveOps()`, um singleton lazy que devolve a implementação em uso. **Se um dia o HiveOps deixar de ser Supabase** (ou virar outra base), troca-se só a linha que instancia o provider aqui — nenhum agente, tool ou webhook muda.
- `types.ts` — os tipos de domínio (`HiveOpsSkill`, `HiveOpsIncident`, etc.), agnósticos de onde os dados vêm.

## Regras

- Nenhum arquivo fora de `hiveops/` deve importar `services/supabase.ts` diretamente para dados do HiveOps (habilidades, bases de conhecimento, incidências, tarefas, tags, conversas). Se precisar de um dado novo do HiveOps, adicione o método em `HiveOpsProvider` + implemente em `SupabaseHiveOpsProvider` — não chame `getSupabaseClient()` direto do agente/tool/webhook.
- `services/supabase.ts` continua existindo (client singleton + `requireTenantId`/`unwrapOrThrow`), mas só é consumido daqui de dentro.
- Tenant é resolvido internamente (via `LUNA_TENANT_ID`, `requireTenantId`) — a Luna hoje atende um único tenant por deployment; os métodos da interface não recebem `tenantId` como parâmetro.

## Não incluído (ainda)

- `getAgentConfig` — cotado como próximo método (ler o prompt/config da Luna de uma tabela `agents` no Supabase, usando `LUNA_AGENT_ID`), mas essa tabela ainda não existe. Adicionar só quando o schema real existir.
- `findLunaCustomerByPhone` (`agents/luna/customer-lookup.ts`) continua fora do HiveOps — busca no Zendesk, não no Supabase.

## Notas de desenvolvimento

- Os métodos de `SupabaseHiveOpsProvider` são a migração direta do que antes vivia espalhado em `agents/luna/{skills,incidents,knowledge-bases,tasks}.ts`, `agents/luna/memory/supabase-sync.ts` e `webhooks/zendesk/{blocklist,conversation-state}.ts` — sem mudança de comportamento, só de local.
