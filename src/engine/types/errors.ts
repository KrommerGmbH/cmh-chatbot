export class ChatBotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChatBotError';
  }
}

export class ProviderError extends ChatBotError {
  constructor(message: string, cause?: unknown) {
    super(message, 'PROVIDER_ERROR', cause);
    this.name = 'ProviderError';
  }
}

export class QueueError extends ChatBotError {
  constructor(message: string, cause?: unknown) {
    super(message, 'QUEUE_ERROR', cause);
    this.name = 'QueueError';
  }
}

export class CircuitOpenError extends ChatBotError {
  constructor(message: string) {
    super(message, 'CIRCUIT_OPEN');
    this.name = 'CircuitOpenError';
  }
}

export class DiscoveryError extends ChatBotError {
  constructor(message: string, cause?: unknown) {
    super(message, 'DISCOVERY_ERROR', cause);
    this.name = 'DiscoveryError';
  }
}
