// ─── Default seed data ──────────────────────────────────
// Shopware translation 패턴 적용 — entity별 _translation 테이블 seed 포함.

import type { LlmProvider } from './entity/llm/llm-provider.entity.js';
import type { LlmModel } from './entity/llm/llm-model.entity.js';
import type { ModelTypeEntity, ModelTypeTranslation } from './entity/model-type/model-type.entity.js';
import type { LanguageEntity, LanguageTranslation } from './entity/language/language.entity.js';
import type { UserEntity } from './entity/user/user.entity.js';
import type { AgentType } from './entity/agent/agent-type.entity.js';
import type { Agent } from './entity/agent/agent.entity.js';
import type { Conversation } from './entity/conversation/conversation.entity.js';
import type { Message } from './entity/conversation/message.entity.js';
import type { InMemoryDataAdapter } from './data-adapter.js';
import type { SqliteDataAdapter } from './sqlite-adapter.js';
import type { Entity, SupportedLocale } from './types.js';

// ─── Entity names ───────────────────────────────────────

export const ENTITY_CMH_LANGUAGE = 'cmh_language';
export const ENTITY_CMH_LANGUAGE_TRANSLATION = 'cmh_language_translation';
export const ENTITY_CMH_USER = 'cmh_user';
export const ENTITY_CMH_MODEL_TYPE = 'cmh_model_type';
export const ENTITY_CMH_MODEL_TYPE_TRANSLATION = 'cmh_model_type_translation';
export const ENTITY_CMH_LLM_PROVIDER = 'cmh_llm_provider';
export const ENTITY_CMH_LLM_PROVIDER_TRANSLATION = 'cmh_llm_provider_translation';
export const ENTITY_CMH_LLM_MODEL = 'cmh_llm_model';
export const ENTITY_CMH_LLM_MODEL_TRANSLATION = 'cmh_llm_model_translation';
export const ENTITY_CMH_AGENT_TYPE = 'cmh_agent_type';
export const ENTITY_CMH_AGENT_TYPE_TRANSLATION = 'cmh_agent_type_translation';
export const ENTITY_CMH_AGENT = 'cmh_agent';
export const ENTITY_CMH_CONVERSATION = 'cmh_conversation';
export const ENTITY_CMH_MESSAGE = 'cmh_message';
export const ENTITY_CMH_MEDIA = 'cmh_media';
export const ENTITY_CMH_MEDIA_FOLDER = 'cmh_media_folder';
export const ENTITY_CMH_RAG_DOCUMENT = 'cmh_rag_document';
export const ENTITY_CMH_SCHEDULED_TASK = 'cmh_scheduled_task';

// ─── Helper ─────────────────────────────────────────────

const now = () => new Date().toISOString();

/** 5개 locale 번역 생성 헬퍼 */
function makeTranslations(
  entityFkField: string,
  entityId: string,
  names: Record<SupportedLocale, string>,
  descriptions?: Record<SupportedLocale, string>,
): Array<Record<string, unknown>> {
  const locales: SupportedLocale[] = ['ko-KR', 'en-GB', 'de-DE', 'zh-CN', 'ja-JP'];
  return locales.map((locale) => ({
    id: crypto.randomUUID(),
    entityId,
    [entityFkField]: entityId,
    locale,
    name: names[locale] ?? names['en-GB'],
    description: descriptions?.[locale] ?? descriptions?.['en-GB'] ?? '',
    createdAt: now(),
    updatedAt: now(),
  }));
}

// ─── Model Type IDs (deterministic) ─────────────────────

const MT_CHAT       = '00000000-0000-0000-0100-000000000001';
const MT_EMBEDDING  = '00000000-0000-0000-0100-000000000002';
const MT_IMAGE      = '00000000-0000-0000-0100-000000000003';
const MT_TTS        = '00000000-0000-0000-0100-000000000004';
const MT_STT        = '00000000-0000-0000-0100-000000000005';
const MT_CODE       = '00000000-0000-0000-0100-000000000006';
const MT_VISION     = '00000000-0000-0000-0100-000000000007';
const MT_MULTIMODAL = '00000000-0000-0000-0100-000000000008';

// ─── Default Model Types ────────────────────────────────

