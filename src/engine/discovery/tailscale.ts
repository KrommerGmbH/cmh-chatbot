import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Logger } from '../core/logger.js';

const exec = promisify(execFile);

export interface TailscaleStatus {
  available: boolean;
  running: boolean;
  ip?: string;
  hostname?: string;
  magicDNS?: string;
}

/**
 * Tailscale CLI integration for WAN-level discovery.
 * Returns Tailscale IP and status — host app is responsible for
 * actually configuring Tailscale network (ACLs, tags, etc.).
 */
export class TailscaleDiscovery {
  constructor(private readonly logger: Logger) {}

  /**
   * Check Tailscale daemon status and retrieve node info.
   */
  async getStatus(): Promise<TailscaleStatus> {
    const notAvailable: TailscaleStatus = { available: false, running: false };

    try {
      const { stdout } = await exec('tailscale', ['status', '--json'], {
        timeout: 5_000,
      });

      const json = JSON.parse(stdout);
      const self = json.Self;

      if (!self) {
        this.logger.warn('tailscale:no-self');
        return { available: true, running: false };
      }

      const ip = self.TailscaleIPs?.[0] ?? undefined;
      const hostname = self.HostName ?? undefined;
      const magicDNS = self.DNSName?.replace(/\.$/, '') ?? undefined;

      this.logger.info({ ip, hostname, magicDNS }, 'tailscale:status');

      return {
        available: true,
        running: true,
        ip,
        hostname,
        magicDNS,
      };
    } catch (error) {
      if (isENOENT(error)) {
        this.logger.debug('tailscale:not-installed');
        return notAvailable;
      }

      this.logger.warn({ error }, 'tailscale:status-error');
      return notAvailable;
    }
  }

  /**
   * Get peers on the Tailscale network.
   */
  async getPeers(): Promise<Array<{ hostname: string; ip: string; online: boolean }>> {
    try {
      const { stdout } = await exec('tailscale', ['status', '--json'], {
        timeout: 5_000,
      });

      const json = JSON.parse(stdout);
      const peers = json.Peer ?? {};

      return Object.values(peers).map((peer: any) => ({
        hostname: peer.HostName ?? '',
        ip: peer.TailscaleIPs?.[0] ?? '',
        online: peer.Online ?? false,
      }));
    } catch {
      return [];
    }
  }
}

function isENOENT(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as any).code === 'ENOENT';
}
