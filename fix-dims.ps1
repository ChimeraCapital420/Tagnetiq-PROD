$lines = [System.Collections.ArrayList]@(Get-Content android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt)

# 1. Add width/height storage near latestFrameBytes declaration
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'private var latestFrameTimestamp') {
        $lines.Insert($i + 1, '    private var latestFrameWidth = 0')
        $lines.Insert($i + 2, '    private var latestFrameHeight = 0')
        break
    }
}

# 2. Store width/height from frame in collect lambda - find "latestFrameBytes = bytes"
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'latestFrameBytes = bytes' -and $lines[$i] -notmatch 'Log') {
        $lines[$i] = $lines[$i] + "`n                        latestFrameWidth = frame.width`n                        latestFrameHeight = frame.height"
        break
    }
}

# 3. Replace the hardcoded resolution guessing with stored dimensions
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'var frameW = 896; var frameH = 504') {
        # Replace from here through the when block
        $lines[$i] = '                var frameW = latestFrameWidth'
        $j = $i + 1
        # Remove the when block lines
        while ($j -lt $lines.Count -and $lines[$j] -notmatch 'Log.d\(TAG, "Raw YUV') {
            if ($lines[$j] -match 'val frameSize|when|frameSize ==|else ->|val pixels|frameH = Math|frameW = \(') {
                $lines[$j] = ''
            }
            $j++
        }
        # Insert simple fallback after frameW line
        $lines.Insert($i + 1, '                var frameH = latestFrameHeight')
        $lines.Insert($i + 2, '                if (frameW == 0 || frameH == 0) { frameW = 504; frameH = 896 }')
        break
    }
}

$text = ($lines | Where-Object { $_ -ne '' -or $true }) -join "`n"
# Clean up empty lines from removed code
$text = $text -replace "`n`n`n`n+", "`n`n"
[System.IO.File]::WriteAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"), $text, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