export const DEFAULT_MODEL_TYPES: ModelTypeEntity[] = [
  { id: MT_CHAT, technicalName: 'chat', icon: 'ph:chat-circle-dots', position: 1, isActive: true, createdAt: now(), updatedAt: now() },
  { id: MT_EMBEDDING, technicalName: 'embedding', icon: 'ph:graph', position: 2, isActive: true, createdAt: now(), updatedAt: now() },
  { id: MT_IMAGE, technicalName: 'image', icon: 'ph:image', position: 3, isActive: true, createdAt: now(), updatedAt: now() },
  { id: MT_TTS, technicalName: 'tts', icon: 'ph:speaker-high', position: 4, isActive: true, createdAt: now(), updatedAt: now() },
  { id: MT_STT, technicalName: 'stt', icon: 'ph:microphone', position: 5, isActive: true, createdAt: now(), updatedAt: now() },
  { id: MT_CODE, technicalName: 'code', icon: 'ph:code', position: 6, isActive: true, createdAt: now(), updatedAt: now() },
  { id: MT_VISION, technicalName: 'vision', icon: 'ph:eye', position: 7, isActive: true, createdAt: now(), updatedAt: now() },
  { id: MT_MULTIMODAL, technicalName: 'multimodal', icon: 'ph:cube', position: 8, isActive: true, createdAt: now(), updatedAt: now() },
];

export const DEFAULT_MODEL_TYPE_TRANSLATIONS: ModelTypeTranslation[] = [
  ...makeTranslations('modelTypeId', MT_CHAT,
    { 'ko-KR': '채팅', 'en-GB': 'Chat', 'de-DE': 'Chat', 'zh-CN': '聊天', 'ja-JP': 'チャット' },
    { 'ko-KR': '대화형 텍스트 생성 모델', 'en-GB': 'Conversational text generation models', 'de-DE': 'Konversationale Textgenerierungsmodelle', 'zh-CN': '对话式文本生成模型', 'ja-JP': '会話型テキスト生成モデル' },
  ),
  ...makeTranslations('modelTypeId', MT_EMBEDDING,
    { 'ko-KR': '임베딩', 'en-GB': 'Embedding', 'de-DE': 'Einbettung', 'zh-CN': '嵌入', 'ja-JP': '埋め込み' },
    { 'ko-KR': '텍스트를 벡터로 변환하는 모델', 'en-GB': 'Text to vector embedding models', 'de-DE': 'Text-zu-Vektor-Einbettungsmodelle', 'zh-CN': '文本转向量嵌入模型', 'ja-JP': 'テキストをベクトルに変換するモデル' },
  ),
  ...makeTranslations('modelTypeId', MT_IMAGE,
    { 'ko-KR': '이미지 생성', 'en-GB': 'Image Generation', 'de-DE': 'Bilderzeugung', 'zh-CN': '图像生成', 'ja-JP': '画像生成' },
    { 'ko-KR': '텍스트에서 이미지를 생성하는 모델', 'en-GB': 'Text-to-image generation models', 'de-DE': 'Text-zu-Bild-Generierungsmodelle', 'zh-CN': '文本到图像生成模型', 'ja-JP': 'テキストから画像を生成するモデル' },
  ),
  ...makeTranslations('modelTypeId', MT_TTS,
    { 'ko-KR': '음성 합성 (TTS)', 'en-GB': 'Text-to-Speech (TTS)', 'de-DE': 'Sprachsynthese (TTS)', 'zh-CN': '语音合成 (TTS)', 'ja-JP': '音声合成 (TTS)' },
    { 'ko-KR': '텍스트를 음성으로 변환하는 모델', 'en-GB': 'Text-to-speech synthesis models', 'de-DE': 'Text-zu-Sprache-Synthesemodelle', 'zh-CN': '文本转语音合成模型', 'ja-JP': 'テキストを音声に変換するモデル' },
  ),
  ...makeTranslations('modelTypeId', MT_STT,
    { 'ko-KR': '음성 인식 (STT)', 'en-GB': 'Speech-to-Text (STT)', 'de-DE': 'Spracherkennung (STT)', 'zh-CN': '语音识别 (STT)', 'ja-JP': '音声認識 (STT)' },
    { 'ko-KR': '음성을 텍스트로 변환하는 모델', 'en-GB': 'Speech recognition and transcription models', 'de-DE': 'Spracherkennungs- und Transkriptionsmodelle', 'zh-CN': '语音识别和转录模型', 'ja-JP': '音声認識および文字起こしモデル' },
  ),
  ...makeTranslations('modelTypeId', MT_CODE,
    { 'ko-KR': '코드 생성', 'en-GB': 'Code Generation', 'de-DE': 'Codegenerierung', 'zh-CN': '代码生成', 'ja-JP': 'コード生成' },
    { 'ko-KR': '코드 작성 및 분석 전문 모델', 'en-GB': 'Code writing and analysis models', 'de-DE': 'Code-Schreib- und Analysemodelle', 'zh-CN': '代码编写和分析模型', 'ja-JP': 'コード記述および分析モデル' },
  ),
  ...makeTranslations('modelTypeId', MT_VISION,
    { 'ko-KR': '비전', 'en-GB': 'Vision', 'de-DE': 'Bildverarbeitung', 'zh-CN': '视觉', 'ja-JP': 'ビジョン' },
    { 'ko-KR': '이미지 이해 및 분석 모델', 'en-GB': 'Image understanding and analysis models', 'de-DE': 'Bildverständnis- und Analysemodelle', 'zh-CN': '图像理解和分析模型', 'ja-JP': '画像理解および分析モデル' },
  ),
  ...makeTranslations('modelTypeId', MT_MULTIMODAL,
    { 'ko-KR': '멀티모달', 'en-GB': 'Multimodal', 'de-DE': 'Multimodal', 'zh-CN': '多模态', 'ja-JP': 'マルチモーダル' },
    { 'ko-KR': '텍스트, 이미지, 오디오를 동시 처리하는 모델', 'en-GB': 'Models processing text, image, and audio simultaneously', 'de-DE': 'Modelle, die Text, Bild und Audio gleichzeitig verarbeiten', 'zh-CN': '同时处理文本、图像和音频的模型', 'ja-JP': 'テキスト、画像、音声を同時処理するモデル' },
  ),
] as ModelTypeTranslation[];

