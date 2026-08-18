import type { GuardrailOutput } from './schema';

interface GenerateResultWithMetadata {
  response?: {
    uiMessages?: Array<{ role: string; metadata?: unknown }>;
  };
}

/**
 * The guardrail runs as an outputProcessor on Luna's agent, so its verdict rides along as
 * metadata on the assistant's ui message instead of being a separate call result.
 */
export function extractGuardrailOutput(result: GenerateResultWithMetadata): GuardrailOutput | null {
  const assistantMessage = result.response?.uiMessages?.find((message) => message.role === 'assistant');
  const metadata = assistantMessage?.metadata as { guardrail?: GuardrailOutput } | undefined;
  return metadata?.guardrail ?? null;
}
