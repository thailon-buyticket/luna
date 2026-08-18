import type { HiveOpsProvider } from './hiveops-provider';
import { SupabaseHiveOpsProvider } from './supabase-hiveops-provider';

let provider: HiveOpsProvider | undefined;

/** Swap the backing provider (e.g. in a test, or the day HiveOps stops being Supabase) here — nowhere else. */
export function getHiveOps(): HiveOpsProvider {
  if (!provider) {
    provider = new SupabaseHiveOpsProvider();
  }
  return provider;
}

export type { HiveOpsProvider } from './hiveops-provider';
export * from './types';
