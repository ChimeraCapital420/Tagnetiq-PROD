# ============================================================
# TagnetIQ War Room — Model Upgrade Script
# Swaps the brain, keeps the soul.
# Run when new open-source models drop.
# ============================================================

$warRoom = "C:\Users\Bigdr\Tagnetiq-PROD\war-room"

# Current model assignments — edit these when upgrading
$models = @{
    "vulcan"   = "qwen2.5-coder:7b"   # CTO — code review
    "lexicoda" = "mistral:7b"          # CLO — legal compliance
    # Future board members:
    # "griffin"   = "qwen2.5:7b"       # CFO — financial analysis
    # "athena"    = "llama3.1:8b"      # CSO — strategy
    # "glitch"    = "llama3.1:8b"      # CMO — SEO/marketing
    # "sentinel"  = "llama3.1:8b"      # CISO — security
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  WAR ROOM — MODEL UPGRADE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

foreach ($member in $models.GetEnumerator()) {
    $name = $member.Key
    $model = $member.Value
    $modelfile = "$warRoom\modelfiles\$($name.Substring(0,1).ToUpper() + $name.Substring(1)).Modelfile"
    
    if (Test-Path $modelfile) {
        Write-Host "Upgrading $name to $model..." -ForegroundColor Yellow
        
        # Pull latest version of the base model
        ollama pull $model
        
        # Update the FROM line in the Modelfile
        $content = Get-Content $modelfile -Raw
        $content = $content -replace '^FROM .*', "FROM $model"
        Set-Content -Path $modelfile -Value $content
        
        # Rebuild the custom model
        ollama create $name -f $modelfile
        
        Write-Host "$name upgraded to $model ✅" -ForegroundColor Green
    } else {
        Write-Host "SKIP: $modelfile not found" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "All board members upgraded." -ForegroundColor Cyan
Write-Host "Run 'ollama list' to verify." -ForegroundColor DarkGray
Write-Host ""
