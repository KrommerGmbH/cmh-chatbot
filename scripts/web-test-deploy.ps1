param(
  [string]$DeployHost = $(if ($env:CMH_DEPLOY_HOST) { $env:CMH_DEPLOY_HOST } else { $env:DOCS_DEPLOY_HOST }),
  [string]$DeployUser = $(if ($env:CMH_DEPLOY_USER) { $env:CMH_DEPLOY_USER } else { $env:DOCS_DEPLOY_USER }),
  [string]$DeployPath = $(if ($env:CMH_DEPLOY_PATH) { $env:CMH_DEPLOY_PATH } else { '/var/www/vhosts/my-mik.de/cmh-chatbot.my-mik.de' }),
  [int]$DeployPort = $(if ($env:CMH_DEPLOY_PORT) { [int]$env:CMH_DEPLOY_PORT } elseif ($env:DOCS_DEPLOY_PORT) { [int]$env:DOCS_DEPLOY_PORT } else { 22 }),
  [string]$SshKeyPath = $(if ($env:CMH_DEPLOY_SSH_KEY_PATH) { $env:CMH_DEPLOY_SSH_KEY_PATH } else { $env:DOCS_DEPLOY_SSH_KEY_PATH }),
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$rendererDist = Join-Path $repoRoot 'dist/renderer'
$runtimeTemp = Join-Path $repoRoot '.deploy/runtime'
$runtimeRemote = "$DeployPath/_runtime"

function Assert-Config {
  if ([string]::IsNullOrWhiteSpace($DeployHost) -or [string]::IsNullOrWhiteSpace($DeployUser) -or [string]::IsNullOrWhiteSpace($DeployPath)) {
    throw "Missing deploy config. Required: CMH_DEPLOY_HOST, CMH_DEPLOY_USER, CMH_DEPLOY_PATH"
  }
  if ($SshKeyPath -and -not (Test-Path $SshKeyPath)) {
    throw "SSH key file not found: $SshKeyPath"
  }
}

function Get-SshArgs {
  $args = @('-p', "$DeployPort")
  if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $args += @('-i', $SshKeyPath)
  }
  return $args
}

function Build-App {
  if ($SkipBuild) { return }

  Write-Host "[web-test-deploy] building engine+renderer..."
  & pnpm --dir $repoRoot run web:test:build
  if ($LASTEXITCODE -ne 0) {
    throw "web:test:build failed"
  }
}

function Prepare-RuntimeBundle {
  Write-Host "[web-test-deploy] preparing runtime bundle..."
  if (Test-Path $runtimeTemp) {
    Remove-Item -LiteralPath $runtimeTemp -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path $runtimeTemp | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $runtimeTemp 'dist') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $runtimeTemp 'scripts') | Out-Null

  Copy-Item -Path (Join-Path $repoRoot 'dist/*') -Destination (Join-Path $runtimeTemp 'dist') -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts/prod-start.cjs') -Destination (Join-Path $runtimeTemp 'scripts/prod-start.cjs') -Force
  Copy-Item -LiteralPath (Join-Path $repoRoot 'package.json') -Destination (Join-Path $runtimeTemp 'package.json') -Force
  Copy-Item -LiteralPath (Join-Path $repoRoot 'pnpm-lock.yaml') -Destination (Join-Path $runtimeTemp 'pnpm-lock.yaml') -Force
}

function Deploy-Files {
  if (-not (Test-Path $rendererDist)) {
    throw "Renderer dist not found: $rendererDist"
  }

  $sshArgs = Get-SshArgs
  $remote = "$DeployUser@$DeployHost"

  Write-Host "[web-test-deploy] ensure remote paths..."
  & ssh @sshArgs $remote "mkdir -p '$DeployPath' '$runtimeRemote'"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create remote paths"
  }

  Write-Host "[web-test-deploy] upload renderer(dist/renderer) -> web root..."
  $scpArgs = @('-P', "$DeployPort")
  if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $scpArgs += @('-i', $SshKeyPath)
  }

  & ssh @sshArgs $remote "find '$DeployPath' -mindepth 1 -maxdepth 1 ! -name '_runtime' -exec rm -rf {} +"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to clean web root"
  }

  & scp @scpArgs -r (Join-Path $rendererDist '*') "$remote`:$DeployPath/"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload renderer dist"
  }

  Write-Host "[web-test-deploy] fixing web root permissions (dirs=755, files=644)..."
  & ssh @sshArgs $remote "find '$DeployPath' -path '$runtimeRemote' -prune -o -type d -exec chmod 755 {} + ; find '$DeployPath' -path '$runtimeRemote' -prune -o -type f -exec chmod 644 {} +"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to fix web root permissions"
  }

  Write-Host "[web-test-deploy] upload runtime bundle -> $runtimeRemote ..."
  & ssh @sshArgs $remote "rm -rf '$runtimeRemote'/*"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to clean runtime dir"
  }

  & scp @scpArgs -r (Join-Path $runtimeTemp '*') "$remote`:$runtimeRemote/"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload runtime bundle"
  }

  Write-Host "[web-test-deploy] done." -ForegroundColor Green
  Write-Host "[web-test-deploy] next(remote): cd $runtimeRemote ; pnpm install --prod --frozen-lockfile ; CMH_LLM_SERVER_URL=http://YOUR_LLM_HOST:8080 pnpm run web:test:start"
}

Assert-Config
Build-App
Prepare-RuntimeBundle
Deploy-Files
