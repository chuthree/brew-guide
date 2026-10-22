import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  native: {
    getState: vi.fn(),
    grant: vi.fn(),
    revoke: vi.fn(),
    getPendingAuthorization: vi.fn(),
    resolveAuthorization: vi.fn(),
    addListener: vi.fn(),
  },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
  registerPlugin: () => mocks.native,
}));
vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: () => ({ runtime: 'tauri', tauriBundled: true }),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
import { providerAccess } from '@/lib/android-provider/client';
import { configureMcp, getMcpStatus } from '@/lib/mcp/client';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import { hasDataAccess } from './access';

beforeEach(() => vi.resetAllMocks());
describe('Direct two-level permission client contracts', () => {
  it('acknowledges revocation after the active writer and reauthorizes the next writer', async () => {
    let releaseWriter!: () => void;
    let writerStarted!: () => void;
    const held = new Promise<void>(resolve => {
      releaseWriter = resolve;
    });
    const started = new Promise<void>(resolve => {
      writerStarted = resolve;
    });
    const order: string[] = [];
    const revokedConfig = {
      enabled: true,
      port: 8765,
      scopes: { beans: 'read' } as const,
    };
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'mcp_configure') order.push('revoke-native');
      return { ...revokedConfig, token: 'same-service-token', running: true };
    });
    const activeWriter = withDataMutation(async () => {
      writerStarted();
      await held;
      order.push('writer-commit');
    });
    await started;
    let acknowledged = false;
    const revocation = configureMcp(revokedConfig).then(() => {
      acknowledged = true;
    });
    const nextWriter = withDataMutation(async () => {
      const state = await getMcpStatus();
      if (!hasDataAccess(state.scopes, 'beans', 'write')) {
        order.push('next-writer-denied');
        throw new Error('PERMISSION_DENIED');
      }
      order.push('unexpected-write');
    });
    const nextDenied = expect(nextWriter).rejects.toThrow('PERMISSION_DENIED');
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    expect(mocks.invoke).not.toHaveBeenCalled();
    releaseWriter();
    await activeWriter;
    await revocation;
    await nextDenied;
    expect(acknowledged).toBe(true);
    expect(order).toEqual([
      'writer-commit',
      'revoke-native',
      'next-writer-denied',
    ]);
  });

  it('sends independent MCP domain levels without widening read or adding domains', async () => {
    const config = {
      enabled: true,
      port: 8765,
      scopes: { notes: 'edit', beans: 'read' } as const,
    };
    mocks.invoke.mockResolvedValue({
      ...config,
      token: 'same-service-token',
      running: true,
    });
    expect((await configureMcp(config)).scopes).toEqual(config.scopes);
    expect(mocks.invoke).toHaveBeenCalledWith('mcp_configure', {
      config,
      rotateToken: false,
    });
  });
  it('rejects malformed returned MCP scopes instead of guessing access', async () => {
    mocks.invoke.mockResolvedValue({ scopes: { beans: 'write' } });
    await expect(getMcpStatus()).rejects.toThrow();
  });
  it('sends an Android downgrade as read and revocation as omitted scope', async () => {
    mocks.native.grant.mockResolvedValue({ revision: 4, callers: [] });
    await providerAccess.grant({
      key: 'verified-key',
      expectedRevision: 3,
      scopes: { beans: 'read' },
    });
    expect(mocks.native.grant).toHaveBeenLastCalledWith({
      key: 'verified-key',
      expectedRevision: 3,
      scopes: { beans: 'read' },
    });
    await providerAccess.grant({
      key: 'verified-key',
      expectedRevision: 4,
      scopes: {},
    });
    expect(mocks.native.grant).toHaveBeenLastCalledWith({
      key: 'verified-key',
      expectedRevision: 4,
      scopes: {},
    });
  });
  it('rejects invalid native state and pending scopes before presenting permission choices', async () => {
    mocks.native.getState.mockResolvedValue({
      revision: 1,
      callers: [{ scopes: { notes: 'admin' } }],
    });
    await expect(providerAccess.getState()).rejects.toThrow();
    mocks.native.getPendingAuthorization.mockResolvedValue({
      pending: { scopes: { notes: 'none' } },
    });
    await expect(providerAccess.getPendingAuthorization()).rejects.toThrow();
  });
});
