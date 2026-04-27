#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const isCheckOnly = args.has('--check');
const printPathOnly = args.has('--print-path');
const installLocalOnly = args.has('--install-local');

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveCommand(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if ((result.status ?? 1) !== 0) return null;
  const line = (result.stdout || '').split(/\r?\n/).map((v) => v.trim()).find(Boolean);
  return line || null;
}

function getPlatformBinaryName() {
  return process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
}

function findExistingRuntime() {
  const binaryName = getPlatformBinaryName();
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'bin', 'llama-b8712', binaryName),
    path.resolve(cwd, '.runtime', 'llama.cpp', `${process.platform}-${process.arch}`, binaryName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && (process.platform === 'win32' || isExecutable(candidate))) {
      return { path: candidate, source: 'local' };
    }
  }

  const globalPath = resolveCommand('llama-server');
  if (globalPath) {
    return { path: globalPath, source: 'global' };
  }

  return null;
}

function getPlatformRuntimeDir() {
  return path.resolve(process.cwd(), '.runtime', 'llama.cpp', `${process.platform}-${process.arch}`);
}

function copyLocalBinaryToRuntime(sourcePath) {
  const binaryName = getPlatformBinaryName();
  const runtimeDir = getPlatformRuntimeDir();
  fs.mkdirSync(runtimeDir, { recursive: true });
  const targetPath = path.resolve(runtimeDir, binaryName);
  fs.copyFileSync(sourcePath, targetPath);
  if (process.platform !== 'win32') {
    fs.chmodSync(targetPath, 0o755);
  }
  return targetPath;
}

function tryInstallFromLocalPath() {
  const binaryName = getPlatformBinaryName();
  const candidates = [
    process.env.CMH_LLAMA_SERVER_LOCAL_PATH,
    path.resolve(process.cwd(), binaryName),
    path.resolve(process.cwd(), 'downloads', binaryName),
    path.resolve(process.cwd(), 'bin', binaryName),
  ].filter(Boolean);

  const resolvedSource = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolvedSource) return null;

  const installedPath = copyLocalBinaryToRuntime(resolvedSource);
  return { path: installedPath, source: 'local-copy' };
}

function downloadFile(url, outFile) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy();
        return resolve(downloadFile(res.headers.location, outFile));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`download failed: HTTP ${res.statusCode}`));
      }

      const file = fs.createWriteStream(outFile);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    });
    req.on('error', reject);
  });
}

function extractArchive(archivePath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const isZip = /\.zip$/i.test(archivePath);

  if (isZip) {
    if (process.platform === 'win32') {
      const pwsh = spawnSync('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path \"${archivePath}\" -DestinationPath \"${targetDir}\" -Force`,
      ], { stdio: 'inherit' });
      return (pwsh.status ?? 1) === 0;
    }

    const unzip = spawnSync('unzip', ['-o', archivePath, '-d', targetDir], { stdio: 'inherit' });
    return (unzip.status ?? 1) === 0;
  }

  const tar = spawnSync('tar', ['-xzf', archivePath, '-C', targetDir], { stdio: 'inherit' });
  return (tar.status ?? 1) === 0;
}

function findExtractedBinary(targetDir) {
  const binaryName = getPlatformBinaryName();
  const stack = [targetDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir || !fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.name === binaryName) {
        if (process.platform !== 'win32') {
          fs.chmodSync(full, 0o755);
        }
        return full;
      }
    }
  }

  return null;
}

async function tryBootstrapFromUrl() {
  const runtimeUrl = process.env.CMH_LLAMA_SERVER_URL?.trim();
  if (!runtimeUrl) return null;

  const cacheRoot = path.resolve(process.cwd(), '.runtime', 'downloads');
  const platformRoot = getPlatformRuntimeDir();
  fs.mkdirSync(cacheRoot, { recursive: true });
  fs.mkdirSync(platformRoot, { recursive: true });

  const fileName = path.basename(new URL(runtimeUrl).pathname) || 'llama-runtime.tgz';
  const archivePath = path.resolve(cacheRoot, fileName);

  console.log(`[llama-runtime] download: ${runtimeUrl}`);
  await downloadFile(runtimeUrl, archivePath);

  console.log(`[llama-runtime] extract: ${archivePath}`);
  const ok = extractArchive(archivePath, platformRoot);
  if (!ok) {
    throw new Error('failed to extract downloaded runtime archive');
  }

  return findExtractedBinary(platformRoot);
}

function printMissingHelp() {
  console.error('[llama-runtime] llama-server binary not found.');
  console.error('  1) Place binary at: ./bin/llama-b8712/' + getPlatformBinaryName());
  console.error('  1-1) OR copy binary path via env: CMH_LLAMA_SERVER_LOCAL_PATH=/path/to/' + getPlatformBinaryName());
  console.error('       then run: node scripts/ensure-llama-runtime.cjs --install-local');
  console.error('  2) OR install globally so `llama-server` is in PATH');
  console.error('  3) OR set CMH_LLAMA_SERVER_URL to runtime archive(.zip/.tar.gz) and rerun');
  console.error(`     current platform: ${process.platform}-${process.arch} (${os.release()})`);
}

async function main() {
  let resolved = findExistingRuntime();

  if (!resolved && !isCheckOnly) {
    const localInstalled = tryInstallFromLocalPath();
    if (localInstalled) {
      resolved = localInstalled;
    }
  }

  if (!resolved && !isCheckOnly && !installLocalOnly) {
    try {
      const bootstrapped = await tryBootstrapFromUrl();
      if (bootstrapped) {
        resolved = { path: bootstrapped, source: 'downloaded' };
      }
    } catch (error) {
      console.error('[llama-runtime] bootstrap failed:', error instanceof Error ? error.message : String(error));
    }
  }

  if (!resolved) {
    printMissingHelp();
    process.exit(1);
  }

  if (printPathOnly) {
    process.stdout.write(resolved.path);
    return;
  }

  console.log(`[llama-runtime] ready (${resolved.source}): ${resolved.path}`);
}

main().catch((err) => {
  console.error('[llama-runtime] fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
