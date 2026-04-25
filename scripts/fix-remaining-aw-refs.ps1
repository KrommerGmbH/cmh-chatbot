#!/usr/bin/env pwsh
# fix-remaining-aw-refs.ps1
# 마이그레이션 후 잔여 aw- 참조를 cmh-로 일괄 치환

Set-Location "E:\Kang\workspace\cmh-chatbot\src\renderer\app"

$excludePatterns = @(
    '*structure\cmh-admin\*',
    '*structure\cmh-admin-menu\*', 
    '*structure\cmh-desktop\*',
    '*structure\cmh-page\*',
    '*structure\cmh-chat-shell\*',
    '*base\cmh-range-slider\*'
)

$files = Get-ChildItem -Recurse -Include "*.ts","*.html","*.scss" | Where-Object {
    $path = $_.FullName
    $skip = $false
    foreach ($pattern in $excludePatterns) {
        if ($path -like $pattern) { $skip = $true; break }
    }
    return (-not $skip)
}

Write-Host "Scanning $($files.Count) files..."
$fixCount = 0

foreach ($f in $files) {
    $content = Get-Content -Path $f.FullName -Raw -Encoding UTF8
    if ([string]::IsNullOrEmpty($content)) { continue }
    
    $original = $content
    
    # 1. SCSS variables: $aw- → $cmh-
    $content = $content -replace '\$aw-', '$cmh-'
    
    # 2. Backtick template strings: `aw- → `cmh-
    $content = $content -replace '`aw-', '`cmh-'
    
    # 3. Square bracket error prefixes: [aw- → [cmh-
    $content = $content -replace '\[aw-', '[cmh-'
    
    # 4. Single-quote strings: 'aw- → 'cmh-
    $content = $content -replace "'aw-", "'cmh-"
    
    # 5. JSDoc tag: @aw-package → @cmh-package  
    $content = $content -replace '@aw-package', '@cmh-package'
    
    # 6. CamelCase inject keys
    $content = $content -replace 'setAwPage', 'setCmhPage'
    $content = $content -replace 'removeAwPage', 'removeCmhPage'
    
    # 7. Teleport target: #aw-modals → #cmh-modals
    $content = $content -replace '#aw-modals', '#cmh-modals'
    
    # 8. Space-prefixed (comments, CSS class values, descriptions)
    $content = $content -replace ' aw-', ' cmh-'
    
    # 9. CSS animation/keyframes names
    $content = $content -replace 'animation:\s*aw-', 'animation: cmh-'
    $content = $content -replace '@keyframes aw-', '@keyframes cmh-'
    
    if ($content -ne $original) {
        Set-Content -Path $f.FullName -Value $content -NoNewline -Encoding UTF8
        $fixCount++
        $rel = $f.FullName.Replace("E:\Kang\workspace\cmh-chatbot\src\renderer\app\", "")
        Write-Host "  Fixed: $rel"
    }
}

Write-Host ""
Write-Host "=== $fixCount files fixed ==="
