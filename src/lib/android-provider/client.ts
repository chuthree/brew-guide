import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core';
import type { McpDomain } from '@/lib/mcp/types';

export interface ProviderScope {
  read: boolean;
  write: boolean;
  delete: boolean;
}
export type ProviderScopes = Partial<Record<McpDomain, ProviderScope>>;
export interface ProviderCaller {
  key: string;
  uid: number;
  packageName: string;
  signingDigest: string;
  label: string;
  iconDataUrl?: string;
  identityCurrent: boolean;
  requestedAt: number;
  scopes: ProviderScopes;
}
export interface ProviderAccessState {
  revision: number;
  callers: ProviderCaller[];
}
export interface PendingProviderAuthorization {
  requestId: string;
  caller: Pick<
    ProviderCaller,
    'packageName' | 'label' | 'iconDataUrl' | 'identityCurrent'
  >;
  brewGuide: { label: string; iconDataUrl?: string };
  scopes: ProviderScopes;
  expiresAt: number;
  status: 'pending';
}
interface ProviderPlugin {
  getPendingAuthorization(): Promise<{
    pending: PendingProviderAuthorization | null;
  }>;
  resolveAuthorization(options: {
    requestId: string;
    decision: 'approve' | 'cancel';
  }): Promise<{
    requestId: string;
    status: 'approved' | 'cancelled' | 'expired' | 'stale';
    pending: null;
  }>;
  addListener(
    event: 'authorizationRequested',
    listener: (event: { requestId: string }) => void
  ): Promise<PluginListenerHandle>;
  getState(): Promise<ProviderAccessState>;
  grant(options: {
    key: string;
    scopes: ProviderScopes;
    expectedRevision: number;
  }): Promise<ProviderAccessState>;
  revoke(options: {
    key: string;
    expectedRevision: number;
  }): Promise<ProviderAccessState>;
}
export const providerAccess =
  registerPlugin<ProviderPlugin>('BrewGuideProvider');
export function isAndroidProviderAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
