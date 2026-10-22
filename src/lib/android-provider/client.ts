import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core';
import { parseAccessScopes, type AccessScopes } from '@/lib/permissions/access';

export interface ProviderCaller {
  key: string;
  uid: number;
  packageName: string;
  signingDigest: string;
  label: string;
  iconDataUrl?: string;
  identityCurrent: boolean;
  requestedAt: number;
  scopes: AccessScopes;
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
  scopes: AccessScopes;
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
    scopes: AccessScopes;
    expectedRevision: number;
  }): Promise<ProviderAccessState>;
  revoke(options: {
    key: string;
    expectedRevision: number;
  }): Promise<ProviderAccessState>;
}
const nativeProvider = registerPlugin<ProviderPlugin>('BrewGuideProvider');
function validateState(state: ProviderAccessState): ProviderAccessState {
  return {
    ...state,
    callers: state.callers.map(caller => ({
      ...caller,
      scopes: parseAccessScopes(caller.scopes),
    })),
  };
}
export const providerAccess: ProviderPlugin = {
  async getState() {
    return validateState(await nativeProvider.getState());
  },
  async grant(options) {
    return validateState(
      await nativeProvider.grant({
        ...options,
        scopes: parseAccessScopes(options.scopes),
      })
    );
  },
  async revoke(options) {
    return validateState(await nativeProvider.revoke(options));
  },
  async getPendingAuthorization() {
    const result = await nativeProvider.getPendingAuthorization();
    return {
      pending: result.pending
        ? {
            ...result.pending,
            scopes: parseAccessScopes(result.pending.scopes),
          }
        : null,
    };
  },
  resolveAuthorization: options => nativeProvider.resolveAuthorization(options),
  addListener: (event, listener) => nativeProvider.addListener(event, listener),
};
export function isAndroidProviderAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
