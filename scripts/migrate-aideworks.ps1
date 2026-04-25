#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────
# AideWorks → cmh-chatbot 마이그레이션 스크립트
# aw- prefix → cmh- prefix 일괄 변환
# ─────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'

$SRC  = 'E:\Kang\workspace\aideworks\src\renderer\app'
$DEST = 'E:\Kang\workspace\cmh-chatbot\src\renderer\app'

# ── 이미 cmh-chatbot에 존재하여 건너뛸 컴포넌트 (aw-* 이름 기준) ──
$SKIP_COMPONENTS = @(
    'aw-admin',
    'aw-admin-menu',
    'aw-desktop',
    'aw-page',
    'aw-range-slider'
)

# ── sw-* 레거시 폴더 제외 패턴 ──
$SKIP_PATTERNS = @('sw-*')

# ── 마이그레이션할 인프라 디렉토리 ──
$INFRA_DIRS = @('composables', 'directive', 'filter', 'mixin')

# ── prefix 치환 함수 ──
function Convert-AwToCmh {
    param([string]$Content)
    
    # 1. Component names in quotes: 'aw-xxx' → 'cmh-xxx'
    $Content = $Content -replace "'aw-([^']+)'", "'cmh-`$1'"
    $Content = $Content -replace '"aw-([^"]+)"', '"cmh-$1"'
    
    # 2. CSS BEM classes: .aw-xxx → .cmh-xxx
    $Content = $Content -replace '\.aw-', '.cmh-'
    
    # 3. HTML template tags: <aw-xxx → <cmh-xxx, </aw-xxx → </cmh-xxx
    $Content = $Content -replace '<aw-', '<cmh-'
    $Content = $Content -replace '</aw-', '</cmh-'
    
    # 4. CSS class references in :class, class=: aw-xxx__ → cmh-xxx__
    $Content = $Content -replace 'aw-([a-z0-9-]+)__', 'cmh-$1__'
    
    # 5. Import paths: /aw-xxx/ → /cmh-xxx/, ./aw-xxx → ./cmh-xxx
    $Content = $Content -replace '/aw-([a-z0-9-]+)/', '/cmh-$1/'
    $Content = $Content -replace '\./aw-([a-z0-9-]+)', './cmh-$1'
    
    # 6. Component extends references
    $Content = $Content -replace 'from\s+[''"]([^''"]*)/aw-', 'from ''$1/cmh-'
    
    # 7. CSS var prefix: --aw- → --cmh-
    $Content = $Content -replace '--aw-', '--cmh-'
    
    return $Content
}

# ── 파일 복사 + 이름 변환 + 내용 치환 ──
function Copy-ComponentDir {
    param(
        [string]$SrcDir,
        [string]$DestParent
    )
    
    $dirName = Split-Path $SrcDir -Leaf
    
    # Skip 체크
    if ($dirName -in $SKIP_COMPONENTS) {
        Write-Host "  SKIP (already exists): $dirName" -ForegroundColor Yellow
        return 0
    }
    foreach ($pattern in $SKIP_PATTERNS) {
        if ($dirName -like $pattern) {
            Write-Host "  SKIP (legacy): $dirName" -ForegroundColor DarkGray
            return 0
        }
    }
    
    $newDirName = $dirName -replace '^aw-', 'cmh-'
    $destDir = Join-Path $DestParent $newDirName
    
    if (Test-Path $destDir) {
        Write-Host "  SKIP (dest exists): $newDirName" -ForegroundColor Yellow
        return 0
    }
    
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    
    $count = 0
    Get-ChildItem $SrcDir -File | ForEach-Object {
        $srcFile = $_
        $newFileName = $srcFile.Name -replace 'aw-', 'cmh-'
        $destFile = Join-Path $destDir $newFileName
        
        $content = Get-Content $srcFile.FullName -Raw -Encoding UTF8
        $content = Convert-AwToCmh $content
        
        Set-Content -Path $destFile -Value $content -Encoding UTF8 -NoNewline
        $count++
    }
    
    Write-Host "  OK: $dirName → $newDirName ($count files)" -ForegroundColor Green
    return $count
}

