import { chromium, type FullConfig } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { oc } from './fixtures';

const MINUTE = 60 * 1000;
const AUTH_DIR = path.join(__dirname, '..', '.auth');
const STATE_FILE = path.join(AUTH_DIR, 'state.json');
const OLS_NAMESPACE = process.env.OLS_NAMESPACE || 'openshift-lightspeed';
const CLASSIC_CONTROLLER = 'lightspeed-operator-controller-manager';
const AGENTIC_CONTROLLER = 'lightspeed-agentic-operator-controller-manager';
const PLUGIN = 'lightspeed-agentic-console-plugin';
const CONTROLLERS = [CLASSIC_CONTROLLER, AGENTIC_CONTROLLER];

// Only the fields used by setup; merge patches retain all other CSV fields.
type DeploymentSpec = {
  replicas?: number;
  selector?: { matchLabels?: Record<string, string> };
  template: { spec: { containers: { name: string; image: string; args?: string[] }[] } };
};
type CSV = {
  metadata: { name: string };
  status?: { phase?: string };
  spec: { install: { spec: { deployments: { name: string; spec: DeploymentSpec }[] } } };
};
type Deployment = {
  metadata: { generation: number };
  spec: DeploymentSpec;
  status?: {
    observedGeneration?: number;
    replicas?: number;
    updatedReplicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
  };
};

const waitFor = async (check: () => boolean, timeout: number, message: string) => {
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (check()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`${message}${lastError ? `: ${lastError}` : ''}`);
};

const configureImageMirrors = async () => {
  const url =
    process.env.IMAGE_DIGEST_MIRROR_SET_URL ||
    'https://raw.githubusercontent.com/openshift/lightspeed-operator/main/config/manager/imagedigestmirrorset.yaml';
  console.log(`Applying image digest mirrors from ${url}`);
  const idms = JSON.parse(oc(['apply', '-f', url, '-o', 'json']));
  const mirrors: { source: string; mirrors: string[] }[] = idms.spec.imageDigestMirrors;
  if (!mirrors.length) {
    throw new Error('ImageDigestMirrorSet contains no mirrors');
  }
  const required = mirrors.flatMap((entry) => [entry.source, ...entry.mirrors]);
  // Updated=True alone can still describe the old config immediately after applying
  // an IDMS. Check the rendered registries file too, and handle unchanged IDMSs.
  await waitFor(
    () => {
      const pools = JSON.parse(oc(['get', 'machineconfigpools', '-o', 'json'])).items;
      const populated = pools.filter(
        (pool: { status: { machineCount: number } }) => pool.status.machineCount > 0,
      );
      return (
        populated.length > 0 &&
        populated.every(
          (pool: {
            spec: { configuration: { name: string } };
            status: {
              configuration: { name: string };
              machineCount: number;
              updatedMachineCount: number;
              readyMachineCount: number;
              unavailableMachineCount: number;
              conditions: { type: string; status: string }[];
            };
          }) => {
            const status = pool.status;
            if (
              status.configuration.name !== pool.spec.configuration.name ||
              status.updatedMachineCount !== status.machineCount ||
              status.readyMachineCount !== status.machineCount ||
              status.unavailableMachineCount !== 0 ||
              !status.conditions.some((c) => c.type === 'Updated' && c.status === 'True') ||
              status.conditions.some((c) => c.type === 'Degraded' && c.status === 'True')
            ) {
              return false;
            }
            const config = JSON.parse(
              oc(['get', 'machineconfig', pool.spec.configuration.name, '-o', 'json']),
            );
            const file = config.spec.config.storage.files.find(
              (entry: { path: string }) => entry.path === '/etc/containers/registries.conf',
            );
            const source: string = file?.contents?.source || '';
            if (!source.startsWith('data:')) {
              return false;
            }
            const comma = source.indexOf(',');
            const contents = source.slice(0, comma).endsWith(';base64')
              ? Buffer.from(source.slice(comma + 1), 'base64').toString('utf-8')
              : decodeURIComponent(source.slice(comma + 1));
            return required.every((entry) => contents.includes(`"${entry}"`));
          },
        )
      );
    },
    30 * MINUTE,
    'Image digest mirrors did not become ready on all MachineConfigPools',
  );
};

