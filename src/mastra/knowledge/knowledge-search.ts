import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { embed } from 'ai';
import { env } from '../config/env';
import { requireEnv } from '../config/require-env';
import { getPineconeIndexName, getPineconeStore } from '../services/pinecone';

const RESULTS_LIMIT = 4;

export interface KnowledgeSearchResult {
  score: number;
  title: string;
  text: string;
}

export async function searchKnowledgeOnVectorDB(query: string, knowledgeBaseSlug: string): Promise<KnowledgeSearchResult[]> {
  const { OPENAI_EMBEDDING_MODEL } = requireEnv(
    { OPENAI_EMBEDDING_MODEL: env.OPENAI_EMBEDDING_MODEL },
    'Pinecone embeddings',
  );

  const { embedding } = await embed({
    model: new ModelRouterEmbeddingModel(`openai/${OPENAI_EMBEDDING_MODEL}`),
    value: query,
  });

  const results = await getPineconeStore().query({
    indexName: getPineconeIndexName(),
    queryVector: embedding,
    topK: RESULTS_LIMIT,
    namespace: knowledgeBaseSlug,
  });

  return results.map((result) => ({
    score: result.score,
    title: typeof result.metadata?.title === 'string' ? result.metadata.title : '',
    text: typeof result.metadata?.text === 'string' ? result.metadata.text : '',
  }));
}
