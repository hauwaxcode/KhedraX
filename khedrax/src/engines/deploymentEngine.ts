import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

export class DeploymentEngine implements ProducerEngine {
  name = 'deployment';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const target = context.dna.deployment?.target;
    if (!target) {
      return { artifacts: { skipped: true } };
    }

    const descriptor = context.registry.deployments[target];
    const deploymentDir = path.join(context.tempDir, 'deployment');
    await fs.mkdir(deploymentDir, { recursive: true });

    await fs.cp(descriptor.templatesPath, deploymentDir, { recursive: true });
    await this.renderDeploymentFiles(deploymentDir, descriptor);
    return { artifacts: { target, rendered: true } };
  }

  private async renderDeploymentFiles(deploymentDir: string, descriptor: { runtime: string; secretsRequired: string[]; name: string; network: { chainId: string | null; rpcUrlEnvVar: string | null }; walletIntegration: { type: string; secretEnvVar?: string }; monitoring: { healthCheckPath: string; logDestination: string }; rollback: { strategy: string } }): Promise<void> {
    const deployScriptPath = path.join(deploymentDir, 'deploy.sh');
    const envExamplePath = path.join(deploymentDir, '.env.example');
    const readmePath = path.join(deploymentDir, 'README.md');

    // Preserve any existing template deploy.sh and inject a secrets check only when required
    let originalDeploy = '';
    try {
      originalDeploy = await fs.readFile(deployScriptPath, 'utf8');
    } catch {
      // template may not exist; fall back to a minimal placeholder
      originalDeploy = `echo "Deployment target: ${descriptor.name}"\n` +
        `echo "Runtime: ${descriptor.runtime}"\n` +
        `echo "Monitoring: ${descriptor.monitoring.healthCheckPath} -> ${descriptor.monitoring.logDestination}"\n` +
        `echo "Rollback: ${descriptor.rollback.strategy}"\n` +
        '# TODO: replace with your agent\'s actual start command\n';
    }

    let deployScript = originalDeploy;
    const hasExistingSecretsCheck = /required_env|check_required_env/.test(originalDeploy);
    if (descriptor.secretsRequired.length > 0 && !hasExistingSecretsCheck) {
      const secrets = descriptor.secretsRequired.join(' ');
      const checkBlock =
        '#!/usr/bin/env bash\n' +
        'set -euo pipefail\n\n' +
        'check_required_env() {\n' +
        '  local missing=()\n' +
        `  for var in ${secrets}; do\n` +
        '    if [[ -z "${!var}" ]]; then\n' +
        '      missing+=("$var")\n' +
        '    fi\n' +
        '  done\n' +
        '  if (( ${#missing[@]} > 0 )); then\n' +
        '    echo "Missing required environment variables: ${missing[*]}" >&2\n' +
        '    exit 1\n' +
        '  fi\n' +
        '}\n\n' +
        'check_required_env\n\n';

      // If the original deploy script already has a shebang, remove it to avoid duplication
      if (originalDeploy.startsWith('#!')) {
        const idx = originalDeploy.indexOf('\n');
        originalDeploy = originalDeploy.slice(idx + 1);
      }
      deployScript = checkBlock + originalDeploy;
    }

    const envExample = descriptor.secretsRequired.length > 0
      ? descriptor.secretsRequired.map((secret) => `${secret}=`).join('\n')
      : `# ${descriptor.name.charAt(0).toUpperCase() + descriptor.name.slice(1)} deployment does not require additional secrets.`;

    const readme = `# Deployment\n\nTarget: ${descriptor.name}\nRuntime: ${descriptor.runtime}\nMonitoring: ${descriptor.monitoring.healthCheckPath} -> ${descriptor.monitoring.logDestination}\nRollback: ${descriptor.rollback.strategy}\n`;

    // always include a short secretsRequired comment so templates and tests can inspect it
    const secretsComment = `# secretsRequired: ${descriptor.secretsRequired.join(',')}\n`;
    // if the script starts with a shebang, insert the comment after it
    if (deployScript.startsWith('#!')) {
      const idx = deployScript.indexOf('\n');
      deployScript = deployScript.slice(0, idx + 1) + secretsComment + deployScript.slice(idx + 1);
    } else {
      deployScript = secretsComment + deployScript;
    }

    await fs.writeFile(deployScriptPath, deployScript);
    await fs.writeFile(envExamplePath, envExample);
    await fs.writeFile(readmePath, readme);
  }
}
