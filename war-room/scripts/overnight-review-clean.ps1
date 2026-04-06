$projectRoot = "C:\Users\Bigdr\Tagnetiq-PROD"
$warRoom = Join-Path $projectRoot "war-room"
$reportsDir = Join-Path $warRoom "reports"
$date = Get-Date -Format "yyyy-MM-dd"

New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

Write-Host ""
Write-Host "============================================"
Write-Host "  TAGNETIQ WAR ROOM - OVERNIGHT REVIEW"
Write-Host "  Date: $date"
Write-Host "============================================"
Write-Host ""

# Create custom models if needed
$vulcanExists = ollama list 2>&1 | Select-String "vulcan"
$lexicodaExists = ollama list 2>&1 | Select-String "lexicoda"

if (-not $vulcanExists) {
    Write-Host "  Creating Vulcan CTO..."
    ollama create vulcan -f (Join-Path $warRoom "modelfiles\Vulcan.Modelfile")
}
else {
    Write-Host "  Vulcan CTO ready."
}

if (-not $lexicodaExists) {
    Write-Host "  Creating Lexicoda CLO..."
    ollama create lexicoda -f (Join-Path $warRoom "modelfiles\Lexicoda.Modelfile")
}
else {
    Write-Host "  Lexicoda CLO ready."
}

# Files for Vulcan to review
$vulcanFiles = @(
    "api\analyze.ts"
    "api\feedback.ts"
    "api\flags.ts"
    "api\metrics.ts"
    "api\pixel.ts"
    "api\refine-analysis.ts"
    "api\test-providers.ts"
    "api\arena\listings.ts"
    "api\arena\marketplace.ts"
    "api\arena\messages.ts"
    "api\arena\conversations.ts"
    "api\arena\watchlist.ts"
    "api\arena\leaderboard.ts"
    "api\arena\log-sale.ts"
    "api\arena\challenge.ts"
    "api\arena\complete-verification.ts"
    "api\arena\request-verification-upload.ts"
    "api\arena\mark-intro-seen.ts"
    "api\arena\spotlight-items.ts"
    "api\feedback\health-check.ts"
    "api\seller\invite.ts"
    "api\seller\kpis.ts"
    "api\seller\pixel.ts"
    "api\seller\welcome-pdf.ts"
)

# Files for Lexicoda to review
$lexicodaFiles = @(
    "api\analyze.ts"
    "api\arena\listings.ts"
    "api\arena\marketplace.ts"
    "api\arena\messages.ts"
    "api\arena\conversations.ts"
    "api\arena\log-sale.ts"
    "api\arena\complete-verification.ts"
    "api\pixel.ts"
    "api\seller\pixel.ts"
    "api\seller\kpis.ts"
    "tailwind.config.ts"
    "vite.config.ts"
)

Write-Host "  Vulcan queue: $($vulcanFiles.Count) files"
Write-Host "  Lexicoda queue: $($lexicodaFiles.Count) files"

# VULCAN REVIEW
Write-Host ""
Write-Host "Vulcan CTO - Code Review Starting..."

$vulcanReport = Join-Path $reportsDir "vulcan-review-$date.md"
Set-Content -Path $vulcanReport -Value "# VULCAN - CTO Code Review`nDate: $date`nModel: qwen2.5-coder 7B`n---`n"

$v = 0
foreach ($file in $vulcanFiles) {
    $filePath = Join-Path $projectRoot $file
    if (Test-Path $filePath) {
        $v++
        Write-Host "  Vulcan reviewing ($v of $($vulcanFiles.Count)): $file"

        $code = Get-Content $filePath -Raw

        if ($code.Length -gt 12000) {
            $code = $code.Substring(0, 12000) + "`n`n// TRUNCATED - file exceeds 12K chars"
        }

        $prompt = "Review this TagnetIQ file called $file for security issues, error handling gaps, performance problems, and mobile-first violations. Be specific about line-level issues. Here is the code:`n`n$code"

        $response = $prompt | ollama run vulcan 2>&1

        Add-Content -Path $vulcanReport -Value "## $file`n"
        Add-Content -Path $vulcanReport -Value "$response`n"
        Add-Content -Path $vulcanReport -Value "---`n"
    }
    else {
        Write-Host "  SKIP: $file not found"
    }
}

Write-Host "  Vulcan complete. $v files reviewed."

# LEXICODA REVIEW
Write-Host ""
Write-Host "Lexicoda CLO - Legal Review Starting..."

$lexicodaReport = Join-Path $reportsDir "lexicoda-review-$date.md"
Set-Content -Path $lexicodaReport -Value "# LEXICODA - CLO Legal Review`nDate: $date`nModel: mistral 7B`n---`n"

$l = 0
foreach ($file in $lexicodaFiles) {
    $filePath = Join-Path $projectRoot $file
    if (Test-Path $filePath) {
        $l++
        Write-Host "  Lexicoda reviewing ($l of $($lexicodaFiles.Count)): $file"

        $code = Get-Content $filePath -Raw

        if ($code.Length -gt 12000) {
            $code = $code.Substring(0, 12000) + "`n`n// TRUNCATED - file exceeds 12K chars"
        }

        $prompt = "Review this TagnetIQ file called $file for legal exposure, privacy violations, API Terms of Service compliance, authentication gaps, user data handling issues, and IP protection concerns. Be specific. Here is the code:`n`n$code"

        $response = $prompt | ollama run lexicoda 2>&1

        Add-Content -Path $lexicodaReport -Value "## $file`n"
        Add-Content -Path $lexicodaReport -Value "$response`n"
        Add-Content -Path $lexicodaReport -Value "---`n"
    }
    else {
        Write-Host "  SKIP: $file not found"
    }
}

Write-Host "  Lexicoda complete. $l files reviewed."

# SUMMARY
Write-Host ""
Write-Host "============================================"
Write-Host "  WAR ROOM OVERNIGHT REVIEW COMPLETE"
Write-Host "============================================"
Write-Host ""
Write-Host "  Vulcan reviewed $v files"
Write-Host "  Lexicoda reviewed $l files"
Write-Host ""
Write-Host "  Reports:"
Write-Host "    $vulcanReport"
Write-Host "    $lexicodaReport"
Write-Host ""
Write-Host "  Good night. The board is working."
Write-Host ""