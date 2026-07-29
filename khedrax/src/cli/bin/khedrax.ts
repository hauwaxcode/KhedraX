#!/usr/bin/env node
import path from 'node:path';
import { createAgent } from '../commands/create.ts';
import { addModule } from '../addModule.ts';
import { checkNodeVersion } from '../utils/nodeVersion.ts';
import { runDeploymentScript } from '../deploymentLauncher.ts';

const nodeCheck = checkNodeVersion(process.versions.node);
if (!nodeCheck.ok) {
  console.error(nodeCheck.reason);
  process.exit(1);
}

const [, , command, target, ...rest] = process.argv;
const deploymentActions = ['deploy', 'status', 'logs', 'rollback', 'destroy', 'update'] as const;

async function main(): Promise<void> {
  if (command === 'create') {
    if (!target) {
      console.error('Usage: khedrax create <Name> [--type ...] [--output ...] [--force] [--deployment ...] [--interface ...]');
      process.exit(1);
    }

    const args = rest;
    let type = 'basic';
    let outputDir = path.resolve(process.cwd(), target);
    let force = false;
    let resume: string | undefined;
    let verbose = false;
    let modules: string[] = [];
    let persona: string | undefined;
    let deployment: string | undefined;
    let interfaceType: string | undefined;
    const pluginRootsFromEnv = (process.env.KHEDRAX_PLUGIN_PATH ?? '').split(':').map((value) => value.trim()).filter(Boolean);
    const pluginRoots: string[] = [...pluginRootsFromEnv];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--type' && args[index + 1]) {
        type = args[index + 1];
        index += 1;
      } else if (arg === '--output' && args[index + 1]) {
        outputDir = path.resolve(process.cwd(), args[index + 1]);
        index += 1;
      } else if (arg === '--force') {
        force = true;
      } else if (arg === '--resume' && args[index + 1]) {
        resume = args[index + 1];
        index += 1;
      } else if (arg === '--verbose') {
        verbose = true;
      } else if (arg === '--modules' && args[index + 1]) {
        modules = args[index + 1].split(',').map((value) => value.trim()).filter(Boolean);
        index += 1;
      } else if (arg === '--persona' && args[index + 1]) {
        persona = args[index + 1];
        index += 1;
      } else if (arg === '--deployment' && args[index + 1]) {
        deployment = args[index + 1];
        index += 1;
      } else if (arg === '--interface' && args[index + 1]) {
        interfaceType = args[index + 1];
        index += 1;
      } else if (arg === '--plugin-path' && args[index + 1]) {
        pluginRoots.push(args[index + 1]);
        index += 1;
      }
    }

    try {
      const result = await createAgent({
        name: target,
        type,
        outputDir,
        modules,
        force,
        verbose,
        resume,
        persona,
        deployment,
        interface: interfaceType,
        pluginRoots,
      });
      console.log(result.outputPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
    return;
  }

  if (command === 'add-module') {
    if (!target || !rest[0]) {
      console.error('Usage: khedrax add-module <projectPath> <moduleName>');
      process.exit(1);
    }

    const projectPath = path.resolve(process.cwd(), target);
    const moduleName = rest[0];
    try {
      await addModule(projectPath, moduleName, process.cwd());
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
    return;
  }

  if (deploymentActions.includes(command as typeof deploymentActions[number])) {
    if (!target) {
      console.error(`Usage: khedrax ${command} <projectPath>`);
      process.exit(1);
    }

    const projectPath = path.resolve(process.cwd(), target);
    const exitCode = await runDeploymentScript(command, projectPath);
    process.exit(exitCode);
  }

  console.error('Usage: khedrax create <Name> | khedrax add-module <projectPath> <moduleName> | khedrax <deploy|status|logs|rollback|destroy|update> <projectPath>');
  process.exit(1);
}

await main();
