/**
 * CMH Chatbot Renderer — Vite 설정
 *
 * engine 빌드는 tsup (package.json build 스크립트),
 * renderer 빌드는 이 Vite 설정을 사용.
 */
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { existsSync, createReadStream, statSync } from 'node:fs'
import { edgeTtsPlugin } from './vite-plugin-edge-tts'

const DEV_LLM_PORT = Number.parseInt(process.env.CMH_LLM_PORT ?? '8080', 10)
const DEV_ENGINE_PORT = Number.parseInt(process.env.CMH_ENGINE_PORT ?? '4000', 10)
const DEV_UI_PORT = Number.parseInt(process.env.CMH_UI_PORT ?? '5200', 10)

/**
 * meteor-component-library CSS 파일이 존재하지 않는 main.css.map을 참조하는 문제 억제.
 * sourceMappingURL 주석을 제거하여 Vite가 map 파일을 찾지 않게 한다.
 */
function stripCssSourcemaps(): Plugin {
  return {
    name: 'strip-meteor-css-sourcemaps',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('meteor-component-library') && id.endsWith('.css')) {
        return {
          code: code.replace(/\/\*[#@]\s*sourceMappingURL=.*?\*\//g, ''),
          map: null,
        }
      }
    },
  }
}

/**
 * models/ 폴더를 /models/ URL 경로로 정적 서빙.
 * ONNX Whisper 모델, GGUF LLM 모델 등을 로컬에서 제공.
 */
function serveModelsDir(): Plugin {
  const modelsRoot = resolve(__dirname, 'models')
  return {
    name: 'serve-models-dir',
    configureServer(server) {
      server.middlewares.use('/models', (req, res, next) => {
        const filePath = resolve(modelsRoot, (req.url ?? '').replace(/^\//, ''))
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  publicDir: resolve(__dirname, 'src/renderer/public'),
  plugins: [vue(), stripCssSourcemaps(), serveModelsDir(), edgeTtsPlugin()],
  resolve: {
    alias: {
      // 런타임 템플릿 컴파일러 포함 빌드 (.html?raw 문자열 template 지원)
      vue: 'vue/dist/vue.esm-bundler.js',
      '@': resolve(__dirname, 'src/renderer'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@core': resolve(__dirname, 'src/renderer/core'),
    },
  },
  css: {
    devSourcemap: false,
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: DEV_UI_PORT,
    strictPort: true,
    open: true,
    proxy: {
      '/llm': {
        target: `http://127.0.0.1:${DEV_LLM_PORT}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llm/, ''),
        // SSE 스트리밍 응답 버퍼링 비활성화 — llama-server 응답이 즉시 클라이언트에 도달
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no'
            proxyRes.headers['cache-control'] = 'no-cache'
          })
        },
      },
      '/api': {
        target: `http://127.0.0.1:${DEV_ENGINE_PORT}`,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no'
            proxyRes.headers['cache-control'] = 'no-cache'
          })
        },
      },
    },
    // models/ 폴더를 /models/ 경로로 정적 서빙 (ONNX Whisper 모델 등)
    fs: {
      allow: [
        resolve(__dirname, '.'),      // 프로젝트 루트 (기본 허용 복원)
        resolve(__dirname, 'models'), // 모델 파일 서빙
      ],
    },
  },
})
