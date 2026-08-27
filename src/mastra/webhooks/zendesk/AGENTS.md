# AGENTS.md — webhooks/zendesk

Leia este arquivo antes de alterar qualquer coisa nesta pasta ou em `routes/zendesk-webhook.ts`.

## Objetivo

Ponto de entrada único pro fluxo "mensagem nova do Zendesk chegou" (WhatsApp via Sunshine Conversations): recebe o webhook, autentica, prepara a mensagem (bloqueio, mídia normalizada pra texto), junta com outras mensagens próximas no tempo da mesma conversa (buffer) e manda pra Luna, aplicando a decisão do guardrail. Toda a lógica vive em `routes/zendesk-webhook.ts`; esta pasta só tem os módulos de apoio (schema, normalização, buffer, tags de handoff, ticket fields).

## Fluxo (`routes/zendesk-webhook.ts`)

1. **Autenticação** — `x-api-key` (header) precisa bater com `ZENDESK_WEBHOOK_SECRET`, e `webhook.id` (corpo) com `ZENDESK_WEBHOOK_ID`. Qualquer um errado → `401`. A rota continua com `requiresAuth: false` no Mastra porque o Zendesk não manda o header `Authorization` da nossa API (`SimpleAuth`) — essa é uma auth própria, específica do Zendesk.
2. **Validação do payload** — `zendeskWebhookSchema` valida o envelope (`app`, `webhook`, `events`); cada `event.payload` é validado individualmente por `conversationMessageSchema`. Evento inválido é **logado** (`logWarning`) e ignorado (`continue`) — não derruba o request nem os outros eventos do mesmo batch.
3. **Resposta imediata** — `{ received: true }` é devolvido antes de qualquer processamento de negócio. Todo o resto roda em background (`void onNewZendeskMessageReceived(...).catch(...)`); erro nesse caminho nunca chega ao Zendesk, só vai pro log.
4. **Normalização** (`normalizeIncomingMessage` em `zendesk.ts`) — resolve tipo de mídia (text/image/video/sticker/audio/file), extrai telefone do cliente e marca se a mensagem é da empresa.
5. **Mensagem da empresa** (`isFromCompany`) — se o autor for a própria Luna (eco do Zendesk), ignora. Qualquer outro humano da empresa escrevendo → `connectHuman` imediato com tag `luna-interrompida`, sem buffer.
6. **Contato bloqueado ou palavra-chave de bypass** (`isContactBlocked` || `isMessageKeywordToBypassAgent`) — pula a Luna e vai direto pro humano (`connectHuman` com tag `luna-interrompida`) quando: (a) existe um usuário no Zendesk com esse telefone/`externalId` que carregue alguma tag de handoff do HiveOps, OU (b) a mensagem do cliente é **exatamente igual** a uma das palavras-chave de bypass (`BYPASS_AGENT_KEYWORDS` — hoje só `"Vamo!"`). **Se a busca de bloqueio falhar** (Zendesk ou HiveOps fora do ar), loga o erro e segue o fluxo assumindo que o contato **não** está bloqueado — nunca trava a Luna por causa dessa checagem; a palavra-chave de bypass não depende de chamada externa, então não tem esse modo de falha.
7. **Sticker é ignorado** — mensagem do tipo `sticker` é logada e descartada (`return`) antes de qualquer transformação ou buffer. Não gera resposta da Luna, não entra no buffer.
8. **Normaliza mídia pra texto** (`transformMessageInTextWithAI`) — texto passa direto; imagem/áudio/arquivo vão pra análise por IA/transcrição; vídeo vira o placeholder `[Usuário enviou um vídeo, confirme o recebimento]` (mensagem instrutiva pra Luna, não um texto pro cliente).
9. **Buffer** (`bufferMessage`) — junta mensagens curtas em sequência do mesmo cliente numa única pergunta pra Luna. Janela padrão **35s** (`LUNA_MESSAGE_BUFFER_MS`), reinicia a cada mensagem nova na mesma conversa.
10. **Chama a Luna** (`askLunaWithFallback`) — até 3 tentativas (`LUNA_ASK_MAX_ATTEMPTS`) em erro transitório. Esgotou as tentativas → mensagem de erro técnico + aviso de alto volume, transfere com tag `luna-erro`.
11. **Guardrail** — `reply`/`reply_and_connect_human` envia a resposta; `connect_human`/`reply_and_connect_human` envia aviso de handoff (se configurado no `business/`), resolve tags de tabulação (`createTicketTagsWithAI`) e chama `connectHuman`.

## Tags de handoff (`buildHandoffTags`)

- `luna-interrompida` — humano da empresa assumiu a conversa, OU contato está bloqueado, OU mensagem bateu com uma palavra-chave de bypass (mesma tag pros três casos, não se distingue tabulação por origem — só o log de conversa diferencia).
  - Empresa assumiu a conversa: vai via `buildHandoffTags`, então leva também `luna` e `luna-transferencia` (`BASE_HANDOFF_TAGS`).
  - Contato bloqueado ou bypass: manda só `['luna-interrompida']`, sem `BASE_HANDOFF_TAGS` — a Luna nem chegou a entrar na conversa nesses casos, então não faz sentido marcar como se ela tivesse transferido.
- `luna-erro` — Luna esgotou as tentativas sem gerar resposta.
- Motivo dado pelo guardrail (`connect_human`, `reply_and_connect_human`) quando é a própria Luna decidindo transferir.
- Tags de tabulação (`createTicketTagsWithAI`, agentes de `agents/tags/`) somadas só nesse último caso — nunca nos handoffs de `luna-interrompida`/`luna-erro`.

## Regras

- **Erros de infraestrutura nunca devem impedir a Luna de responder.** Qualquer checagem auxiliar (hoje: `isContactBlocked`) que dependa de uma chamada externa (Zendesk, HiveOps) precisa de `try/catch` com fallback pro comportamento mais permissivo (aqui, "não bloqueado") + log do erro. Erro não pode travar a conversa.
- **Evento de webhook inválido nunca deve ser descartado em silêncio.** Sempre logar (`logWarning`) antes do `continue` — se o Zendesk mudar o formato do payload, isso precisa aparecer no log, não só desaparecer.
- **Sticker não gera pergunta pra Luna nem entra no buffer.** Se precisar mudar esse comportamento no futuro, o ponto certo é o `if (zendeskPayload.mediaType === 'sticker')` logo antes de `transformMessageInTextWithAI` em `onNewZendeskMessageReceived`.
- **Mensagem da empresa nunca passa pelo buffer.** Handoff é sempre imediato quando um humano escreve na conversa, mesmo que a Luna esteja no meio de uma janela de buffer pra aquele cliente.
- Logs de tabulação (`createTicketTagsWithAI`) devem sempre indicar o motivo de não gerar tags (histórico indisponível/vazio) e, quando gerar, quais tags foram resolvidas — isso é o que o time de suporte usa pra auditar por que um handoff chegou sem tabulação.

## Não incluído (ainda)

- Verificação de assinatura HMAC do Zendesk (`X-Api-Signature`) — a autenticação hoje é só `x-api-key` + `webhook.id`, sem validar assinatura do corpo.
- Retry pra falhas fora da chamada à Luna (ex.: `isContactBlocked`, `connectHuman`) — hoje só a chamada à Luna (`askLunaWithFallback`) tem retry.
