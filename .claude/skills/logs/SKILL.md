---
name: logs
description: "Analisa os logs do servidor Mastra (luna-nova) — transcrição de conversa, tags de tabulação/handoff geradas, erros, transferências pra humano. Use quando o usuário pedir pra checar logs, ver o que aconteceu numa conversa, quais tags foram criadas num handoff, ou depurar um erro do servidor rodando localmente."
---

# Analisar logs (luna-nova)

Este skill existe pra não ter que redescobrir, toda vez, onde o log do servidor está e como ele é
formatado. Ele SÓ cobre o servidor Mastra local (`mastra dev` ou o build em
`.mastra/output/index.mjs`) — não é sobre logs de produção/Zendesk.

## Passo 1 — achar o arquivo de log

Rode:

```bash
.claude/skills/logs/scripts/find-log.sh
```

Esse script acha os processos `mastra dev` / `.mastra/output/index.mjs` rodando agora e sobe a
cadeia de processo pai até achar o fd de stdout apontando pra um arquivo real (processos filhos que
o `mastra dev` spawna a cada restart mandam a saída de volta pro pai por socket, não escrevem
arquivo direto — por isso o script sobe a cadeia em vez de olhar só o PID que bateu no `ps`).

O caminho retornado muda a cada sessão/restart — nunca assuma um caminho fixo, sempre rode o script
de novo. Se ele disser que nenhum processo está rodando, ou que o stdout não está redirecionado pra
arquivo (terminal interativo), avise o usuário: sem esse arquivo, não dá pra analisar histórico —
só o que rodar dali pra frente (e mesmo assim só se alguém redirecionar a saída pra um arquivo).

O arquivo cresce ao longo do dia/sessões — pode ter várias centenas/milhares de linhas com vários
restarts do bundler no meio (linhas `◐ Bundling...` / `Restarting server...`). Isso é normal, não é
um problema a reportar.

## Passo 2 — perguntar o que procurar

Se o usuário já disse o que quer (nome/telefone do cliente, ID da conversa, tipo de evento — ver
lista abaixo), pule direto pra busca. Se não disse (ex.: só invocou o skill), pergunte objetivamente
o que procurar — não é preciso reconfirmar onde está o log, isso já foi resolvido no passo 1.

## Passo 3 — buscar

Formato de cada linha: `[conversa <conversationId>] <mensagem>` (às vezes com um objeto de erro
estruturado logo abaixo, quando é `logConversationError`). Ver `references/log-format.md` pra lista
completa das mensagens que o código emite e o que cada uma significa.

Fluxo típico:

1. **Achar o `conversationId`** a partir do nome/telefone do cliente:
   ```bash
   grep -i 'mensagem recebida de "<nome>"' <arquivo-de-log>
   ```
   A primeira ocorrência já traz o `conversationId` entre colchetes.

2. **Puxar a transcrição inteira** dessa conversa:
   ```bash
   grep -n '<conversationId>' <arquivo-de-log>
   ```

3. **Se a pergunta for sobre tags de handoff/tabulação especificamente**, filtre por essas duas
   mensagens (só aparecem se a conversa realmente chegou a ser transferida pra humano):
   ```bash
   grep -n '<conversationId>' <arquivo-de-log> | grep -i 'tabulação'
   ```
   - `resolvendo tags de tabulação (tipo_cliente: ...)` — início da classificação.
   - `tags de tabulação resolvidas: ...` — resultado final (união das duas listas, já sem
     duplicata). Se vier vazio (`nenhuma`) ou a linha nem aparecer, não teve tag de tabulação —
     não confunda com as tags fixas (`luna`, `luna-transferencia`, motivo do handoff, `tipo_cliente`,
     `evento_hoje`) que entram sempre, ver `references/log-format.md`.
   - `histórico da conversa indisponível` / `histórico vazio` — não deu pra classificar por falta
     de histórico; a conversa foi transferida sem tag de tabulação nenhuma.

   Se nenhuma dessas linhas aparecer pra aquele `conversationId`, a conversa **não passou por
   handoff** ainda — diga isso claramente em vez de inferir tags que não existem.

4. **Erros**: `grep -n 'ERROR' <arquivo-de-log>` pra visão geral, ou filtre por `conversationId` +
   `ERROR` pra erros de uma conversa específica.

## Referência

- [`references/log-format.md`](references/log-format.md) — catálogo de toda mensagem de log
  emitida pelo código (arquivo fonte, texto exato/template, o que significa) e como as tags de
  handoff são montadas.
