$projectRoot = "C:\Users\Bigdr\Tagnetiq-PROD"
$warRoom = Join-Path $projectRoot "war-room"
$reportsDir = Join-Path $warRoom "reports"
$date = Get-Date -Format "yyyy-MM-dd"
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
Write-Host ""
Write-Host "LEXICODA CLO - PATENT DISCOVERY SCAN"
Write-Host "Date: $date"
Write-Host ""
$patentPrompt = "You are Lexicoda, Chief Legal Officer of TagnetIQ, performing a PATENT DISCOVERY review. Read the source code and identify PATENTABLE INNOVATIONS. For each innovation found report: 1) WHAT is the innovation in plain English 2) WHY it is novel compared to prior art 3) Draft one patent claim starting with A method comprising 4) PRIOR ART RISK as LOW MEDIUM or HIGH 5) Whether to PATENT or keep as TRADE SECRET. Known patent targets: HYDRA Multi-AI Consensus Engine, Authority-Routed Dynamic Pricing, Staged Context Propagation, Autonomous AI Board Governance, Collective Intelligence Engine. Do NOT recommend patenting: specific AI model weight values, exact blending formula percentages, tiebreaker threshold values, category keyword lists, confidence calculation formula. Look BEYOND known targets for innovations we may have missed."
$patentFiles = @(
    "api\analyze.ts"
    "api\refine-analysis.ts"
    "src\lib\hydra\index.ts"
    "src\lib\hydra\types.ts"
    "src\lib\hydra\config.ts"
    "src\lib\hydra\ai.ts"
    "src\lib\hydra\consensus.ts"
    "src\lib\hydra\pricing.ts"
    "src\lib\hydra\storage.ts"
    "src\lib\hydra\category-detection.ts"
    "src\lib\hydra\health-check.ts"
    "src\lib\hydra\fetchers\index.ts"
    "src\lib\hydra\fetchers\ebay.ts"
    "src\lib\hydra\fetchers\numista.ts"
    "src\lib\hydra\fetchers\pokemon-tcg.ts"
    "src\lib\hydra\fetchers\brickset.ts"
    "src\lib\hydra\fetchers\google-books.ts"
    "src\lib\hydra\fetchers\discogs.ts"
    "src\lib\hydra\fetchers\retailed.ts"
    "src\lib\hydra\fetchers\psa.ts"
    "src\lib\hydra\fetchers\nhtsa.ts"
    "src\lib\hydra\fetchers\upcitemdb.ts"
    "src\lib\hydra\pricing\blender.ts"
    "src\lib\hydra\pricing\formatter.ts"
    "src\lib\hydra\prompts\analysis.ts"
    "src\lib\hydra\prompts\refinement.ts"
    "src\lib\hydra\knowledge\index.ts"
    "src\lib\hydra\knowledge\pattern-lookup.ts"
    "src\lib\hydra\knowledge\aggregator.ts"
    "src\lib\hydra\benchmarks\index.ts"
    "src\lib\hydra\benchmarks\scorer.ts"
    "src\lib\hydra\benchmarks\aggregator.ts"
    "src\lib\oracle\chat\index.ts"
    "src\lib\oracle\chat\types.ts"
    "src\lib\oracle\chat\validators.ts"
    "src\lib\oracle\chat\detectors.ts"
    "src\lib\oracle\chat\builders.ts"
    "src\lib\oracle\chat\prompt-assembler.ts"
    "src\lib\oracle\chat\response-pipeline.ts"
    "src\lib\oracle\chat\response-builder.ts"
    "src\lib\oracle\chat\correction-extractor.ts"
    "src\lib\oracle\chat\refinement-bridge.ts"
    "src\lib\oracle\tier.ts"
    "src\lib\oracle\trust\trust-level.ts"
    "src\lib\oracle\trust\behavioral-signals.ts"
    "src\lib\boardroom\index.ts"
    "src\lib\boardroom\types.ts"
    "api\oracle\chat.ts"
    "api\oracle\ask.ts"
    "api\feedback.ts"
    "api\cron\aggregate-corrections.ts"
    "src\components\scanner\hooks\useGhostMode.ts"
    "src\components\scanner\utils\compression.ts"
    "src\lib\personas.ts"
    "src\lib\greetings.ts"
    "src\lib\spotlight-tracking.ts"
)
$patentReport = Join-Path $reportsDir "lexicoda-patent-discovery-$date.md"
Set-Content -Path $patentReport -Value "# LEXICODA - Patent Discovery Report`nDate: $date`nScope: TagnetIQ Core IP`n---`n"
$fileCount = 0
$skipped = 0
foreach ($file in $patentFiles) {
    $filePath = Join-Path $projectRoot $file
    if (Test-Path $filePath) {
        $fileCount++
        Write-Host "  Scanning ($fileCount): $file"
        $code = Get-Content $filePath -Raw
        if ($code.Length -gt 12000) {
            $code = $code.Substring(0, 12000)
        }
        $fullPrompt = "$patentPrompt FILE: $file CODE: $code"
        $response = $fullPrompt | ollama run lexicoda 2>&1
        $cleanResponse = "$response" -replace '\[\?[0-9;]*[a-zA-Z]', ''
        Add-Content -Path $patentReport -Value "## $file`n"
        Add-Content -Path $patentReport -Value "$cleanResponse`n"
        Add-Content -Path $patentReport -Value "---`n"
    }
    else {
        $skipped++
    }
}
Write-Host ""
Write-Host "SCAN COMPLETE"
Write-Host "Files scanned: $fileCount"
Write-Host "Files skipped: $skipped"
Write-Host "Report: $patentReport"
