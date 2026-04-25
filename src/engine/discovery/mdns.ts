import Bonjour, { type Service } from 'bonjour-service';
import type { Logger } from '../core/logger.js';
import { DiscoveryError } from '../types/errors.js';

const SERVICE_TYPE = 'cmh-chatbot';
const DEFAULT_PORT = 4000;

export interface MDNSServiceInfo {
  name: string;
  host: string;
  port: number;
  addresses: string[];
  txt: Record<string, string>;
}

export interface MDNSCallbacks {
  onFound?: (service: MDNSServiceInfo) => void;
  onLost?: (service: MDNSServiceInfo) => void;
}

/**
 * mDNS service discovery using bonjour-service.
 * Hub mode: advertises the service.
 * Edge mode: scans for services.
 */
export class MDNSDiscovery {
  private bonjour: InstanceType<typeof Bonjour> | null = null;
  private publishedService: Service | null = null;
  private browser: ReturnType<InstanceType<typeof Bonjour>['find']> | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly callbacks?: MDNSCallbacks,
  ) {}

  /**
   * Advertise this node as a Hub.
   */
  advertise(
    serviceName: string,
    port: number = DEFAULT_PORT,
    metadata: Record<string, string> = {},
  ): void {
    try {
      this.bonjour = new Bonjour();
      this.publishedService = this.bonjour.publish({
        name: serviceName,
        type: SERVICE_TYPE,
        port,
        txt: {
          version: '0.1.0',
          mode: 'hub',
          ...metadata,
        },
      });
      this.logger.info({ serviceName, port }, 'mdns:advertise');
    } catch (error) {
      throw new DiscoveryError(
        `Failed to advertise mDNS service: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Scan for available Hub nodes on the LAN.
   */
  scan(): void {
    try {
      this.bonjour = this.bonjour ?? new Bonjour();
      this.browser = this.bonjour.find({ type: SERVICE_TYPE });

      this.browser.on('up', (service: Service) => {
        const info = this.toServiceInfo(service);
        this.logger.info({ name: info.name, host: info.host, port: info.port }, 'mdns:found');
        this.callbacks?.onFound?.(info);
      });

      this.browser.on('down', (service: Service) => {
        const info = this.toServiceInfo(service);
        this.logger.info({ name: info.name }, 'mdns:lost');
        this.callbacks?.onLost?.(info);
      });

      this.logger.info('mdns:scanning');
    } catch (error) {
      throw new DiscoveryError(
        `Failed to scan mDNS: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  stop(): void {
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
    if (this.publishedService) {
      this.publishedService.stop?.();
      this.publishedService = null;
    }
    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }
    this.logger.info('mdns:stopped');
  }

  private toServiceInfo(service: Service): MDNSServiceInfo {
    return {
      name: service.name,
      host: service.host,
      port: service.port,
      addresses: service.addresses ?? [],
      txt: (service.txt as Record<string, string>) ?? {},
    };
  }
}
