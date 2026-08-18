import { Agent } from '@mastra/core/agent';
import { guardrailActionSchema } from '../luna-guardrail/schema';
import { LunaGuardrailProcessor } from '../luna-guardrail/output-processor';
import { LunaWorkingMemoryProcessor } from '../luna-working-memory/output-processor';
import { LunaContextProcessor } from './input-processor';
import { lunaSupabaseMemory } from './luna-memory';
import { buildSystemPrompt } from './prompts/system-prompt';
import { buscarDadosClienteTool } from './tools/buscar-dados-cliente-tool';
import { buscarHabilidadeTool } from './tools/buscar-habilidade-tool';
import { criarTarefaTool } from './tools/criar-tarefa-tool';
import { pesquisarBaseConhecimentoTool } from './tools/pesquisar-base-conhecimento-tool';
import { Memory } from '@mastra/memory';
import { conversationMemoryExtractor } from './memory/conversation-memory-extractor';
import { lunaWorkingMemorySchema } from '../luna-working-memory/schema';

// Reexportados aqui pra quem usa a Luna também ter os types/schema do veredito do
// guardrail à mão, sem precisar importar direto de agents/luna-guardrail.
export { guardrailActionSchema };
export type { GuardrailAction, GuardrailOutput } from '../luna-guardrail/schema';

// TODO: tools, workspace, memory and metadata below are still the starter-template
// defaults; revisit once Luna's real prompt and requirements are in AGENTS.md.
export const luna = new Agent({
  id: 'luna',
  name: 'Luna',
  description: 'Atendente virtual oficial da Buyticket',
  metadata: {
    suggestedPrompts: [
      "Preciso de ajuda com o meu pedido #123?",
      "O comprador não me responde, e agora?",
      'Gostaria de cadastrar um evento.',
    ],
  },
  instructions: buildSystemPrompt(),
  model: 'openai/gpt-4.1-mini',
  defaultOptions: {
    maxSteps: 10,
    autoResumeSuspendedTools: true,
    modelSettings: {
      temperature: 0.3,
      topP: 0.3,
      maxRetries: 5,
    },
  },
  tools: {
    buscar_habilidade: buscarHabilidadeTool,
    pesquisar_base_conhecimento: pesquisarBaseConhecimentoTool,
    criar_tarefa: criarTarefaTool,
    buscar_dados_cliente: buscarDadosClienteTool,
  },
  inputProcessors: [new LunaContextProcessor()],
  outputProcessors: [new LunaGuardrailProcessor(), new LunaWorkingMemoryProcessor()],
  memory: new Memory({
    options: {
        generateTitle: false,
        lastMessages: 15,
        observationalMemory: {
          model: 'openai/gpt-5.6-luna',
          observation: {
            extract: [conversationMemoryExtractor],
          },
          scope:'thread'
        },
        workingMemory: {
          enabled: true,
          scope: 'thread',
          schema: lunaWorkingMemorySchema,
          agentManaged: false,
        },
      }
  })
});