const setupCluster = async () => {
  const image = process.env.CONSOLE_IMAGE;
  const version = JSON.parse(oc(['get', 'clusterversion', 'version', '-o', 'json']));
  const completed = version.status.history.find(
    (entry: { state: string }) => entry.state === 'Completed',
  );
  if (!completed || Number.parseInt(completed.version, 10) < 5) {
    throw new Error('Agentic console E2E setup requires OpenShift 5.0 or later');
  }

  await configureImageMirrors();

  if (!oc(['get', 'namespace', OLS_NAMESPACE, '-o', 'name', '--ignore-not-found']).trim()) {
    oc(['create', 'namespace', OLS_NAMESPACE]);
  }

  const getCSVs = (): CSV[] =>
    JSON.parse(oc(['get', 'csv', '-n', OLS_NAMESPACE, '-o', 'json'])).items;
  let csvs = getCSVs();
  if (csvs.length === 0) {
    console.log(`Installing the OLS bundle in ${OLS_NAMESPACE}`);
    const bundle =
      process.env.BUNDLE_IMAGE || 'quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest';
    const result = execFileSync(
      'operator-sdk',
      [
        'run',
        'bundle',
        '--namespace',
        OLS_NAMESPACE,
        '--timeout',
        '30m',
        bundle,
        '--kubeconfig',
        process.env.KUBECONFIG_PATH!,
      ],
      { encoding: 'utf-8', timeout: 32 * MINUTE, stdio: ['ignore', 'pipe', 'inherit'] },
    );
    console.log(result);
    csvs = getCSVs();
  } else {
    console.log(`Reusing the OLS bundle in ${OLS_NAMESPACE}`);
  }

  const candidates = csvs.filter(
    (csv) =>
      csv.status?.phase === 'Succeeded' &&
      CONTROLLERS.every((name) =>
        csv.spec.install.spec.deployments.some((entry) => entry.name === name),
      ),
  );
  if (candidates.length !== 1) {
    throw new Error('Expected exactly one succeeded v2 CSV with both controllers');
  }
  const csv = candidates[0];
  for (const crd of ['olsconfigs.ols.openshift.io', 'agenticruns.agentic.openshift.io']) {
    oc(['wait', '--for=condition=Established', `crd/${crd}`, '--timeout=120s']);
  }

  const deployments = csv.spec.install.spec.deployments;
  const classic = deployments.find((entry) => entry.name === CLASSIC_CONTROLLER)!;
  const manager = classic.spec.template.spec.containers.find(
    (container) => container.name === 'manager',
  );
  if (!manager) {
    throw new Error('Classic operator manager container not found');
  }
  if (image) {
    manager.args = [
      ...(manager.args || []).filter((arg) => !arg.startsWith('--agentic-console-image=')),
      `--agentic-console-image=${image}`,
    ];
  }
  // Resume reconciliation even if a previous local test run isolated this CSV.
  // OLM owns the Deployment, so change its authoritative CSV rather than scaling it directly.
  classic.spec.replicas = 1;
  const patchCSV = () =>
    oc([
      'patch',
      'csv',
      csv.metadata.name,
      '-n',
      OLS_NAMESPACE,
      '--type=merge',
      '-p',
      JSON.stringify({ spec: { install: { spec: { deployments } } } }),
    ]);
  patchCSV();

  const manifestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-console-setup-'));
  try {
    if (
      !oc([
        'get',
        'secret',
        'console-e2e-provider',
        '-n',
        OLS_NAMESPACE,
        '-o',
        'name',
        '--ignore-not-found',
      ]).trim()
    ) {
      // These UI-only tests never call an LLM; no real provider credentials are needed.
      oc([
        'create',
        'secret',
        'generic',
        'console-e2e-provider',
        '-n',
        OLS_NAMESPACE,
        '--from-literal=apitoken=unused-console-e2e-token',
      ]);
    }
    const getConfig = () => oc(['get', 'olsconfig', 'cluster', '-o', 'json', '--ignore-not-found']);
    let existingConfig = getConfig();
    if (existingConfig && JSON.parse(existingConfig).metadata.deletionTimestamp) {
      await waitFor(() => !getConfig().trim(), 3 * MINUTE, 'OLSConfig deletion did not finish');
      existingConfig = '';
    }
    if (!existingConfig.trim()) {
      const configFile = path.join(manifestDir, 'olsconfig.json');
      fs.writeFileSync(
        configFile,
        JSON.stringify({
          apiVersion: 'ols.openshift.io/v1alpha1',
          kind: 'OLSConfig',
          metadata: { name: 'cluster' },
          spec: {
            llm: {
              providers: [
                {
                  name: 'console-e2e',
                  type: 'openai',
                  url: 'https://api.openai.com/v1',
                  credentialsSecretRef: { name: 'console-e2e-provider' },
                  models: [{ name: 'gpt-4o-mini' }],
                },
              ],
            },
            ols: { defaultModel: 'gpt-4o-mini', defaultProvider: 'console-e2e' },
          },
        }),
      );
      oc(['create', '-f', configFile]);
    }
  } finally {
    fs.rmSync(manifestDir, { recursive: true, force: true });
  }

  const pluginReady = () => {
    const deployment: Deployment = JSON.parse(
      oc(['get', 'deployment', PLUGIN, '-n', OLS_NAMESPACE, '-o', 'json']),
    );
    const { spec, status, metadata } = deployment;
    if (
      !spec.replicas ||
      (status?.observedGeneration ?? 0) < metadata.generation ||
      !['replicas', 'updatedReplicas', 'readyReplicas', 'availableReplicas'].every(
        (key) => status?.[key as keyof NonNullable<Deployment['status']>] === spec.replicas,
      ) ||
      (image && !spec.template.spec.containers.some((container) => container.image === image))
    ) {
      return false;
    }
    oc(['get', 'consoleplugin', PLUGIN]);
    const consoleConfig = JSON.parse(
      oc(['get', 'consoles.operator.openshift.io', 'cluster', '-o', 'json']),
    );
    return consoleConfig.spec.plugins?.includes(PLUGIN) === true;
  };
  await waitFor(
    pluginReady,
    10 * MINUTE,
    'Console plugin did not become ready with the requested image',
  );

  const selectors = deployments
    .filter((entry) => CONTROLLERS.includes(entry.name))
    .map((entry) => {
      const selector = Object.entries(entry.spec.selector?.matchLabels || {})
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      if (!selector) {
        throw new Error('Controller selector must not be empty');
      }
      entry.spec.replicas = 0;
      return selector;
    });
  patchCSV();
  await waitFor(
    () => {
      for (const controller of CONTROLLERS) {
        const deployment: Deployment = JSON.parse(
          oc(['get', 'deployment', controller, '-n', OLS_NAMESPACE, '-o', 'json']),
        );
        if (deployment.spec.replicas !== 0 || (deployment.status?.replicas ?? 0) !== 0) {
          return false;
        }
      }
      return selectors.every(
        (selector) =>
          JSON.parse(oc(['get', 'pods', '-n', OLS_NAMESPACE, '-l', selector, '-o', 'json'])).items
            .length === 0,
      );
    },
    5 * MINUTE,
    'Controller isolation failed; refusing to run nondeterministic UI tests',
  );
  if (!pluginReady()) {
    throw new Error('Console plugin is not ready after controller isolation');
  }
  oc(['get', 'crd', 'agenticruns.agentic.openshift.io']);
  console.log('Console plugin is ready; both CSV controllers are isolated.');
};

