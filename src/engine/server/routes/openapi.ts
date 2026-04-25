export interface OpenApiServerOptions {
  origin?: string
}

export function createOpenApiDocument(options: OpenApiServerOptions = {}) {
  const serverUrl = options.origin ?? 'http://127.0.0.1:4000'

  return {
    openapi: '3.0.3',
    info: {
      title: 'cmh-chatbot API',
      version: '0.2.0',
      description: 'ChatBot Engine API (Hono + Vercel AI SDK + DAL)'
    },
    servers: [
      { url: serverUrl, description: 'Local server' }
    ],
    tags: [
      { name: 'health' },
      { name: 'chat' },
      { name: 'provider' },
      { name: 'workflow' },
      { name: 'cache' },
      { name: 'metrics' },
      { name: 'webhook' }
    ],
    paths: {
      '/health': {
        get: {
          tags: ['health'],
          summary: 'Health check',
          responses: {
            '200': { description: 'Server health status' }
          }
        }
      },
      '/api/health': {
        get: {
          tags: ['health'],
          summary: 'Health check (api alias)',
          responses: {
            '200': { description: 'Server health status' }
          }
        }
      },
      '/api/chat': {
        post: {
          tags: ['chat'],
          summary: 'Streaming chat completion',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: { type: 'array', items: { type: 'object' } },
                    modelId: { type: 'string' },
                    rawModelId: { type: 'string' },
                    system: { type: 'string' },
                    temperature: { type: 'number' },
                    maxTokens: { type: 'integer' }
                  },
                  required: ['messages']
                }
              }
            }
          },
          responses: {
            '200': { description: 'UIMessage stream response' },
            '400': { description: 'Invalid request' },
            '429': { description: 'Rate limited' }
          }
        }
      },
      '/api/generate': {
        post: {
          tags: ['chat'],
          summary: 'Non-streaming text generation',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: { type: 'array', items: { type: 'object' } },
                    modelId: { type: 'string' },
                    rawModelId: { type: 'string' },
                    system: { type: 'string' },
                    temperature: { type: 'number' },
                    maxTokens: { type: 'integer' }
                  },
                  required: ['messages']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Generated text response' },
            '400': { description: 'Invalid request' },
            '429': { description: 'Rate limited' }
          }
        }
      },
      '/api/providers': {
        get: {
          tags: ['provider'],
          summary: 'List providers',
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string' } },
            { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
          ],
          responses: {
            '200': { description: 'Provider list' }
          }
        }
      },
      '/api/providers/{providerId}/models': {
        get: {
          tags: ['provider'],
          summary: 'List models by provider',
          parameters: [
            { name: 'providerId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'Model list' }
          }
        }
      },
      '/api/providers/{providerId}/remote-models': {
        get: {
          tags: ['provider'],
          summary: 'Fetch remote models from cloud provider API',
          parameters: [
            { name: 'providerId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'Remote model list or warning' },
            '404': { description: 'Provider not found' }
          }
        }
      },
      '/api/cache/stats': {
        get: {
          tags: ['cache'],
          summary: 'Get cache stats',
          responses: { '200': { description: 'Cache stats' } }
        }
      },
      '/api/cache/clear': {
        post: {
          tags: ['cache'],
          summary: 'Clear response cache',
          responses: { '200': { description: 'Cache cleared' } }
        }
      },
      '/api/metrics': {
        get: {
          tags: ['metrics'],
          summary: 'Prometheus metrics endpoint',
          responses: { '200': { description: 'Prometheus plaintext metrics' } }
        }
      },
      '/api/webhook/chat': {
        post: {
          tags: ['webhook'],
          summary: 'External webhook-triggered chat',
          responses: {
            '200': { description: 'Webhook response' },
            '400': { description: 'Invalid payload' }
          }
        }
      },
      '/api/workflow': {
        post: {
          tags: ['workflow'],
          summary: 'Run workflow / orchestrator',
          responses: {
            '200': { description: 'Workflow output or stream' },
            '503': { description: 'Orchestrator unavailable' }
          }
        }
      }
    }
  }
}

export function createSwaggerUiHtml(openApiJsonUrl: string): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>cmh-chatbot API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #0b1020; }
      #swagger-ui { min-height: 100vh; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '${openApiJsonUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
      })
    </script>
  </body>
</html>`
}