# ── 인프라 파일 복사 (composables, directive 등) ──
function Copy-InfraDir {
    param(
        [string]$DirName
    )
    
    $srcDir = Join-Path $SRC $DirName
    $destDir = Join-Path $DEST $DirName
    
    if (-not (Test-Path $srcDir)) {
        Write-Host "  SKIP (not found): $DirName" -ForegroundColor Yellow
        return 0
    }
    
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    
    $count = 0
    Get-ChildItem $srcDir -File -Recurse | ForEach-Object {
        $srcFile = $_
        $relativePath = $srcFile.FullName.Substring($srcDir.Length + 1)
        $newRelativePath = $relativePath -replace 'aw-', 'cmh-'
        $destFile = Join-Path $destDir $newRelativePath
        
        $destFileDir = Split-Path $destFile -Parent
        if (-not (Test-Path $destFileDir)) {
            New-Item -ItemType Directory -Path $destFileDir -Force | Out-Null
        }
        
        # Skip if destination already exists
        if (Test-Path $destFile) {
            Write-Host "    SKIP (exists): $newRelativePath" -ForegroundColor Yellow
            return
        }
        
        $content = Get-Content $srcFile.FullName -Raw -Encoding UTF8
        $content = Convert-AwToCmh $content
        
        Set-Content -Path $destFile -Value $content -Encoding UTF8 -NoNewline
        $count++
    }
    
    Write-Host "  OK: $DirName ($count files)" -ForegroundColor Green
    return $count
}

# ── Store 파일 복사 ──
function Copy-StoreFiles {
    $srcDir = Join-Path $SRC 'store'
    $destDir = Join-Path $DEST 'store'
    
    $count = 0
    Get-ChildItem $srcDir -File | ForEach-Object {
        $srcFile = $_
        $destFile = Join-Path $destDir $srcFile.Name
        
        if (Test-Path $destFile) {
            Write-Host "    SKIP (exists): $($srcFile.Name)" -ForegroundColor Yellow
            return
        }
        
        $content = Get-Content $srcFile.FullName -Raw -Encoding UTF8
        $content = Convert-AwToCmh $content
        
        Set-Content -Path $destFile -Value $content -Encoding UTF8 -NoNewline
        $count++
        Write-Host "    OK: $($srcFile.Name)" -ForegroundColor Green
    }
    
    return $count
}

# ════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════

Write-Host "`n=== AideWorks → cmh-chatbot Migration ===" -ForegroundColor Cyan
$totalFiles = 0

# ── 1. Infrastructure ──
Write-Host "`n── Infrastructure ──" -ForegroundColor Cyan
foreach ($dir in $INFRA_DIRS) {
    $totalFiles += (Copy-InfraDir $dir)
}

# ── 2. Store ──
Write-Host "`n── Store ──" -ForegroundColor Cyan
$totalFiles += (Copy-StoreFiles)

# ── 3. Components by category ──
$COMPONENT_CATEGORIES = @(
    'base', 'context-menu', 'data-grid', 'entity', 'filter',
    'grid', 'list', 'media', 'modal', 'sidebar', 'structure', 'utils'
)

foreach ($category in $COMPONENT_CATEGORIES) {
    $srcCategoryDir = Join-Path $SRC "component\$category"
    $destCategoryDir = Join-Path $DEST "component\$category"
    
    if (-not (Test-Path $srcCategoryDir)) {
        continue
    }
    
    Write-Host "`n── component/$category ──" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $destCategoryDir -Force | Out-Null
    
    Get-ChildItem $srcCategoryDir -Directory | ForEach-Object {
        $totalFiles += (Copy-ComponentDir $_.FullName $destCategoryDir)
    }
}

Write-Host "`n=== Migration Complete: $totalFiles files created ===" -ForegroundColor Green
