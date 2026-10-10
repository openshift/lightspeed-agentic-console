import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const classic = 'lightspeed-operator-controller-manager';
const agentic = 'lightspeed-agentic-operator-controller-manager';
const image = 'console:pr';

const runFilter = (name: string, document: unknown) => {
  const filter = fileURLToPath(new URL(`../scripts/jq/${name}.jq`, import.meta.url));
  expect(existsSync(filter), `Shared jq filter ${name} must exist`).toBe(true);
  return spawnSync(
    'jq',
    [
      '-ec',
      '--arg',
      'classic',
      classic,
      '--arg',
      'agentic',
      agentic,
      '--arg',
      'image',
      image,
      '-f',
      filter,
    ],
    { input: JSON.stringify(document), encoding: 'utf8' },
  );
};

const deployment = (name: string, args: string[] = ['--leader-elect']) => ({
  name,
  spec: {
    replicas: 1,
    selector: { matchLabels: { app: name } },
    template: {
      spec: {
        containers: [
          { name: 'manager', image: 'operator:original', args },
          { name: 'sidecar', image: 'sidecar:original', args: ['--unchanged'] },
        ],
      },
    },
  },
});

const csv = (args = ['--leader-elect', '--agentic-console-image=old']) => ({
  spec: {
    install: {
      spec: {
        deployments: [
          deployment(classic, args),
          deployment(agentic),
          deployment('unrelated-controller'),
        ],
      },
    },
  },
});

const readyDeployment = () => ({
  metadata: { generation: 3 },
  spec: { replicas: 1, template: { spec: { containers: [{ image }] } } },
  status: {
    observedGeneration: 3,
    replicas: 1,
    updatedReplicas: 1,
    readyReplicas: 1,
    availableReplicas: 1,
  },
});

describe('console image CSV patch', () => {
  it('replaces the image argument while preserving other deployments, args and containers', () => {
    const original = csv();
    const expected = structuredClone(original);
    expected.spec.install.spec.deployments[0].spec.template.spec.containers[0].args = [
      '--leader-elect',
      '--agentic-console-image=console:pr',
    ];
    const result = runFilter('console-image-patch', original);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expected);
  });

  it('adds the image argument when no arguments were configured', () => {
    const result = runFilter('console-image-patch', csv([]));
    expect(result.status, result.stderr).toBe(0);
    expect(
      JSON.parse(result.stdout).spec.install.spec.deployments[0].spec.template.spec.containers[0]
        .args,
    ).toEqual(['--agentic-console-image=console:pr']);
  });

  it('rejects a missing classic manager container', () => {
    const original = csv();
    original.spec.install.spec.deployments[0].spec.template.spec.containers = [];
    const result = runFilter('console-image-patch', original);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Classic operator manager container not found');
  });
});

describe('controller isolation CSV patch', () => {
  it('changes only the two controller replica counts', () => {
    const original = csv();
    const expected = structuredClone(original);
    expected.spec.install.spec.deployments[0].spec.replicas = 0;
    expected.spec.install.spec.deployments[1].spec.replicas = 0;
    const result = runFilter('controller-isolation-patch', original);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expected);
  });
});

describe('snapshot plugin readiness', () => {
  it('accepts a completed rollout of the snapshot image', () => {
    const result = runFilter('plugin-ready', readyDeployment());
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toBe(true);
  });

  it.each([
    ['an old ready pod during rollout', { replicas: 2 }],
    ['a stale observed generation', { observedGeneration: 2 }],
    ['an outdated replica', { updatedReplicas: 0 }],
    ['an unready replica', { readyReplicas: 0 }],
    ['an unavailable replica', { availableReplicas: 0 }],
  ])('rejects %s', (_description, status) => {
    const document = readyDeployment();
    Object.assign(document.status, status);
    expect(runFilter('plugin-ready', document).status).toBe(1);
  });

  it('rejects the wrong image even when its rollout is complete', () => {
    const document = readyDeployment();
    document.spec.template.spec.containers[0].image = 'console:old';
    expect(runFilter('plugin-ready', document).status).toBe(1);
  });

  it('rejects a deployment scaled to zero', () => {
    const document = readyDeployment();
    document.spec.replicas = 0;
    Object.assign(document.status, {
      replicas: 0,
      updatedReplicas: 0,
      readyReplicas: 0,
      availableReplicas: 0,
    });
    expect(runFilter('plugin-ready', document).status).toBe(1);
  });
});
