// ─── ScheduledTask Entity ────────────────────────────────

export interface ScheduledTask {
  [key: string]: unknown;
  id: string;
  cronExpression: string;
  systemPrompt: string;
  userPrompt: string;
  modelId?: string;
  isActive: boolean;
  callbackType?: 'log' | 'webhook' | 'email';
  callbackTarget?: string;
  lastRunAt?: string;
  lastResult?: string;
  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
}
