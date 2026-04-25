/**
 * Agent Store
 *
 * Agent & AgentType CRUD, hierarchy management.
 * Uses InMemoryDataAdapter (seed data) for Phase 1.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AgentType, Agent, AgentStatus } from '../../../engine/data/entity/index.js';
import {
  DEFAULT_AGENT_TYPES,
  DEFAULT_AGENTS,
} from '../../../engine/data/seed.js';

export const useAgentStore = defineStore('agent', () => {
  // ─── State ──────────────────────────────────────────────
  const agentTypes = ref<AgentType[]>(structuredClone(DEFAULT_AGENT_TYPES));
  const agents = ref<Agent[]>(structuredClone(DEFAULT_AGENTS));
  const selectedAgentId = ref<string>('');

  // ─── Getters ────────────────────────────────────────────

  /** Active agent types sorted by priority */
  const activeAgentTypes = computed(() =>
    agentTypes.value
      .filter((t) => t.isActive)
      .sort((a, b) => a.priority - b.priority),
  );

  /** Active agents */
  const activeAgents = computed(() =>
    agents.value.filter((a) => a.isActive),
  );

  /** Get agents by type technical name */
  const agentsByType = computed(() => {
    const map = new Map<string, Agent[]>();
    for (const agent of agents.value) {
      const type = agentTypes.value.find((t) => t.id === agent.agentTypeId);
      if (!type) continue;
      const list = map.get(type.technicalName) ?? [];
      list.push(agent);
      map.set(type.technicalName, list);
    }
    return map;
  });

  /** Get child agents of a parent agent */
  function getChildAgents(parentId: string): Agent[] {
    return agents.value.filter((a) => a.parentAgentId === parentId);
  }

  /** Get agent type by id */
  function getAgentType(id: string): AgentType | undefined {
    return agentTypes.value.find((t) => t.id === id);
  }

  /** Get agent type by technical name */
  function getAgentTypeByName(technicalName: string): AgentType | undefined {
    return agentTypes.value.find((t) => t.technicalName === technicalName);
  }

  // ─── Agent CRUD ─────────────────────────────────────────

  function createAgent(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Agent {
    const now = new Date().toISOString();
    const agent = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...data,
    } as Agent;
    agents.value.push(agent);
    return agent;
  }

  function updateAgent(id: string, patch: Partial<Agent>): Agent | undefined {
    const idx = agents.value.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;

    agents.value[idx] = {
      ...agents.value[idx],
      ...patch,
      id, // prevent id override
      updatedAt: new Date().toISOString(),
    };
    return agents.value[idx];
  }

  function deleteAgent(id: string): boolean {
    const idx = agents.value.findIndex((a) => a.id === id);
    if (idx === -1) return false;

    // Also remove child agents recursively
    const children = getChildAgents(id);
    for (const child of children) {
      deleteAgent(child.id);
    }

    agents.value.splice(idx, 1);
    return true;
  }

  function setAgentStatus(id: string, status: AgentStatus): void {
    const agent = agents.value.find((a) => a.id === id);
    if (agent) {
      agent.status = status;
      agent.updatedAt = new Date().toISOString();
    }
  }

  // ─── AgentType CRUD ─────────────────────────────────────

  function createAgentType(data: Omit<AgentType, 'id' | 'createdAt' | 'updatedAt'>): AgentType {
    const now = new Date().toISOString();
    const agentType = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...data,
    } as AgentType;
    agentTypes.value.push(agentType);
    return agentType;
  }

  function updateAgentType(id: string, patch: Partial<AgentType>): AgentType | undefined {
    const idx = agentTypes.value.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;

    agentTypes.value[idx] = {
      ...agentTypes.value[idx],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    return agentTypes.value[idx];
  }

  // ─── Return ─────────────────────────────────────────────

  return {
    // state
    agentTypes,
    agents,
    selectedAgentId,

    // getters
    activeAgentTypes,
    activeAgents,
    agentsByType,

    // methods
    getChildAgents,
    getAgentType,
    getAgentTypeByName,

    // agent CRUD
    createAgent,
    updateAgent,
    deleteAgent,
    setAgentStatus,

    // agent type CRUD
    createAgentType,
    updateAgentType,
  };
});
