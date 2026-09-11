// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { AgentRbac, PermissionRule } from '../../../models/agenticrun';
import { RequiredPermissions } from './RequiredPermissions';
import { fireEvent, renderWithProviders, screen } from '../../../test-render';

const nsRule: PermissionRule = {
  apiGroups: [''],
  justification: 'Read pods',
  namespace: 'openshift-monitoring',
  resources: ['pods'],
  verbs: ['get'],
};

const writeRule: PermissionRule = {
  apiGroups: [''],
  justification: 'Rotate secret',
  namespace: 'openshift-monitoring',
  resources: ['secrets'],
  verbs: ['get', 'patch'],
};

const clusterRule: PermissionRule = {
  apiGroups: ['apps'],
  justification: 'Manage deployments',
  resources: ['deployments'],
  verbs: ['get'],
};

const render = (rbac: AgentRbac) => renderWithProviders(<RequiredPermissions rbac={rbac} />);

describe('RequiredPermissions', () => {
  test('renders nothing when there are no rules', () => {
    render({});
    expect(screen.queryByText('Required permissions')).not.toBeInTheDocument();
  });

  test('renders the heading and namespace permission count', () => {
    render({ namespaceScoped: [nsRule] });
    expect(screen.getByText('Required permissions')).toBeInTheDocument();
    expect(screen.getByText('1 namespace permission')).toBeInTheDocument();
    expect(screen.queryByText(/cluster-wide permission/)).not.toBeInTheDocument();
  });

  test('renders the scoped-privileges callout', () => {
    render({ namespaceScoped: [nsRule] });
    expect(
      screen.getByText(
        'Permissions are fixed upon approval. The agent cannot exceed these scoped privileges.',
      ),
    ).toBeInTheDocument();
  });

  test('renders a cluster-wide permission count and row label', () => {
    render({ clusterScoped: [clusterRule] });
    expect(screen.getByText('1 cluster-wide permission')).toBeInTheDocument();
    expect(screen.getByText('Cluster-wide')).toBeInTheDocument();
  });

  test('summarizes write permissions and flags write verbs', () => {
    render({ namespaceScoped: [writeRule] });
    expect(screen.getByText('Includes write: patch secrets')).toBeInTheDocument();
    expect(screen.getByText('write')).toBeInTheDocument();
  });

  test('renders verbs and justification for each rule', () => {
    render({ namespaceScoped: [nsRule] });
    expect(screen.getByText('get')).toBeInTheDocument();
    expect(screen.getByText(/Read pods/)).toBeInTheDocument();
  });

  test('renders each verb as its own label colored by mutation risk', () => {
    render({ namespaceScoped: [writeRule] });
    const readOnly = screen.getByText('get').closest('.pf-v6-c-label');
    const mutating = screen.getByText('patch').closest('.pf-v6-c-label');
    expect(mutating).toHaveClass('pf-m-orange');
    expect(readOnly).not.toHaveClass('pf-m-orange');
  });

  test('renders resource icon and names when resourceNames are present', () => {
    render({
      namespaceScoped: [{ ...writeRule, resourceNames: ['tls-cert'] }],
    });
    expect(screen.getByText('tls-cert')).toBeInTheDocument();
  });

  test('toggles the permission details section', () => {
    render({ namespaceScoped: [nsRule] });
    expect(screen.getByText('View permission details')).toBeInTheDocument();
    fireEvent.click(screen.getByText('View permission details'));
    expect(screen.getByText('Hide permission details')).toBeInTheDocument();
  });
});
