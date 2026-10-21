import type { FullConfig } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { oc } from './fixtures';
import globalSetup from './global-setup';

vi.mock('./fixtures', () => ({ oc: vi.fn() }));
vi.mock('@playwright/test', () => ({
  chromium: { launch: vi.fn().mockRejectedValue(new Error('Browser login reached')) },
}));
vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  execFileSync: vi.fn().mockReturnValue('Bundle installed'),
}));

const classic = 'lightspeed-operator-controller-manager';
const agentic = 'lightspeed-agentic-operator-controller-manager';
const plugin = 'lightspeed-agentic-console-plugin';
const config = { projects: [{ use: { baseURL: 'https://console.example.com' } }] } as FullConfig;
const deployment = (name: string) => ({
  name,
  spec: {
    replicas: 1,
    selector: { matchLabels: { app: name } },
    template: {
      spec: {
        containers: [
          {
            name: 'manager',
            image: 'operator:original',
            args: ['--leader-elect', '--agentic-console-image=old'],
          },
          { name: 'sidecar', image: 'sidecar:original' },
        ],
      },
    },
  },
});
const csv = () => ({
  metadata: { name: 'lightspeed.v2' },
  status: { phase: 'Succeeded' },
  spec: {
    install: {
      spec: { deployments: [deployment(classic), deployment(agentic), deployment('unrelated')] },
    },
  },
});
let installed: ReturnType<typeof csv>[];
let pluginReady: boolean;
let podsStopped: boolean;
let mirrorsReady: boolean;
const mirrorURL = 'https://example.com/idms.yaml';
const mirrorSource = 'registry.redhat.io/openshift-lightspeed/test';
const mirrorTarget = 'quay.io/test/operator';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('KUBECONFIG_PATH', '/test/kubeconfig');
  vi.stubEnv('CONSOLE_IMAGE', 'console:pr');
  vi.stubEnv('BUNDLE_IMAGE', 'bundle:test');
  vi.stubEnv('IMAGE_DIGEST_MIRROR_SET_URL', mirrorURL);
  vi.stubEnv('OLS_NAMESPACE', 'openshift-lightspeed');
  installed = [csv()];
  pluginReady = true;
  podsStopped = true;
  mirrorsReady = true;
  vi.mocked(oc).mockImplementation((args) => {
    if (args[0] === 'apply' && args[2] === mirrorURL) {
      return JSON.stringify({
        spec: { imageDigestMirrors: [{ source: mirrorSource, mirrors: [mirrorTarget] }] },
      });
    }
    if (args[1] === 'machineconfigpools') {
      return JSON.stringify({
        items: [
          {
            metadata: { name: 'worker' },
            spec: { configuration: { name: 'rendered-worker' } },
            status: {
              configuration: { name: 'rendered-worker' },
              machineCount: 1,
              updatedMachineCount: 1,
              readyMachineCount: 1,
              unavailableMachineCount: 0,
              conditions: [
                { type: 'Updated', status: 'True' },
                { type: 'Degraded', status: 'False' },
              ],
            },
          },
        ],
      });
    }
    if (args[1] === 'machineconfig') {
      return JSON.stringify({
        spec: {
          config: {
            storage: {
              files: [
                {
                  path: '/etc/containers/registries.conf',
                  contents: {
                    source: `data:;base64,${Buffer.from(mirrorsReady ? `"${mirrorSource}"\n"${mirrorTarget}"` : 'old config').toString('base64')}`,
                  },
                },
              ],
            },
          },
        },
      });
    }
    if (args[0] !== 'get') {
      return '';
    }
    if (args[1] === 'clusterversion') {
      return JSON.stringify({ status: { history: [{ state: 'Completed', version: '5.0.0' }] } });
    }
    if (args[1] === 'csv') {
      if (args[2] === 'lightspeed.v2') {
        return JSON.stringify(installed[0]);
      }
      const items = installed;
      installed = [csv()]; // operator-sdk makes the CSV available on the next lookup
      return JSON.stringify({ items });
    }
    if (args[1] === 'deployment' && args[2] === plugin) {
      return JSON.stringify({
        metadata: { generation: 3 },
        spec: { replicas: 1, template: { spec: { containers: [{ image: 'console:pr' }] } } },
        status: {
          observedGeneration: 3,
          replicas: pluginReady ? 1 : 2,
          updatedReplicas: 1,
          readyReplicas: 1,
          availableReplicas: 1,
        },
      });
    }
    if (args[1] === 'deployment') {
      return JSON.stringify({ spec: { replicas: 0 }, status: { replicas: 0 } });
    }
    if (args[1] === 'pods') {
      return JSON.stringify({
        items: podsStopped ? [] : [{ metadata: { name: 'old-controller' } }],
      });
    }
    if (args[1] === 'consoles.operator.openshift.io') {
      return JSON.stringify({ spec: { plugins: [plugin] } });
    }
    return JSON.stringify({ metadata: { name: args[2] } });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const patches = () =>
  vi
    .mocked(oc)
    .mock.calls.filter(([args]) => args[0] === 'patch' && args[1] === 'csv')
    .map(([args]) => JSON.parse(args[args.indexOf('-p') + 1]));

describe('global cluster setup', () => {
  it('reuses an installed bundle and preserves existing configuration and credentials', async () => {
    await expect(globalSetup(config)).rejects.toThrow('Browser login reached');
    expect(execFileSync).not.toHaveBeenCalled();
    expect(oc).not.toHaveBeenCalledWith(['create', 'namespace', 'openshift-lightspeed']);
    expect(oc).toHaveBeenCalledWith(expect.arrayContaining(['get', 'olsconfig', 'cluster']));
    expect(oc).not.toHaveBeenCalledWith(expect.arrayContaining(['create', 'secret']));
    expect(oc).not.toHaveBeenCalledWith(expect.arrayContaining(['create', '-f']));
    expect(patches()).toHaveLength(2);
  });

  it('installs the configured bundle only when no CSV exists', async () => {
    installed = [];
    await expect(globalSetup(config)).rejects.toThrow('Browser login reached');
    expect(execFileSync).toHaveBeenCalledWith(
      'operator-sdk',
      expect.arrayContaining(['run', 'bundle', 'bundle:test', '--kubeconfig', '/test/kubeconfig']),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('applies mirrors before bundle installation and uses the public bundle fallback', async () => {
    installed = [];
    vi.stubEnv('BUNDLE_IMAGE', '');
    await expect(globalSetup(config)).rejects.toThrow('Browser login reached');
    expect(oc).toHaveBeenCalledWith(['apply', '-f', mirrorURL, '-o', 'json']);
    const applyIndex = vi.mocked(oc).mock.calls.findIndex(([args]) => args[0] === 'apply');
    expect(vi.mocked(oc).mock.invocationCallOrder[applyIndex]).toBeLessThan(
      vi.mocked(execFileSync).mock.invocationCallOrder[0],
    );
    expect(execFileSync).toHaveBeenCalledWith(
      'operator-sdk',
      expect.arrayContaining(['quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest']),
      expect.anything(),
    );
  });

  it('does not install while rendered node configuration lacks the mirrors', async () => {
    vi.useFakeTimers();
    installed = [];
    mirrorsReady = false;
    const result = globalSetup(config).catch((error: Error) => error);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Image digest mirrors did not become ready'),
      }),
    );
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('waits for pools to converge even when rendered mirrors are present', async () => {
    vi.useFakeTimers();
    installed = [];
    const defaultOc = vi.mocked(oc).getMockImplementation()!;
    vi.mocked(oc).mockImplementation((args) => {
      const output = defaultOc(args);
      if (args[1] !== 'machineconfigpools') {
        return output;
      }
      const pools = JSON.parse(output);
      pools.items[0].status.updatedMachineCount = 0;
      return JSON.stringify(pools);
    });
    const result = globalSetup(config).catch((error: Error) => error);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Image digest mirrors did not become ready'),
      }),
    );
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('stops before installation when applying the IDMS fails', async () => {
    installed = [];
    const defaultOc = vi.mocked(oc).getMockImplementation()!;
    vi.mocked(oc).mockImplementation((args) => {
      if (args[0] === 'apply') {
        throw new Error('IDMS forbidden');
      }
      return defaultOc(args);
    });
    await expect(globalSetup(config)).rejects.toThrow('IDMS forbidden');
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('patches the classic manager image and isolates only the two controllers', async () => {
    const original = csv();
    await expect(globalSetup(config)).rejects.toThrow('Browser login reached');
    const expected = structuredClone(original.spec.install.spec.deployments);
    expected[0].spec.template.spec.containers[0].args = [
      '--leader-elect',
      '--agentic-console-image=console:pr',
    ];
    expect(patches()).toHaveLength(2);
    expect(patches()[0].spec.install.spec.deployments).toEqual(expected);
    expected[0].spec.replicas = 0;
    expected[1].spec.replicas = 0;
    expect(patches()[1].spec.install.spec.deployments).toEqual(expected);
  });

  it('creates missing namespace, placeholder credentials and configuration during installation', async () => {
    installed = [];
    const defaultOc = vi.mocked(oc).getMockImplementation()!;
    let manifest: Record<string, unknown> | undefined;
    let manifestFile = '';
    let namespaceExists = false;
    vi.mocked(oc).mockImplementation((args) => {
      if (args[0] === 'create' && args[1] === 'namespace') {
        namespaceExists = true;
      }
      if (args[0] === 'get' && args[1] === 'namespace') {
        return namespaceExists ? 'namespace/openshift-lightspeed' : '';
      }
      if (args[0] === 'get' && args[1] === 'csv' && !namespaceExists) {
        // oc suppresses the namespace 404 and returns no JSON with --ignore-not-found.
        if (args.includes('--ignore-not-found')) {
          return '';
        }
        throw new Error('namespaces "openshift-lightspeed" not found');
      }
      if (args[0] === 'get' && ['secret', 'olsconfig'].includes(args[1])) {
        return '';
      }
      if (args[0] === 'create' && args[1] === '-f') {
        manifestFile = args[2];
        manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
      }
      return defaultOc(args);
    });
    await expect(globalSetup(config)).rejects.toThrow('Browser login reached');
    expect(oc).toHaveBeenCalledWith(['create', 'namespace', 'openshift-lightspeed']);
    expect(oc).toHaveBeenCalledWith(
      expect.arrayContaining(['create', 'secret', 'generic', 'console-e2e-provider']),
    );
    expect(manifest).toMatchObject({
      kind: 'OLSConfig',
      metadata: { name: 'cluster' },
      spec: { ols: { defaultProvider: 'console-e2e' } },
    });
    expect(fs.existsSync(manifestFile)).toBe(false);
  });

  it('resumes the classic controller after a previous isolated run', async () => {
    installed[0].spec.install.spec.deployments[0].spec.replicas = 0;
    installed[0].spec.install.spec.deployments[1].spec.replicas = 0;
    await expect(globalSetup(config)).rejects.toThrow('Browser login reached');
    expect(patches()[0].spec.install.spec.deployments[0].spec.replicas).toBe(1);
    expect(patches()[1].spec.install.spec.deployments[0].spec.replicas).toBe(0);
  });

  it('keeps the installed image argument when no local image override is provided', async () => {
    vi.stubEnv('CONSOLE_IMAGE', '');
    await expect(globalSetup(config)).rejects.toThrow('Browser login reached');
    expect(
      patches()[0].spec.install.spec.deployments[0].spec.template.spec.containers[0].args,
    ).toEqual(['--leader-elect', '--agentic-console-image=old']);
  });

  it('rejects a classic-only bundle instead of installing over it', async () => {
    installed[0].spec.install.spec.deployments = [deployment(classic)];
    await expect(globalSetup(config)).rejects.toThrow(
      'Expected exactly one succeeded v2 CSV with both controllers',
    );
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('refuses browser login when an old ready plugin replica remains', async () => {
    vi.useFakeTimers();
    pluginReady = false;
    const result = globalSetup(config).catch((error: Error) => error);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Console plugin did not become ready'),
      }),
    );
    expect(patches()).toHaveLength(1);
  });

  it('refuses browser login until all controller pods are gone', async () => {
    vi.useFakeTimers();
    podsStopped = false;
    const result = globalSetup(config).catch((error: Error) => error);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(
      expect.objectContaining({ message: expect.stringContaining('Controller isolation failed') }),
    );
  });
});
