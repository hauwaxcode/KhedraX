import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';
import type { DeploymentDescriptor } from '../registry/types.ts';

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

  private async renderDeploymentFiles(deploymentDir: string, descriptor: DeploymentDescriptor): Promise<void> {
    const deployScriptPath = path.join(deploymentDir, 'deploy.sh');
    const envExamplePath = path.join(deploymentDir, '.env.example');
    const readmePath = path.join(deploymentDir, 'README.md');
    const configYamlPath = path.join(deploymentDir, 'config.yaml');

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

      // If the original deploy script already has a standard shebang and set -euo pipefail block, remove it to avoid duplication
      if (originalDeploy.startsWith('#!')) {
        const firstNewline = originalDeploy.indexOf('\n');
        const remaining = originalDeploy.slice(firstNewline + 1);
        const normalized = remaining.replace(/^set -euo pipefail\n\n/, '');
        deployScript = checkBlock + normalized;
      } else {
        deployScript = checkBlock + originalDeploy;
      }
    }

    const envExample = this.buildEnvExample(descriptor);
    const templateReadme = await this.readOptionalFile(readmePath);
    const readme = this.buildReadme(descriptor, templateReadme);

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

    if (descriptor.configTemplate && Object.keys(descriptor.configTemplate).length > 0) {
      const configYaml = Object.entries(descriptor.configTemplate)
        .map(([key, value]) => `${key}: ${this.renderEnvValue(value)}`)
        .join('\n') + '\n';
      await fs.writeFile(configYamlPath, configYaml);
    } else {
      await fs.rm(configYamlPath, { force: true });
    }
  }

  private buildEnvExample(descriptor: DeploymentDescriptor): string {
    const secretLines = descriptor.secretsRequired.map((secret) => `${secret}=`);
    const environmentEntries = Object.entries(descriptor.environmentTemplate ?? {});

    if (secretLines.length === 0 && environmentEntries.length === 0) {
      return `# ${descriptor.name.charAt(0).toUpperCase() + descriptor.name.slice(1)} deployment does not require additional secrets.`;
    }

    const lines = [...secretLines];
    if (environmentEntries.length > 0) {
      if (lines.length > 0) {
        lines.push('');
      }
      lines.push(...environmentEntries.map(([key, value]) => `${key}=${this.renderEnvValue(value)}`));
    }
    return lines.join('\n');
  }

  private buildReadme(descriptor: DeploymentDescriptor, existingReadme: string): string {
    const hasRichMetadata = Boolean(
      descriptor.verificationStrategy
      || Object.keys(descriptor.secretsDescriptions ?? {}).length > 0
      || Object.keys(descriptor.environmentTemplate ?? {}).length > 0
      || (descriptor.configTemplate && Object.keys(descriptor.configTemplate).length > 0),
    );

    if (!hasRichMetadata) {
      return `# Deployment\n\nTarget: ${descriptor.name}\nRuntime: ${descriptor.runtime}\nMonitoring: ${descriptor.monitoring.healthCheckPath} -> ${descriptor.monitoring.logDestination}\nRollback: ${descriptor.rollback.strategy}\n`;
    }

    const sections: string[] = [];
    if (existingReadme.trim()) {
      sections.push(existingReadme.trim());
    }

    if (descriptor.walletIntegration.type || descriptor.walletIntegration.supportedTypes?.length) {
      sections.push('## Wallet Integration');
      sections.push(`Type: ${descriptor.walletIntegration.type}`);
      if (descriptor.walletIntegration.supportedTypes?.length) {
        sections.push(`Supported types: ${descriptor.walletIntegration.supportedTypes.join(', ')}`);
      }
      if (descriptor.walletIntegration.secretEnvVar) {
        sections.push(`Secret env var: ${descriptor.walletIntegration.secretEnvVar}`);
      }
    }

    sections.push('## Secrets');
    if (descriptor.secretsRequired.length > 0) {
      for (const secret of descriptor.secretsRequired) {
        const description = descriptor.secretsDescriptions?.[secret];
        sections.push(`- ${secret}${description ? `: ${description}` : ''}`);
      }
    } else {
      sections.push('- No additional secrets are required.');
    }
    if (descriptor.verificationStrategy) {
      sections.push('');
      sections.push('## Verification');
      sections.push(descriptor.verificationStrategy);
    }

    return sections.join('\n\n');
  }

  private async readOptionalFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return '';
    }
  }

  private renderEnvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }
}
