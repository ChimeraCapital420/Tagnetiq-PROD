# fix-api-imports.ps1

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  TagnetIQ API Import Extension Fixer  " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$fixedCount = 0
$errorCount = 0

$files = Get-ChildItem -Path "api" -Recurse -Filter "*.ts"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    
    if ($null -eq $content) {
        continue
    }
    
    $originalContent = $content
    
    $content = $content -replace "from\s+['""]([^'""]*_lib/supaAdmin)(?!\.js)['""]", "from '`$1.js'"
    $content = $content -replace "from\s+['""]([^'""]*_lib/security)(?!\.js)['""]", "from '`$1.js'"
    $content = $content -replace "from\s+['""]([^'""]*_lib/hydra)(?!\.js)['""]", "from '`$1.js'"
    $content = $content -replace "from\s+['""]([^'""]*_lib/rateLimiter)(?!\.js)['""]", "from '`$1.js'"
    
    if ($content -ne $originalContent) {
        try {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            Write-Host "[FIXED] " -ForegroundColor Green -NoNewline
            Write-Host $file.FullName
            $fixedCount++
        }
        catch {
            Write-Host "[ERROR] " -ForegroundColor Red -NoNewline
            Write-Host "Failed to update $($file.FullName): $_"
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "Files fixed: $fixedCount" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "Errors: $errorCount" -ForegroundColor Red
}