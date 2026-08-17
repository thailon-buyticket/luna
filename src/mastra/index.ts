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
import { luna } from './agents/luna/luna';
import { customerTypeAgent } from './agents/luna-customer-type/luna-customer-type';
import { documentAnalysisAgent } from './agents/luna-document-analysis/luna-document-analysis';
import { lunaGuardrail } from './agents/luna-guardrail/luna-guardrail';
import { imageAnalysisAgent } from './agents/luna-image-analysis/luna-image-analysis';
import { lunaWorkingMemoryAgent } from './agents/luna-working-memory/luna-working-memory';
import { lunaHistoryRoute, lunaReplyRoute } from './routes/luna-api';
import { zendeskWebhookRoute } from './routes/zendesk-webhook';

export const mastra = new Mastra({
  bundler: {
    externals: ['@duckdb/node-bindings'],
  },
  agents: { luna, lunaGuardrail, customerTypeAgent, lunaWorkingMemoryAgent, imageAnalysisAgent, documentAnalysisAgent },
  server: {
    apiRoutes: [lunaReplyRoute, lunaHistoryRoute, zendeskWebhookRoute],
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
