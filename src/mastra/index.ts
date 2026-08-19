import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import {
  MastraStorageExporter,
  MastraPlatformExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';
import { luna } from './agents/luna/luna-agent';
import { customerTypeAgent } from './agents/luna-customer-type/luna-customer-type-agent';
import { documentAnalysisAgent } from './agents/luna-document-analysis/luna-document-analysis-agent';
import { lunaGuardrail } from './agents/luna-guardrail/luna-guardrail-agent';
import { imageAnalysisAgent } from './agents/luna-image-analysis/luna-image-analysis-agent';
import { lunaWorkingMemoryAgent } from './agents/luna-working-memory/luna-working-memory-agent';
import { lunaHistoryRoute, lunaAsk } from './routes/luna-api';
import { zendeskWebhookRoute } from './routes/zendesk-webhook';

// Silencia os warnings do AI SDK sobre o embedding model do Mastra rodar em modo de
// compatibilidade de spec (v2 -> v3) — o fallback automático já cobre, é só ruído no log.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

export const mastra = new Mastra({
  bundler: {
    externals: ['@duckdb/node-bindings'],
  },
  agents: { luna, lunaGuardrail, customerTypeAgent, lunaWorkingMemoryAgent, imageAnalysisAgent, documentAnalysisAgent },
  server: {
    apiRoutes: [lunaAsk, lunaHistoryRoute, zendeskWebhookRoute],
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      url: process.env.TURSO_DATABASE_URL || 'file:./mastra.db',
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
