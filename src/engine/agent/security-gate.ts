import type {
  SecurityAction,
  SecurityAuditEntry,
  SecurityGateCallbacks,
} from '../types/index.js';
import type { Logger } from '../core/logger.js';

/**
 * Security Gate — validates agent actions before execution.
 * Host app provides the actual validation callbacks.
 * Library provides the pipeline structure.
 */
export class SecurityGate {
  constructor(
    private readonly callbacks: SecurityGateCallbacks,
    private readonly logger: Logger,
  ) {}

  /**
   * Validate an action request from an agent.
   * Returns true if the action is approved, false if denied.
   */
  async validate(action: SecurityAction): Promise<boolean> {
    this.logger.debug({ action: action.type, agent: action.agentId }, 'security:validate');

    // Step 1: pre-filter (fast deny for known-bad patterns)
    if (this.callbacks.preFilter) {
      const allowed = await this.callbacks.preFilter(action);
      if (!allowed) {
        this.logger.warn({ action: action.type, agent: action.agentId }, 'security:pre-filter-denied');
        return false;
      }
    }

    // Step 2: level-based flow
    if (action.securityLevel === 'auto') {
      return this.callbacks.validate(action);
    }

    if (action.securityLevel === 'notify') {
      await this.callbacks.onNotify?.(action);
      return this.callbacks.validate(action);
    }

    if (action.securityLevel === 'approve') {
      const approved = await this.callbacks.onApprove?.(action);
      if (approved === false) {
        this.logger.warn({ action: action.type, agent: action.agentId }, 'security:user-denied');
        await this.auditLog(action, false);
        return false;
      }
    }

    // Step 3: main validation
    const result = await this.callbacks.validate(action);

    // Step 4: audit log
    await this.auditLog(action, result);

    return result;
  }

  private async auditLog(action: SecurityAction, approved: boolean): Promise<void> {
    if (this.callbacks.onAudit) {
      await this.callbacks.onAudit({
        action,
        approved,
        timestamp: new Date(),
      });
    }
  }
}
