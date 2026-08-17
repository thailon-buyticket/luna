import { PineconeVector } from '@mastra/pinecone';
import { env } from '../config/env';
import { requireEnv } from '../config/require-env';

const PINECONE_STORE_ID = 'buyticket-pinecone';

let store: PineconeVector | undefined;

export function getPineconeStore(): PineconeVector {
  if (!store) {
    const { PINECONE_API_KEY } = requireEnv({ PINECONE_API_KEY: env.PINECONE_API_KEY }, 'Pinecone');
    store = new PineconeVector({ id: PINECONE_STORE_ID, apiKey: PINECONE_API_KEY });
  }
  return store;
}

export function getPineconeIndexName(): string {
  const { PINECONE_INDEX_NAME } = requireEnv({ PINECONE_INDEX_NAME: env.PINECONE_INDEX_NAME }, 'Pinecone');
  return PINECONE_INDEX_NAME;
}