// ─── Default Providers ──────────────────────────────────

export const DEFAULT_PROVIDERS: LlmProvider[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Local (llama.cpp)',
    type: 'local-gguf',
    isActive: true,
    priority: 1,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'OpenAI',
    type: 'cloud-api',
    apiKey: null,
    baseUrl: 'https://api.openai.com/v1',
    isActive: true,
    priority: 2,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Anthropic',
    type: 'cloud-api',
    apiKey: null,
    baseUrl: 'https://api.anthropic.com',
    isActive: true,
    priority: 3,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Ollama (Self-hosted)',
    type: 'self-hosted',
    baseUrl: 'http://localhost:11434',
    isActive: false,
    priority: 10,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    name: 'HuggingFace (Transformers.js)',
    description: 'Browser-side ONNX/WASM inference via @huggingface/transformers',
    type: 'local-gguf',
    isActive: true,
    priority: 5,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    name: 'Google AI (Gemini)',
    type: 'cloud-api',
    apiKey: null,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    isActive: true,
    priority: 4,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    name: 'GitHub Copilot (Models)',
    type: 'cloud-api',
    apiKey: null,
    baseUrl: 'https://models.github.ai/inference',
    isActive: true,
    priority: 6,
    createdAt: now(),
    updatedAt: now(),
  },
];

// ─── Default Models ─────────────────────────────────────

