// ─── Agent Seeder ────────────────────────────────────────
// Seeds the default orchestrator + 14 domain manager agents
// on first initialization. These agents cannot be deleted by users.

import type { Agent } from '../entity/agent.entity.js';

/**
 * Default agent type IDs — must match seeded AgentType records.
 * These are stable UUIDs used across all installations.
 */
export const AGENT_TYPE_IDS = {
  orchestrator: '00000000-0000-4000-a000-000000000001',
  manager: '00000000-0000-4000-a000-000000000002',
  worker: '00000000-0000-4000-a000-000000000003',
  profiler: '00000000-0000-4000-a000-000000000004',
  supporter: '00000000-0000-4000-a000-000000000005',
} as const;

/**
 * Default Orchestrator agent ID.
 */
export const ORCHESTRATOR_ID = '10000000-0000-4000-b000-000000000001';

/**
 * Domain manager definitions — 14 domains.
 */
interface ManagerSeed {
  id: string;
  domain: string;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  rolePrompt: string;
  missionPrompt: string;
  position: number;
}

export const DEFAULT_MANAGERS: ManagerSeed[] = [
  {
    id: '20000000-0000-4000-b000-000000000001',
    domain: 'shopping',
    name: '쇼핑 매니저',
    nameEn: 'Shopping Manager',
    icon: 'ph:shopping-cart',
    color: '#FF6B6B',
    rolePrompt: '당신은 사용자의 쇼핑을 돕는 전문 에이전트입니다. 최저가 탐색, 역경매, 공동구매 매칭을 통해 사용자가 최적의 가격으로 상품을 구매할 수 있도록 지원합니다.',
    missionPrompt: '최저가 탐색, 역경매 진행, 공동구매 매칭을 수행하여 사용자의 구매 비용을 최소화합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000002',
    domain: 'finance',
    name: '금융 매니저',
    nameEn: 'Finance Manager',
    icon: 'ph:bank',
    color: '#4ECDC4',
    rolePrompt: '당신은 사용자의 금융 자산을 관리하는 전문 에이전트입니다. 투자, 자산 관리, 대환 대출, 보험금 청구 등 금융 전반을 지원합니다.',
    missionPrompt: '투자 분석, 자산 포트폴리오 관리, 대환 대출 비교, 보험금 청구 절차 안내를 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000003',
    domain: 'health',
    name: '건강 매니저',
    nameEn: 'Health Manager',
    icon: 'ph:heartbeat',
    color: '#45B7D1',
    rolePrompt: '당신은 사용자의 건강 관리를 돕는 전문 에이전트입니다. 의료비 절감, 영양제 최적화, 건강보험료 관리를 지원합니다.',
    missionPrompt: '의료비 절감 방안 탐색, 영양제 조합 최적화, 건강보험료 관리 및 절약 방법을 안내합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000004',
    domain: 'knowledge',
    name: '지식 매니저',
    nameEn: 'Knowledge Manager',
    icon: 'ph:book-open-text',
    color: '#96CEB4',
    rolePrompt: '당신은 사용자의 지식 관리와 정보 수집을 돕는 전문 에이전트입니다. 수익형 정보 수집, 유료 강의 요약, 트렌드 분석을 수행합니다.',
    missionPrompt: '수익 창출에 도움이 되는 정보 수집, 유료 강의 핵심 요약, 산업 트렌드 분석을 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000005',
    domain: 'administration',
    name: '행정 매니저',
    nameEn: 'Administration Manager',
    icon: 'ph:buildings',
    color: '#FFEAA7',
    rolePrompt: '당신은 행정·세무 업무를 돕는 전문 에이전트입니다. 환급금 찾기, 정부 지원금 신청, 세금 감면 방법을 안내합니다.',
    missionPrompt: '미수령 환급금 조회, 정부 지원금 자격 확인 및 신청 안내, 세금 감면 가능 항목을 분석합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000006',
    domain: 'home',
    name: '가정 매니저',
    nameEn: 'Home Manager',
    icon: 'ph:house',
    color: '#DDA0DD',
    rolePrompt: '당신은 가정 경제를 관리하는 전문 에이전트입니다. 고정비 절감, 중고 자산 처분, 부동산 가치 관리를 지원합니다.',
    missionPrompt: '고정 지출 최적화, 중고 자산 처분 전략, 부동산 가치 유지 및 상승 방안을 분석합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000007',
    domain: 'career',
    name: '직업 매니저',
    nameEn: 'Career Manager',
    icon: 'ph:briefcase',
    color: '#74B9FF',
    rolePrompt: '당신은 사용자의 직업·경력 관리를 돕는 전문 에이전트입니다. 부업 매칭, 연봉 협상 데이터, 이직 기회 포착을 지원합니다.',
    missionPrompt: '부업 매칭, 연봉 협상을 위한 시장 데이터 분석, 이직 기회 탐색 및 추천을 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000008',
    domain: 'social',
    name: '소셜 매니저',
    nameEn: 'Social Manager',
    icon: 'ph:users-three',
    color: '#A29BFE',
    rolePrompt: '당신은 사용자의 인적 네트워크와 소셜 활동을 관리하는 전문 에이전트입니다. 비즈니스 네트워킹, 인플루언서 수익화, 인적 자원 관리를 지원합니다.',
    missionPrompt: '비즈니스 네트워킹 전략, 인플루언서 채널 수익화, 인적 자원 관리 최적화를 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000009',
    domain: 'safety',
    name: '안전 매니저',
    nameEn: 'Safety Manager',
    icon: 'ph:shield-check',
    color: '#FD79A8',
    rolePrompt: '당신은 사용자의 안전과 리스크 관리를 돕는 전문 에이전트입니다. 사기 방지, 리스크 관리, 법률 분쟁 예방을 지원합니다.',
    missionPrompt: '사기 패턴 탐지, 리스크 평가 및 관리, 법률 분쟁 예방을 위한 사전 검토를 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000010',
    domain: 'leisure',
    name: '여가 매니저',
    nameEn: 'Leisure Manager',
    icon: 'ph:airplane-tilt',
    color: '#FDCB6E',
    rolePrompt: '당신은 사용자의 여가 활동을 최적화하는 전문 에이전트입니다. 가성비 여행, 멤버십 혜택 극대화, 마일리지 효율화를 지원합니다.',
    missionPrompt: '여행 가성비 분석, 멤버십 혜택 극대화, 항공 마일리지 최적 사용 전략을 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000011',
    domain: 'personal',
    name: '개인 매니저',
    nameEn: 'Personal Manager',
    icon: 'ph:user-circle',
    color: '#6C5CE7',
    rolePrompt: '당신은 사용자의 개인 성장을 돕는 전문 에이전트입니다. 자기계발 수익화, 시간 관리, 퍼스널 브랜딩을 지원합니다.',
    missionPrompt: '자기계발 수익화 방안, 시간 관리 최적화, 퍼스널 브랜드 구축 전략을 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000012',
    domain: 'distribution',
    name: '유통 매니저',
    nameEn: 'Distribution Manager',
    icon: 'ph:package',
    color: '#00B894',
    rolePrompt: '당신은 유통·물류를 관리하는 전문 에이전트입니다. 위탁 판매 자동화, 재고 관리, 물류 비용 최적화를 지원합니다.',
    missionPrompt: '위탁 판매 프로세스 자동화, 재고 최적 수준 유지, 물류 비용 절감 방안을 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000013',
    domain: 'marketing',
    name: '마케팅 매니저',
    nameEn: 'Marketing Manager',
    icon: 'ph:megaphone',
    color: '#E17055',
    rolePrompt: '당신은 마케팅 전략을 수립하고 실행하는 전문 에이전트입니다. 광고 효율 분석, 콘텐츠 자동 생성, 수익형 채널 운영을 지원합니다.',
    missionPrompt: '광고 ROI 분석, 콘텐츠 자동 생성 파이프라인 운영, 수익형 채널 최적화를 수행합니다.',
    position: 2,
  },
  {
    id: '20000000-0000-4000-b000-000000000014',
    domain: 'arbitration',
    name: '중재 매니저',
    nameEn: 'Arbitration Manager',
    icon: 'ph:scales',
    color: '#636E72',
    rolePrompt: '당신은 계약 검토, 분쟁 합의, 대리 협상을 수행하는 전문 에이전트입니다. 법률적 관점에서 사용자의 이익을 보호합니다.',
    missionPrompt: '계약서 검토 및 리스크 분석, 분쟁 합의안 도출, 대리 협상 전략 수립을 수행합니다.',
    position: 2,
  },
];

