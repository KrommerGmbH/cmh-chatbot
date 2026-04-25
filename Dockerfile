# ── Build stage ──────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsup.config.ts ./
COPY src/ src/

RUN pnpm build

# ── llama.cpp server binary stage ────────────────────────
# Build llama-server from source for the target platform.
# For pre-built binaries, mount via volume instead.
FROM alpine:3.20 AS llama-builder

RUN apk add --no-cache cmake g++ make git
RUN git clone --depth=1 --branch b8712 https://github.com/ggerganov/llama.cpp.git /llama \
    && cd /llama \
    && cmake -B build -DGGML_STATIC=ON -DLLAMA_SERVER=ON \
    && cmake --build build --target llama-server -j$(nproc)

# ── Production stage ─────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# llama-server binary
COPY --from=llama-builder /llama/build/bin/llama-server /usr/local/bin/llama-server
RUN chmod +x /usr/local/bin/llama-server

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# Default model directory (mount GGUF files here)
RUN mkdir -p /models

EXPOSE 4000 8080

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/cli/index.mjs", "start"]
CMD ["--port", "4000", "--binary", "/usr/local/bin/llama-server", "--model", "/models/model.gguf"]