export const DEFAULT_MODELS: LlmModel[] = [
  // ── Chat models ───────────────────────────────────────
  {
    id: '00000000-0000-0000-0001-000000000002',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_CHAT,
    name: 'GPT-4o',
    modelId: 'gpt-4o',
    type: 'chat',
    contextLength: 128_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000003',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_CHAT,
    name: 'GPT-4o Mini',
    modelId: 'gpt-4o-mini',
    type: 'chat',
    contextLength: 128_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000004',
    providerId: '00000000-0000-0000-0000-000000000003',
    modelTypeId: MT_CHAT,
    name: 'Claude 3.5 Sonnet',
    modelId: 'claude-3-5-sonnet-20241022',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 8192 },
    createdAt: now(),
    updatedAt: now(),
  },
  // ── Anthropic — 추가 모델 ─────────────────────────────
  {
    id: '00000000-0000-0000-0001-000000000040',
    providerId: '00000000-0000-0000-0000-000000000003',
    modelTypeId: MT_CHAT,
    name: 'Claude 4 Sonnet',
    modelId: 'claude-sonnet-4-20250514',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 16384 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000041',
    providerId: '00000000-0000-0000-0000-000000000003',
    modelTypeId: MT_CHAT,
    name: 'Claude 4 Opus',
    modelId: 'claude-opus-4-20250514',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 32768 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000042',
    providerId: '00000000-0000-0000-0000-000000000003',
    modelTypeId: MT_CHAT,
    name: 'Claude 3.5 Haiku',
    modelId: 'claude-3-5-haiku-20241022',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 8192 },
    createdAt: now(),
    updatedAt: now(),
  },

  // ── OpenAI — 추가 모델 ───────────────────────────────
  {
    id: '00000000-0000-0000-0001-000000000050',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_CHAT,
    name: 'GPT-4.1',
    modelId: 'gpt-4.1',
    type: 'chat',
    contextLength: 1_047_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 32768 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000051',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_CHAT,
    name: 'GPT-4.1 Mini',
    modelId: 'gpt-4.1-mini',
    type: 'chat',
    contextLength: 1_047_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 32768 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000052',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_CHAT,
    name: 'GPT-4.1 Nano',
    modelId: 'gpt-4.1-nano',
    type: 'chat',
    contextLength: 1_047_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 32768 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000053',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_CHAT,
    name: 'o3',
    modelId: 'o3',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 1, maxTokens: 100_000 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000099',
    providerId: '00000000-0000-0000-000000000006',
    modelTypeId: MT_CHAT,
    name: 'Gemini 2.5 Flash Lite',
    modelId: 'gemini-2.5-flash-lite',
    type: 'chat',
    contextLength: 1_048_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 32768 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000054',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_CHAT,
    name: 'o3 Mini',
    modelId: 'o3-mini',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 1, maxTokens: 100_000 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000055',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_CHAT,
    name: 'o4 Mini',
    modelId: 'o4-mini',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 1, maxTokens: 100_000 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000056',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_EMBEDDING,
    name: 'text-embedding-3-small',
    modelId: 'text-embedding-3-small',
    type: 'embedding',
    contextLength: 8191,
    isDefault: true,
    isActive: true,
    isDownloaded: true,
    parameters: {},
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000057',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_EMBEDDING,
    name: 'text-embedding-3-large',
    modelId: 'text-embedding-3-large',
    type: 'embedding',
    contextLength: 8191,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: {},
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000058',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_IMAGE,
    name: 'DALL·E 3',
    modelId: 'dall-e-3',
    type: 'image',
    contextLength: 0,
    isDefault: true,
    isActive: true,
    isDownloaded: true,
    parameters: { size: '1024x1024', quality: 'standard' },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000059',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_TTS,
    name: 'OpenAI TTS-1',
    modelId: 'tts-1',
    type: 'tts',
    contextLength: 0,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { voice: 'alloy' },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000060',
    providerId: '00000000-0000-0000-0000-000000000002',
    modelTypeId: MT_STT,
    name: 'Whisper (OpenAI)',
    modelId: 'whisper-1',
    type: 'stt',
    contextLength: 0,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: {},
    createdAt: now(),
    updatedAt: now(),
  },

  // ── Google Gemini — 전체 라인업 (2026-04) ────────────
  // Gemini 3 시리즈
  {
    id: '00000000-0000-0000-0001-000000000070',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_MULTIMODAL,
    name: 'Gemini 3.1 Pro Preview',
    modelId: 'gemini-3.1-pro-preview',
    type: 'multimodal',
    contextLength: 1_048_576,
    isDefault: true,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 65536 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000071',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_MULTIMODAL,
    name: 'Gemini 3 Flash Preview',
    modelId: 'gemini-3-flash-preview',
    type: 'multimodal',
    contextLength: 1_048_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 65536 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000072',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_MULTIMODAL,
    name: 'Gemini 3.1 Flash-Lite Preview',
    modelId: 'gemini-3.1-flash-lite-preview',
    type: 'multimodal',
    contextLength: 1_048_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 65536 },
    createdAt: now(),
    updatedAt: now(),
  },
  // Gemini 2.5 시리즈
  {
    id: '00000000-0000-0000-0001-000000000073',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_MULTIMODAL,
    name: 'Gemini 2.5 Pro',
    modelId: 'gemini-2.5-pro',
    type: 'multimodal',
    contextLength: 1_048_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 65536 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000074',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_MULTIMODAL,
    name: 'Gemini 2.5 Flash',
    modelId: 'gemini-2.5-flash',
    type: 'multimodal',
    contextLength: 1_048_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 65536 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000075',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_CHAT,
    name: 'Gemini 2.5 Flash-Lite',
    modelId: 'gemini-2.5-flash-lite',
    type: 'chat',
    contextLength: 1_048_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 8192 },
    createdAt: now(),
    updatedAt: now(),
  },
  // Gemini TTS
  {
    id: '00000000-0000-0000-0001-000000000076',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_TTS,
    name: 'Gemini 3.1 Flash TTS Preview',
    modelId: 'gemini-3.1-flash-tts-preview',
    type: 'tts',
    contextLength: 0,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: {},
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000077',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_TTS,
    name: 'Gemini 2.5 Flash TTS Preview',
    modelId: 'gemini-2.5-flash-preview-tts',
    type: 'tts',
    contextLength: 0,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: {},
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000078',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_TTS,
    name: 'Gemini 2.5 Pro TTS Preview',
    modelId: 'gemini-2.5-pro-preview-tts',
    type: 'tts',
    contextLength: 0,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: {},
    createdAt: now(),
    updatedAt: now(),
  },
  // Gemini Embedding
  {
    id: '00000000-0000-0000-0001-000000000079',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_EMBEDDING,
    name: 'Gemini Embedding 2 Preview',
    modelId: 'gemini-embedding-2-preview',
    type: 'embedding',
    contextLength: 8192,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: {},
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000080',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_EMBEDDING,
    name: 'Gemini Embedding',
    modelId: 'gemini-embedding-001',
    type: 'embedding',
    contextLength: 2048,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: {},
    createdAt: now(),
    updatedAt: now(),
  },
  // Gemini 특화 모델
  {
    id: '00000000-0000-0000-0001-000000000081',
    providerId: '00000000-0000-0000-0000-000000000006',
    modelTypeId: MT_MULTIMODAL,
    name: 'Gemini Deep Research Preview',
    modelId: 'deep-research-pro-preview',
    type: 'multimodal',
    contextLength: 1_048_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 65536 },
    createdAt: now(),
    updatedAt: now(),
  },

  // ── GitHub Copilot Models ────────────────────────────
  {
    id: '00000000-0000-0000-0001-000000000100',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'GPT-4o (Copilot)',
    modelId: 'openai/gpt-4o',
    type: 'chat',
    contextLength: 128_000,
    isDefault: true,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000101',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'GPT-4.1 (Copilot)',
    modelId: 'openai/gpt-4.1',
    type: 'chat',
    contextLength: 1_047_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 32768 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000102',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'GPT-4.1 Mini (Copilot)',
    modelId: 'openai/gpt-4.1-mini',
    type: 'chat',
    contextLength: 1_047_576,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 32768 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000103',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'o3-mini (Copilot)',
    modelId: 'openai/o3-mini',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 1, maxTokens: 100_000 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000104',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'o4-mini (Copilot)',
    modelId: 'openai/o4-mini',
    type: 'chat',
    contextLength: 200_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 1, maxTokens: 100_000 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000105',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'DeepSeek-R1 (Copilot)',
    modelId: 'deepseek/DeepSeek-R1',
    type: 'chat',
    contextLength: 64_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000106',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'Grok-3 (Copilot)',
    modelId: 'xai/grok-3',
    type: 'chat',
    contextLength: 131_072,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000107',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'Grok-3-Mini (Copilot)',
    modelId: 'xai/grok-3-mini',
    type: 'chat',
    contextLength: 131_072,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 8192 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000108',
    providerId: '00000000-0000-0000-0000-000000000007',
    modelTypeId: MT_CHAT,
    name: 'MAI-DS-R1 (Copilot)',
    modelId: 'microsoft/MAI-DS-R1',
    type: 'chat',
    contextLength: 64_000,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000005',
    providerId: '00000000-0000-0000-0000-000000000004',
    modelTypeId: MT_CHAT,
    name: 'Llama 3.2 (Ollama)',
    modelId: 'llama3.2',
    type: 'chat',
    contextLength: 128_000,
    isDefault: true,
    isActive: false,
    isDownloaded: true,
    parameters: { temperature: 0.7, maxTokens: 2048 },
    createdAt: now(),
    updatedAt: now(),
  },

  // ── Unsloth GGUF 모델 (2025-07) ──────────────────────
  {
    id: '00000000-0000-0000-0001-000000000010',
    providerId: '00000000-0000-0000-0000-000000000001',
    modelTypeId: MT_CHAT,
    name: 'Qwen 3.5 27B (Q2_K_XL)',
    modelId: 'Qwen3.5-27B-UD-Q2_K_XL',
    type: 'chat',
    contextLength: 262_144,
    isDefault: false,
    isActive: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    filePath: 'models/Qwen3.5-27B-UD-Q2_K_XL.gguf',
    fileSize: 11_800_000_000,
    downloadUrl: 'https://huggingface.co/unsloth/Qwen3.5-27B-UD-GGUF/resolve/main/Qwen3.5-27B-UD-Q2_K_XL.gguf',
    isDownloaded: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000011',
    providerId: '00000000-0000-0000-0000-000000000001',
    modelTypeId: MT_MULTIMODAL,
    name: 'Gemma 4 31B IT (Q2_K_XL)',
    modelId: 'gemma-4-31B-it-UD-Q2_K_XL',
    type: 'multimodal',
    contextLength: 262_144,
    isDefault: false,
    isActive: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    filePath: 'models/gemma-4-31B-it-UD-Q2_K_XL.gguf',
    fileSize: 12_500_000_000,
    downloadUrl: 'https://huggingface.co/unsloth/gemma-4-31B-it-UD-GGUF/resolve/main/gemma-4-31B-it-UD-Q2_K_XL.gguf',
    isDownloaded: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000013',
    providerId: '00000000-0000-0000-0000-000000000001',
    modelTypeId: MT_CHAT,
    name: 'Qwen 3.5 4B (UD-IQ2_XXS)',
    modelId: 'Qwen3.5-4B-UD-IQ2_XXS',
    type: 'chat',
    contextLength: 32_768,
    isDefault: false,
    isActive: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    filePath: 'models/Qwen3.5-4B-UD-IQ2_XXS.gguf',
    fileSize: 1_520_000_000,
    downloadUrl: 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-UD-IQ2_XXS.gguf',
    isDownloaded: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000014',
    providerId: '00000000-0000-0000-0000-000000000001',
    modelTypeId: MT_MULTIMODAL,
    name: 'Gemma 4 E4B IT (Q4_K_XL)',
    modelId: 'gemma-4-E4B-it-UD-Q4_K_XL',
    type: 'multimodal',
    contextLength: 128_000,
    isDefault: true,
    isActive: true,
    parameters: { temperature: 0.7, maxTokens: 4096 },
    filePath: 'models/gemma-4-E4B-it-UD-Q4_K_XL.gguf',
    fileSize: 5_600_000_000,
    downloadUrl: 'https://huggingface.co/unsloth/gemma-4-E4B-it-UD-GGUF/resolve/main/gemma-4-E4B-it-UD-Q4_K_XL.gguf',
    isDownloaded: true,
    createdAt: now(),
    updatedAt: now(),
  },

  // ── STT 모델 ─────────────────────────────────────────
  {
    id: '00000000-0000-0000-0001-000000000020',
    providerId: '00000000-0000-0000-0000-000000000005',
    modelTypeId: MT_STT,
    name: 'Whisper Small (ONNX)',
    description: 'OpenAI Whisper small — multilingual STT, ONNX q4 quantized',
    modelId: 'onnx-community/whisper-small',
    type: 'stt',
    contextLength: 0,
    isDefault: true,
    isActive: true,
    parameters: { dtype: 'q4', device: 'wasm' },
    filePath: 'models/onnx/onnx-community/whisper-small',
    isDownloaded: true,
    createdAt: now(),
    updatedAt: now(),
  },

  // ── TTS 모델 — Edge TTS (Microsoft Edge Neural TTS, 무료) ────
  {
    id: '00000000-0000-0000-0001-000000000030',
    providerId: '00000000-0000-0000-0000-000000000005',
    modelTypeId: MT_TTS,
    name: 'Edge TTS (Recommended)',
    description: 'Microsoft Edge Neural TTS — free, high-quality, 5-language support (ko/en/de/zh/ja).',
    modelId: 'edge-tts',
    type: 'tts',
    contextLength: 0,
    isDefault: true,
    isActive: true,
    isDownloaded: true,
    parameters: {
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
    },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0001-000000000033',
    providerId: '00000000-0000-0000-0000-000000000005',
    modelTypeId: MT_TTS,
    name: 'Web Speech API (Browser)',
    description: 'Browser built-in TTS — no server needed. Fallback when Edge TTS is unavailable.',
    modelId: 'web-speech-api',
    type: 'tts',
    contextLength: 0,
    isDefault: false,
    isActive: true,
    isDownloaded: true,
    parameters: { rate: 1.0, pitch: 1.0, volume: 0.8 },
    createdAt: now(),
    updatedAt: now(),
  },
];

