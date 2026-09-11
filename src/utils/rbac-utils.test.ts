import { describe, expect, test } from 'vitest';
import { PermissionRule } from '../models/agenticrun';
import {
  buildPluralToKindMap,
  countClusterRules,
  countNamespaceRules,
  flattenRbacRules,
  formatResource,
  isClusterScoped,
  isMutatingVerb,
  isReadOnlyVerb,
  resolveKind,
  summarizeWritePermissions,
} from './rbac-utils';

const makeRule = (overrides?: Partial<PermissionRule>): PermissionRule => ({
  apiGroups: [''],
  resources: ['pods'],
  verbs: ['get', 'list'],
  justification: 'Read pods',
  ...overrides,
});

describe('flattenRbacRules', () => {
  test('concatenates namespace-scoped rules before cluster-scoped rules', () => {
    const rules = flattenRbacRules({
      namespaceScoped: [makeRule({ namespace: 'ns-a' }), makeRule({ namespace: 'ns-b' })],
      clusterScoped: [makeRule({ resources: ['nodes'] })],
    });
    expect(rules).toHaveLength(3);
    expect(rules[0].namespace).toBe('ns-a');
    expect(rules[0].scope).toBe('namespace');
    expect(rules[1].namespace).toBe('ns-b');
    expect(rules[2].scope).toBe('cluster');
    expect(rules[2].resources).toEqual(['nodes']);
  });

  test('preserves namespace-scoped rule order', () => {
    const rules = flattenRbacRules({
      namespaceScoped: [makeRule({ namespace: 'z-ns' }), makeRule({ namespace: 'a-ns' })],
    });
    expect(rules.map((r) => r.namespace)).toEqual(['z-ns', 'a-ns']);
  });

  test('coalesces undefined namespace to empty string', () => {
    const rules = flattenRbacRules({ namespaceScoped: [makeRule()] });
    expect(rules[0].namespace).toBe('');
  });

  test('handles missing groups', () => {
    expect(flattenRbacRules({})).toEqual([]);
  });

  test('keeps a namespace named "cluster-wide" namespace-scoped', () => {
    const rules = flattenRbacRules({
      namespaceScoped: [makeRule({ namespace: 'cluster-wide' })],
    });
    expect(rules[0].scope).toBe('namespace');
    expect(isClusterScoped(rules[0])).toBe(false);
  });
});

describe('rule scope counts', () => {
  const rules = flattenRbacRules({
    clusterScoped: [makeRule({ resources: ['nodes'] })],
    namespaceScoped: [makeRule({ namespace: 'ns-a' }), makeRule({ namespace: 'ns-b' })],
  });

  test('counts namespace-scoped rules', () => {
    expect(countNamespaceRules(rules)).toBe(2);
  });

  test('counts cluster-scoped rules', () => {
    expect(countClusterRules(rules)).toBe(1);
  });
});

describe('isClusterScoped', () => {
  test('is true for cluster-scoped rules', () => {
    expect(isClusterScoped({ ...makeRule(), scope: 'cluster' })).toBe(true);
  });

  test('is false for namespace-scoped rules', () => {
    expect(isClusterScoped({ ...makeRule({ namespace: 'ns-a' }), scope: 'namespace' })).toBe(false);
  });
});

describe('formatResource', () => {
  test('renders resources alone for the core api group', () => {
    expect(formatResource(makeRule({ resources: ['pods'] }))).toBe('pods');
  });

  test('appends non-empty api groups in parentheses', () => {
    expect(formatResource(makeRule({ apiGroups: ['apps'], resources: ['deployments'] }))).toBe(
      'deployments (apps)',
    );
  });

  test('joins multiple resources and api groups', () => {
    expect(
      formatResource(
        makeRule({ apiGroups: ['apps', 'batch'], resources: ['deployments', 'jobs'] }),
      ),
    ).toBe('deployments, jobs (apps, batch)');
  });

  test('includes resource names in brackets before api groups', () => {
    expect(
      formatResource(
        makeRule({ apiGroups: ['apps'], resources: ['deployments'], resourceNames: ['grafana'] }),
      ),
    ).toBe('deployments [grafana] (apps)');
  });

  test('omits the empty core api group', () => {
    expect(formatResource(makeRule({ apiGroups: ['', 'apps'], resources: ['pods'] }))).toBe(
      'pods (apps)',
    );
  });
});

