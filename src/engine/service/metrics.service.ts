/**
 * B-6: Prometheus-compatible metrics export.
 *
 * Collects counters/histograms from MonitoringCallbackHandler and exposes
 * them via /api/metrics endpoint in Prometheus text exposition format.
 */

interface Counter {
  name: string;
  help: string;
  labels: Record<string, string>;
  value: number;
}

interface Histogram {
  name: string;
  help: string;
  labels: Record<string, string>;
  sum: number;
  count: number;
  buckets: Map<number, number>; // le → count
}

const DEFAULT_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

export class MetricsRegistry {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();

  /** Increment a counter */
  inc(name: string, help: string, labels: Record<string, string> = {}, value = 1): void {
    const key = `${name}{${this.labelsToKey(labels)}}`;
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { name, help, labels, value });
    }
  }

  /** Observe a value in a histogram */
  observe(name: string, help: string, labels: Record<string, string> = {}, value: number): void {
    const key = `${name}{${this.labelsToKey(labels)}}`;
    let hist = this.histograms.get(key);
    if (!hist) {
      const buckets = new Map<number, number>();
      for (const b of DEFAULT_BUCKETS) buckets.set(b, 0);
      hist = { name, help, labels, sum: 0, count: 0, buckets };
      this.histograms.set(key, hist);
    }
    hist.sum += value;
    hist.count += 1;
    for (const [le, cnt] of hist.buckets) {
      if (value <= le) hist.buckets.set(le, cnt + 1);
    }
  }

  /** Export in Prometheus text exposition format */
  export(): string {
    const lines: string[] = [];
    const seenHelp = new Set<string>();

    // Counters
    for (const c of this.counters.values()) {
      if (!seenHelp.has(c.name)) {
        lines.push(`# HELP ${c.name} ${c.help}`);
        lines.push(`# TYPE ${c.name} counter`);
        seenHelp.add(c.name);
      }
      lines.push(`${c.name}${this.formatLabels(c.labels)} ${c.value}`);
    }

    // Histograms
    for (const h of this.histograms.values()) {
      if (!seenHelp.has(h.name)) {
        lines.push(`# HELP ${h.name} ${h.help}`);
        lines.push(`# TYPE ${h.name} histogram`);
        seenHelp.add(h.name);
      }
      const lblStr = this.formatLabels(h.labels);
      for (const [le, cnt] of [...h.buckets.entries()].sort((a, b) => a[0] - b[0])) {
        const bLabels = { ...h.labels, le: String(le) };
        lines.push(`${h.name}_bucket${this.formatLabels(bLabels)} ${cnt}`);
      }
      lines.push(`${h.name}_bucket${this.formatLabels({ ...h.labels, le: '+Inf' })} ${h.count}`);
      lines.push(`${h.name}_sum${lblStr} ${h.sum}`);
      lines.push(`${h.name}_count${lblStr} ${h.count}`);
    }

    return lines.join('\n') + '\n';
  }

  /** Reset all metrics */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  private labelsToKey(labels: Record<string, string>): string {
    return Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}="${v}"`).join(',');
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    return `{${entries.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
  }
}

/** Singleton metrics registry */
export const metrics = new MetricsRegistry();

// ─── Convenience helpers for common LLM metrics ─────────

export function recordLlmRequest(model: string, durationMs: number, tokens?: number): void {
  metrics.inc('cmh_llm_requests_total', 'Total LLM requests', { model });
  metrics.observe('cmh_llm_duration_seconds', 'LLM request duration', { model }, durationMs / 1000);
  if (tokens) {
    metrics.inc('cmh_llm_tokens_total', 'Total tokens generated', { model }, tokens);
  }
}

export function recordCacheHit(hit: boolean): void {
  metrics.inc('cmh_cache_requests_total', 'Cache requests', { result: hit ? 'hit' : 'miss' });
}
