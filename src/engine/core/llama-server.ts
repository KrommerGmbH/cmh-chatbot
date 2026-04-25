import { spawn, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import type { LlamaModelConfig } from '../types/index.js';
import { ProviderError } from '../types/errors.js';
import type { Logger } from './logger.js';

/**
 * Manages a llama.cpp server process or connects to an external one.
 * Provides the base URL for OpenAI-compatible API calls.
 *
 * Two modes:
 * - **Managed**: spawns llama-server binary as child process (requires `serverBinaryPath`)
 * - **External**: connects to an already-running llama-server (requires `serverUrl`)
 */
export class LlamaServer {
  private process: ChildProcess | null = null;
  private readonly _port: number;
  private readonly _host: string;
  private readonly _external: boolean;
  private _ready = false;

  constructor(
    private readonly config: LlamaModelConfig,
    private readonly logger: Logger,
  ) {
    this._external = !!config.serverUrl;

    if (this._external) {
      const url = new URL(config.serverUrl!);
      this._host = url.hostname;
      this._port = parseInt(url.port, 10) || 8080;
    } else {
      this._port = config.serverPort ?? 8080;
      this._host = config.serverHost ?? '127.0.0.1';
    }
  }

  /** Base URL for OpenAI-compatible API (e.g. `http://127.0.0.1:8080`). */
  get baseUrl(): string {
    if (this._external) return this.config.serverUrl!.replace(/\/$/, '');
    return `http://${this._host}:${this._port}`;
  }

  get port(): number {
    return this._port;
  }

  get isRunning(): boolean {
    return this._external || (this.process !== null && !this.process.killed);
  }

  get isReady(): boolean {
    return this._ready;
  }

  /**
   * Start the llama-server process (managed mode) or validate connectivity (external mode).
   */
  async start(): Promise<void> {
    if (this._external) {
      this.logger.info({ serverUrl: this.config.serverUrl }, 'llama-server:connecting-external');
      await this.waitForReady(10_000, 500);
      this._ready = true;
      this.logger.info({ baseUrl: this.baseUrl }, 'llama-server:external-connected');
      return;
    }

    if (!this.config.serverBinaryPath) {
      throw new ProviderError(
        'Either serverUrl or serverBinaryPath must be provided in LlamaModelConfig',
      );
    }

    if (!this.config.modelPath) {
      throw new ProviderError('modelPath is required in LlamaModelConfig');
    }

    if (this.process) {
      throw new ProviderError('LlamaServer is already running');
    }

    const args = this.buildArgs();
    this.logger.info(
      { binary: this.config.serverBinaryPath, model: this.config.modelPath, port: this._port },
      'llama-server:starting',
    );

    this.process = spawn(this.config.serverBinaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim();
      if (lines) this.logger.debug(lines);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim();
      if (lines) this.logger.debug(lines);
    });

    this.process.on('exit', (code, signal) => {
      this.logger.info({ code, signal }, 'llama-server:exited');
      this.process = null;
      this._ready = false;
    });

    this.process.on('error', (error) => {
      this.logger.error({ error }, 'llama-server:spawn-error');
      this.process = null;
      this._ready = false;
    });

    // Model loading can take a long time on CPU — 120s timeout
    await this.waitForReady(120_000, 1_000);
    this._ready = true;
    this.logger.info({ baseUrl: this.baseUrl }, 'llama-server:ready');
  }

  /**
   * Stop the llama-server process gracefully.
   * No-op in external mode.
   */
  async stop(): Promise<void> {
    if (this._external || !this.process) return;

    this.logger.info('llama-server:stopping');

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill('SIGKILL');
        this.process = null;
        this._ready = false;
        resolve();
      }, 5_000);

      this.process!.on('exit', () => {
        clearTimeout(timeout);
        this.process = null;
        this._ready = false;
        resolve();
      });

      this.process!.kill();
    });
  }

  /**
   * Hot-swap model without restarting the server process.
   * Uses llama.cpp /POST /load endpoint.
   * 
   * Average switch time: 50~200ms (vs 2~5s process restart)
   */
  async loadModel(modelPath: string, contextSize?: number): Promise<void> {
    if (!this._ready) {
      throw new ProviderError('Cannot load model: server is not ready');
    }

    this.logger.info({ modelPath }, 'llama-server:hot-load-start');
    const startTime = Date.now();

    try {
      const res = await fetch(`${this.baseUrl}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelPath,
          ctx_size: contextSize ?? this.config.contextSize ?? 4096,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new ProviderError(`Model load failed with status ${res.status}`);
      }

      // Wait for server to finish loading
      await this.waitForReady(30_000, 200);
      
      const elapsed = Date.now() - startTime;
      this.logger.info({ modelPath, elapsedMs: elapsed }, 'llama-server:hot-load-complete');
    } catch (err) {
      this.logger.error({ error: err, modelPath }, 'llama-server:hot-load-failed');
      throw err;
    }
  }

  /**
   * Unload current model and free VRAM/RAM.
   * Keeps server process running.
   */
  async unloadModel(): Promise<void> {
    if (!this._ready) return;

    try {
      await fetch(`${this.baseUrl}/unload`, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
      });
      this.logger.info('llama-server:model-unloaded');
    } catch {
      // Ignore errors during unload
    }
  }

  // ── Private ──────────────────────────────────────────────

  private buildArgs(): string[] {
    const c = this.config;
    const cpuCount = os.cpus().length;
    const threads = c.threads ?? Math.max(1, Math.floor(cpuCount / 2));

    // ✅ Open WebUI / LlamaCpp 패턴: --model 파라미터를 빼고 시작한다
    // 서버 프로세스는 한번만 시작하고 이후 /load 엔드포인트로 모델만 교체
    return [
      '--port', String(this._port),
      '--host', this._host,
      '--ctx-size', String(c.contextSize ?? 4096),
      '--threads', String(threads),
      '--n-gpu-layers', String(c.gpuLayers ?? 0),
      '--parallel', String(c.serverParallel ?? 4),
      '--nobrowser',
      '--no-warmup',
      ...(c.flashAttention ? ['--flash-attn'] : []),
    ];
  }

  private async waitForReady(timeoutMs: number, intervalMs: number): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      // In managed mode, check if process died
      if (!this._external && this.process?.exitCode != null) {
        throw new ProviderError(
          `llama-server exited with code ${this.process.exitCode} before becoming ready`,
        );
      }

      try {
        const res = await fetch(`${this.baseUrl}/health`, {
          signal: AbortSignal.timeout(2_000),
        });
        if (res.ok) {
          const body = (await res.json()) as { status: string };
          if (body.status === 'ok') return;
        }
      } catch {
        // Not ready yet, keep polling
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new ProviderError(`llama-server did not become ready within ${timeoutMs}ms`);
  }
}
