import fs from 'node:fs';
import type { LlamaModelConfig } from '../types/index.js';
import { ProviderError } from '../types/errors.js';

/**
 * Resolve and validate the GGUF model file path.
 * Throws if modelPath is missing or the file does not exist.
 */
export function resolveModelPath(config: LlamaModelConfig): string {
  if (!config.modelPath) {
    throw new ProviderError('modelPath is required in LlamaModelConfig');
  }

  if (!fs.existsSync(config.modelPath)) {
    throw new ProviderError(`Model file not found: ${config.modelPath}`);
  }

  return config.modelPath;
}