// ─── Default Agent Types ────────────────────────────────

export const DEFAULT_AGENT_TYPES: AgentType[] = [
  {
    id: '00000000-0000-0000-0002-000000000001',
    name: 'Orchestrator',
    technicalName: 'orchestrator',
    description: 'Top-level coordinator that routes user requests to the appropriate manager agents',
    maxConcurrentTasks: 0,
    canHaveChildren: true,
    isActive: true,
    priority: 1,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0002-000000000002',
    name: 'Manager',
    technicalName: 'manager',
    description: 'Mid-level coordinator that decomposes tasks and delegates to worker agents',
    maxConcurrentTasks: 0,
    canHaveChildren: true,
    isActive: true,
    priority: 2,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0002-000000000003',
    name: 'Worker',
    technicalName: 'worker',
    description: 'Leaf-level executor that handles atomic, indivisible tasks',
    maxConcurrentTasks: 3,
    canHaveChildren: false,
    isActive: true,
    priority: 3,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0002-000000000004',
    name: 'Profiler',
    technicalName: 'profiler',
    description: 'Post-chat analysis agent that hooks into LangChain save callbacks',
    maxConcurrentTasks: 1,
    canHaveChildren: false,
    isActive: true,
    priority: 4,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0002-000000000005',
    name: 'Supporter',
    technicalName: 'supporter',
    description: 'Utility agent providing supporting capabilities: web search, RAG retrieval',
    maxConcurrentTasks: 5,
    canHaveChildren: false,
    isActive: true,
    priority: 5,
    createdAt: now(),
    updatedAt: now(),
  },
];

