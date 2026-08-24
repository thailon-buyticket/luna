import type { CustomerTypeCategory } from '../agents/luna-customer-type/schema';
import type { ConversationMemory } from '../agents/luna/memory/conversation-memory-schema';

export interface HiveOpsSkill {
  slug: string;
  intent: string;
}

export interface HiveOpsSkillDetail {
  name: string;
  intent: string;
  slots: unknown;
  rules: unknown;
  fallback: unknown;
  notes: string | null;
}

export interface HiveOpsIncident {
  title: string;
  content: string;
}

export interface HiveOpsKnowledgeBase {
  slug: string;
  description: string;
}

export interface HiveOpsPriorityTag {
  title: string;
  description: string;
}

export interface HiveOpsAgentConfig {
  systemPrompt: string;
  guardrailPrompt: string;
}

export type HiveOpsTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateHiveOpsTaskInput {
  type: string;
  priority: HiveOpsTaskPriority;
  input: Record<string, unknown>;
  conversationId: string | undefined;
}

export interface UpsertConversationMemoryInput extends Partial<ConversationMemory> {
  conversationId: string;
  resourceId?: string;
  customer_type?: CustomerTypeCategory;
}