const globalSetup = async (config: FullConfig) => {
  const baseURL = config.projects[0].use.baseURL!;
  const username = process.env.LOGIN_USERNAME || 'kubeadmin';

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  oc(['adm', 'policy', 'add-cluster-role-to-user', 'cluster-admin', username]);

  await setupCluster();

  // Log in via browser and save storageState
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(baseURL);

  const idp = process.env.LOGIN_IDP || 'kube:admin';
  const password = process.env.LOGIN_PASSWORD!;

  // Select IDP if the login page shows identity provider selection
  const idpLink = page.locator(`a:has-text("${idp}")`);
  if (await idpLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await idpLink.click();
  }

  await page.locator('#inputUsername').fill(username);
  await page.locator('#inputPassword').fill(password);
  await page.locator('button[type=submit]').click();

  // Wait for console to load
  await page.waitForURL('**/');

  // Dismiss guided tour and prevent it from reappearing
  const tourSettings = {
    'console.guidedTour': { admin: { completed: true } },
  };
  await page.evaluate((settings) => {
    localStorage.setItem('console-user-settings', JSON.stringify(settings));
  }, tourSettings);

  const tourDismiss = page.locator('[data-test="tour-step-footer-secondary"]');
  if (await tourDismiss.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tourDismiss.click();
  }

  // Dismiss the "Welcome to the new OpenShift experience" tour modal (4.19+)
  const skipTour = page.getByRole('button', { name: 'Skip tour' });
  if (await skipTour.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipTour.click();
  }

  // Wait for the agentic console plugin to be ready by navigating to its route and waiting for the
  // page to render. The console may reload multiple times after plugin installation, so we poll
  // until the page is stable.
  await page.goto(`${baseURL}/lightspeed/runs`);
  await page.waitForLoadState('networkidle', { timeout: 2 * MINUTE });

  const LOAD_MAX_POLLS = 36;
  const LOAD_POLL_INTERVAL = 10_000;
  const LOAD_REQUIRED_POLLS = 3;
  const pluginHeading = page.getByRole('heading', { name: 'Agentic Runs' });
  let stableCount = 0;
  for (let i = 0; i < LOAD_MAX_POLLS; i++) {
    if (await pluginHeading.isVisible({ timeout: 1_000 }).catch(() => false)) {
      if (++stableCount >= LOAD_REQUIRED_POLLS) {
        break;
      }
      await page.waitForTimeout(LOAD_POLL_INTERVAL);
      continue;
    }
    stableCount = 0;
    await page.waitForTimeout(LOAD_POLL_INTERVAL);
    await page.goto(`${baseURL}/lightspeed/runs`);
    await page.waitForLoadState('networkidle', { timeout: 2 * MINUTE });
  }

  // Dismiss any tour modals that appeared after stabilization reloads
  if (await skipTour.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipTour.click();
  }

  // Re-capture auth state after stabilization so cookies/tokens are fresh
  await context.storageState({ path: STATE_FILE });
  await browser.close();

  console.log(`Auth state saved to ${STATE_FILE}`);
};

export default globalSetup;