// ─── Default Agents (initial system agents) ─────────────

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: '00000000-0000-0000-0003-000000000001',
    agentTypeId: '00000000-0000-0000-0002-000000000001',
    name: 'Main Orchestrator',
    status: 'idle',
    isActive: true,
    systemPrompt: 'You are the main orchestrator...',
    capabilities: ['routing', 'response-assembly', 'conversation-management'],
    createdAt: now(),
    updatedAt: now(),
  },
  // ── 매니저 에이전트 ───────────────────────────────────
  {
    id: '00000000-0000-0000-0003-000000000010',
    agentTypeId: '00000000-0000-0000-0002-000000000002',
    parentAgentId: '00000000-0000-0000-0003-000000000001',
    name: 'Shopping Manager',
    status: 'idle',
    isActive: true,
    systemPrompt: 'You are the Shopping Manager. Help users with product search, price comparison, shopping recommendations, and purchase decisions.',
    capabilities: ['product-search', 'price-comparison', 'shopping-recommendation'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0003-000000000011',
    agentTypeId: '00000000-0000-0000-0002-000000000002',
    parentAgentId: '00000000-0000-0000-0003-000000000001',
    name: 'Finance Manager',
    status: 'idle',
    isActive: true,
    systemPrompt: 'You are the Finance Manager. Help users with budgeting, expense tracking, investment insights, exchange rates, and financial planning.',
    capabilities: ['budgeting', 'expense-tracking', 'exchange-rate', 'financial-planning'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0003-000000000012',
    agentTypeId: '00000000-0000-0000-0002-000000000002',
    parentAgentId: '00000000-0000-0000-0003-000000000001',
    name: 'Health Manager',
    status: 'idle',
    isActive: true,
    systemPrompt: 'You are the Health Manager. Help users with health tracking, nutrition advice, exercise plans, and wellness tips.',
    capabilities: ['health-tracking', 'nutrition', 'exercise-planning', 'wellness'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0003-000000000013',
    agentTypeId: '00000000-0000-0000-0002-000000000002',
    parentAgentId: '00000000-0000-0000-0003-000000000001',
    name: 'Knowledge Manager',
    status: 'idle',
    isActive: true,
    systemPrompt: 'You are the Knowledge Manager. Help users with research, learning, document analysis, summarization, and knowledge management.',
    capabilities: ['research', 'document-analysis', 'summarization', 'learning'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0003-000000000014',
    agentTypeId: '00000000-0000-0000-0002-000000000002',
    parentAgentId: '00000000-0000-0000-0003-000000000001',
    name: 'Career Manager',
    status: 'idle',
    isActive: true,
    systemPrompt: 'You are the Career Manager. Help users with job search, resume writing, interview preparation, and career development.',
    capabilities: ['job-search', 'resume-writing', 'interview-prep', 'career-planning'],
    createdAt: now(),
    updatedAt: now(),
  },
  // ── 유틸리티 에이전트 ─────────────────────────────────
  {
    id: '00000000-0000-0000-0003-000000000002',
    agentTypeId: '00000000-0000-0000-0002-000000000004',
    name: 'User Profiler',
    status: 'idle',
    isActive: true,
    systemPrompt: 'Analyze chat history to build user profiles...',
    capabilities: ['langchain-hook', 'profile-analysis', 'file-export'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '00000000-0000-0000-0003-000000000003',
    agentTypeId: '00000000-0000-0000-0002-000000000005',
    name: 'Web Search Supporter',
    status: 'idle',
    isActive: true,
    systemPrompt: 'Perform web searches, RAG retrieval...',
    capabilities: ['web-search', 'rag-retrieval', 'api-calls'],
    createdAt: now(),
    updatedAt: now(),
  },
];

// ─── Default Languages ──────────────────────────────────

const LANG_KO = '00000000-0000-0000-0200-000000000001';
const LANG_EN = '00000000-0000-0000-0200-000000000002';
const LANG_DE = '00000000-0000-0000-0200-000000000003';
const LANG_ZH = '00000000-0000-0000-0200-000000000004';
const LANG_JA = '00000000-0000-0000-0200-000000000005';
const LANG_FR = '00000000-0000-0000-0200-000000000006';

export const DEFAULT_LANGUAGES: LanguageEntity[] = [
  { id: LANG_KO, code: 'ko-KR', nativeName: '한국어', icon: '🇰🇷', position: 1, isDefault: true, isActive: true, createdAt: now(), updatedAt: now() },
  { id: LANG_EN, code: 'en-GB', nativeName: 'English', icon: '🇬🇧', position: 2, isDefault: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: LANG_DE, code: 'de-DE', nativeName: 'Deutsch', icon: '🇩🇪', position: 3, isDefault: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: LANG_ZH, code: 'zh-CN', nativeName: '中文', icon: '🇨🇳', position: 4, isDefault: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: LANG_JA, code: 'ja-JP', nativeName: '日本語', icon: '🇯🇵', position: 5, isDefault: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: LANG_FR, code: 'fr-FR', nativeName: 'Français', icon: '🇫🇷', position: 6, isDefault: false, isActive: true, createdAt: now(), updatedAt: now() },
];

export const DEFAULT_LANGUAGE_TRANSLATIONS = [
  ...makeTranslations('languageId', LANG_KO,
    { 'ko-KR': '한국어', 'en-GB': 'Korean', 'de-DE': 'Koreanisch', 'zh-CN': '韩语', 'ja-JP': '韓国語' }),
  ...makeTranslations('languageId', LANG_EN,
    { 'ko-KR': '영어', 'en-GB': 'English', 'de-DE': 'Englisch', 'zh-CN': '英语', 'ja-JP': '英語' }),
  ...makeTranslations('languageId', LANG_DE,
    { 'ko-KR': '독일어', 'en-GB': 'German', 'de-DE': 'Deutsch', 'zh-CN': '德语', 'ja-JP': 'ドイツ語' }),
  ...makeTranslations('languageId', LANG_ZH,
    { 'ko-KR': '중국어', 'en-GB': 'Chinese', 'de-DE': 'Chinesisch', 'zh-CN': '中文', 'ja-JP': '中国語' }),
  ...makeTranslations('languageId', LANG_JA,
    { 'ko-KR': '일본어', 'en-GB': 'Japanese', 'de-DE': 'Japanisch', 'zh-CN': '日语', 'ja-JP': '日本語' }),
  ...makeTranslations('languageId', LANG_FR,
    { 'ko-KR': '프랑스어', 'en-GB': 'French', 'de-DE': 'Französisch', 'zh-CN': '法语', 'ja-JP': 'フランス語' }),
] as LanguageTranslation[];

// ─── Default Users ──────────────────────────────────────

export const DEFAULT_USERS: UserEntity[] = [
  {
    id: '00000000-0000-0000-0300-000000000001',
    name: 'Default User',
    languageId: LANG_KO,
    avatarIcon: 'ph:cat-light',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

// ─── Seed function ──────────────────────────────────────

/**
 * Seed the InMemoryDataAdapter with all default entity data.
 *
 * Order: ModelTypes → Providers → Models → AgentTypes → Agents
 * (translation tables seeded alongside parent entities)
 */
export function seedDefaultData(adapter: InMemoryDataAdapter | SqliteDataAdapter): void {
  // Languages + Translations
  adapter.seed<LanguageEntity>(ENTITY_CMH_LANGUAGE, DEFAULT_LANGUAGES);
  adapter.seed(ENTITY_CMH_LANGUAGE_TRANSLATION, DEFAULT_LANGUAGE_TRANSLATIONS as unknown as Entity[]);

  // Users
  adapter.seed<UserEntity>(ENTITY_CMH_USER, DEFAULT_USERS);

  // Model Types + Translations
  adapter.seed<ModelTypeEntity>(ENTITY_CMH_MODEL_TYPE, DEFAULT_MODEL_TYPES);
  adapter.seed(ENTITY_CMH_MODEL_TYPE_TRANSLATION, DEFAULT_MODEL_TYPE_TRANSLATIONS as unknown as Entity[]);

  // Providers + Translations
  adapter.seed<LlmProvider>(ENTITY_CMH_LLM_PROVIDER, DEFAULT_PROVIDERS);
  adapter.seed(ENTITY_CMH_LLM_PROVIDER_TRANSLATION, [] as Entity[]);

  // Models (chat + stt + tts) + Translations
  adapter.seed<LlmModel>(ENTITY_CMH_LLM_MODEL, DEFAULT_MODELS);
  adapter.seed(ENTITY_CMH_LLM_MODEL_TRANSLATION, [] as Entity[]);

  // Agent Types + Translations + Agents
  adapter.seed<AgentType>(ENTITY_CMH_AGENT_TYPE, DEFAULT_AGENT_TYPES);
  adapter.seed(ENTITY_CMH_AGENT_TYPE_TRANSLATION, [] as Entity[]);
  adapter.seed<Agent>(ENTITY_CMH_AGENT, DEFAULT_AGENTS);

  // Conversations + Messages (empty — created at runtime)
  adapter.seed<Conversation>(ENTITY_CMH_CONVERSATION, []);
  adapter.seed<Message>(ENTITY_CMH_MESSAGE, []);

  // Media, RAG, Scheduled Tasks (empty — created at runtime)
  adapter.seed(ENTITY_CMH_MEDIA, [] as Entity[]);
  adapter.seed(ENTITY_CMH_MEDIA_FOLDER, [] as Entity[]);
  adapter.seed(ENTITY_CMH_RAG_DOCUMENT, [] as Entity[]);
  adapter.seed(ENTITY_CMH_SCHEDULED_TASK, [] as Entity[]);
}
