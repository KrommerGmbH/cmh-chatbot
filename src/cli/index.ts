import { Command } from 'commander';
import { createChatServer } from '../engine/server/factory.js';

const program = new Command();

program
  .name('cmh-chatbot')
  .description('cmh-chatbot — AI chatbot engine CLI (powered by llama.cpp server)')
  .version('0.2.0');

program
  .command('start')
  .description('Start the chat server with a GGUF model via llama-server')
  .option('-p, --port <port>', 'Listen port for cmh-chatbot server', '4000')
  .option('-H, --host <host>', 'Listen host', '0.0.0.0')
  .option('-m, --model <path>', 'Path to GGUF model file')
  .option('-b, --binary <path>', 'Path to llama-server binary')
  .option('--server-url <url>', 'URL of an already-running llama-server (skips binary spawn)')
  .option('--server-port <port>', 'Port for spawned llama-server', '8080')
  .option('--context-size <size>', 'Context window size', '4096')
  .option('--gpu-layers <n>', 'GPU layers to offload', '0')
  .option('--threads <n>', 'Number of CPU threads')
  .option('--flash-attention', 'Enable flash attention')
  .option('--system <prompt>', 'System prompt')
  .option('--temperature <t>', 'Temperature', '0.7')
  .option('--max-tokens <n>', 'Max tokens per response', '2048')
  .option('--redis-host <host>', 'Redis host')
  .option('--redis-port <port>', 'Redis port', '6379')
  .option('--log-level <level>', 'Log level', 'info')
  .option('--no-mdns', 'Disable mDNS discovery')
  .action(async (opts) => {
    if (!opts.model && !opts.serverUrl) {
      console.error('Error: Either --model <path> or --server-url <url> is required');
      console.error('');
      console.error('Examples:');
      console.error('  cmh-chatbot start --model ./models/model.gguf --binary ./bin/llama-server');
      console.error('  cmh-chatbot start --server-url http://localhost:8080');
      process.exit(1);
    }

    if (opts.model && !opts.serverUrl && !opts.binary) {
      console.error('Error: --binary <path> is required when using --model (managed mode)');
      console.error('Example: cmh-chatbot start --model ./models/model.gguf --binary ./bin/llama-server');
      process.exit(1);
    }

    const server = await createChatServer({
      port: parseInt(opts.port, 10),
      host: opts.host,
      model: {
        modelPath: opts.model,
        serverBinaryPath: opts.binary,
        serverUrl: opts.serverUrl,
        serverPort: opts.serverPort ? parseInt(opts.serverPort, 10) : undefined,
        contextSize: opts.contextSize ? parseInt(opts.contextSize, 10) : undefined,
        gpuLayers: parseInt(opts.gpuLayers, 10),
        threads: opts.threads ? parseInt(opts.threads, 10) : undefined,
        flashAttention: opts.flashAttention ?? false,
        systemPrompt: opts.system,
        temperature: parseFloat(opts.temperature),
        maxTokens: parseInt(opts.maxTokens, 10),
      },
      redis: opts.redisHost
        ? {
            host: opts.redisHost,
            port: parseInt(opts.redisPort, 10),
          }
        : undefined,
      discovery: {
        mdns: opts.mdns !== false,
      },
      dbPath: opts.dbPath || './data/cmh-chatbot.sqlite',
      logLevel: opts.logLevel as any,
    });

    await server.start();

    const shutdown = async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program
  .command('health')
  .description('Check server health')
  .option('-u, --url <url>', 'Server URL', 'http://localhost:4000')
  .action(async (opts) => {
    try {
      const res = await fetch(`${opts.url}/health`);
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to connect:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