describe('summarizeWritePermissions', () => {
  test('returns empty string when no write verbs', () => {
    expect(summarizeWritePermissions([makeRule({ verbs: ['get', 'list', 'watch'] })])).toBe('');
  });

  test('summarizes single write verb and resource', () => {
    expect(summarizeWritePermissions([makeRule({ verbs: ['create'], resources: ['pods'] })])).toBe(
      'create pods',
    );
  });

  test('joins multiple write verbs with slash', () => {
    expect(
      summarizeWritePermissions([
        makeRule({ verbs: ['create', 'delete'], resources: ['secrets'] }),
      ]),
    ).toBe('create/delete secrets');
  });

  test('expands multiple resources into separate entries', () => {
    expect(
      summarizeWritePermissions([
        makeRule({ verbs: ['patch'], resources: ['pods', 'deployments'] }),
      ]),
    ).toBe('patch pods · patch deployments');
  });

  test('filters out non-write verbs', () => {
    expect(
      summarizeWritePermissions([
        makeRule({ verbs: ['get', 'update', 'list'], resources: ['pods'] }),
      ]),
    ).toBe('update pods');
  });

  test('treats wildcard * as a write verb', () => {
    expect(summarizeWritePermissions([makeRule({ verbs: ['*'], resources: ['pods'] })])).toBe(
      '* pods',
    );
  });

  test('joins multiple rules with dot separator', () => {
    expect(
      summarizeWritePermissions([
        makeRule({ verbs: ['create'], resources: ['pods'] }),
        makeRule({ verbs: ['delete'], resources: ['secrets'] }),
      ]),
    ).toBe('create pods · delete secrets');
  });

  test('skips rules with only read verbs', () => {
    expect(
      summarizeWritePermissions([
        makeRule({ verbs: ['get'] }),
        makeRule({ verbs: ['delete'], resources: ['secrets'] }),
      ]),
    ).toBe('delete secrets');
  });
});

describe('isReadOnlyVerb', () => {
  test.each(['get', 'list', 'watch'])('treats %s as read-only', (verb) => {
    expect(isReadOnlyVerb(verb)).toBe(true);
  });

  test.each(['create', 'update', 'patch', 'delete', 'deletecollection', 'exec', '*', 'escalate'])(
    'does not treat %s as read-only',
    (verb) => {
      expect(isReadOnlyVerb(verb)).toBe(false);
    },
  );
});

describe('isMutatingVerb', () => {
  test.each(['create', 'update', 'patch', 'delete', 'deletecollection', 'exec', '*'])(
    'treats %s as mutating',
    (verb) => {
      expect(isMutatingVerb(verb)).toBe(true);
    },
  );

  test.each(['get', 'list', 'watch'])('does not treat %s as mutating', (verb) => {
    expect(isMutatingVerb(verb)).toBe(false);
  });

  test('treats unknown or privileged verbs as mutating', () => {
    expect(isMutatingVerb('impersonate')).toBe(true);
  });
});

describe('buildPluralToKindMap', () => {
  test('builds map from models keyed by apiGroup/plural', () => {
    const models = {
      Pod: { apiGroup: '', plural: 'pods', kind: 'Pod' },
      Deployment: { apiGroup: 'apps', plural: 'deployments', kind: 'Deployment' },
    };
    const map = buildPluralToKindMap(models as never);
    expect(map.get('/pods')).toBe('Pod');
    expect(map.get('apps/deployments')).toBe('Deployment');
  });

  test('defaults missing apiGroup to empty string', () => {
    const models = {
      Secret: { plural: 'secrets', kind: 'Secret' },
    };
    const map = buildPluralToKindMap(models as never);
    expect(map.get('/secrets')).toBe('Secret');
  });

  test('returns empty map for empty models', () => {
    expect(buildPluralToKindMap({} as never).size).toBe(0);
  });
});

describe('resolveKind', () => {
  const pluralToKind = new Map([
    ['/pods', 'Pod'],
    ['apps/deployments', 'Deployment'],
    ['/secrets', 'Secret'],
  ]);

  test('resolves core resource with empty apiGroup', () => {
    expect(resolveKind(pluralToKind, [''], 'pods')).toBe('Pod');
  });

  test('resolves resource with named apiGroup', () => {
    expect(resolveKind(pluralToKind, ['apps'], 'deployments')).toBe('Deployment');
  });

  test('returns undefined for unknown resource', () => {
    expect(resolveKind(pluralToKind, [''], 'widgets')).toBeUndefined();
  });

  test('returns undefined for wrong apiGroup', () => {
    expect(resolveKind(pluralToKind, ['extensions'], 'deployments')).toBeUndefined();
  });

  test('tries multiple apiGroups and returns first match', () => {
    expect(resolveKind(pluralToKind, ['extensions', 'apps'], 'deployments')).toBe('Deployment');
  });

  test('returns undefined for empty apiGroups array', () => {
    expect(resolveKind(pluralToKind, [], 'pods')).toBeUndefined();
  });
});