/**
 * Generate the full list of seed agents (orchestrator + 14 managers).
 * Call this on first app initialization to populate the DB.
 */
export function generateDefaultAgents(): Agent[] {
  const now = new Date().toISOString();

  // 1. Orchestrator
  const orchestrator: Agent = {
    id: ORCHESTRATOR_ID,
    agentTypeId: AGENT_TYPE_IDS.orchestrator,
    name: '메인 오케스트레이터',
    status: 'idle',
    parentAgentId: null,
    rolePrompt: '당신은 전체 에이전트 시스템을 총괄하는 메인 오케스트레이터입니다. 사용자의 요청을 분석하여 적절한 도메인 매니저에게 작업을 위임하고, 결과를 종합하여 최적의 응답을 제공합니다.',
    missionPrompt: '사용자 요청을 분석하고, 14개 도메인 매니저를 적재적소에 배치하여 최적의 결과를 도출합니다. 복합 요청은 여러 매니저에게 병렬 위임합니다.',
    userPrompt: null,
    systemPrompt: null,
    modelId: null,
    subModelId: null,
    parameters: null,
    currentTasks: null,
    capabilities: null,
    langchainConfig: {
      tools: [],
      callbacks: ['monitoring', 'logging'],
      tracing: true,
    },
    config: null,
    isActive: true,
    isDeletable: false,
    position: 1,
    icon: 'ph:crown',
    color: '#189EFF',
    domain: 'orchestrator',
    createdAt: now,
    updatedAt: now,
  };

  // 2. 14 Domain Managers
  const managers: Agent[] = DEFAULT_MANAGERS.map((m) => ({
    id: m.id,
    agentTypeId: AGENT_TYPE_IDS.manager,
    name: m.name,
    status: 'idle' as const,
    parentAgentId: ORCHESTRATOR_ID,
    rolePrompt: m.rolePrompt,
    missionPrompt: m.missionPrompt,
    userPrompt: null,
    systemPrompt: null,
    modelId: null,
    subModelId: null,
    parameters: null,
    currentTasks: null,
    capabilities: null,
    langchainConfig: {
      tools: [],
      callbacks: ['monitoring'],
      tracing: false,
    },
    config: null,
    isActive: true,
    isDeletable: false,
    position: m.position,
    icon: m.icon,
    color: m.color,
    domain: m.domain,
    createdAt: now,
    updatedAt: now,
  }));

  return [orchestrator, ...managers];
}

/**
 * Seed agents into a repository.
 * Skips agents that already exist (by ID).
 */
export async function seedDefaultAgents(
  repository: { search: (criteria: any) => Promise<{ data: any[] }>; save: (entity: any) => Promise<void> },
): Promise<{ seeded: number; skipped: number }> {
  const agents = generateDefaultAgents();
  const existing = await repository.search({ limit: 1000 });
  const existingIds = new Set(existing.data.map((a: any) => a.id));

  let seeded = 0;
  let skipped = 0;

  for (const agent of agents) {
    if (existingIds.has(agent.id)) {
      skipped++;
      continue;
    }
    await repository.save(agent);
    seeded++;
  }

  return { seeded, skipped };
}
