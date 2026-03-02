$lines = [System.Collections.ArrayList]@(Get-Content android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt)
# Find line with "var frameW = 896" in compressFrameBytes and replace the whole block
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'var frameW = 896') {
        # Replace from this line through the closing brace of the when block
        # Find where the when block ends (line with just "}")
        $start = $i
        $end = $i
        for ($j = $i; $j -lt $lines.Count; $j++) {
            if ($lines[$j] -match 'Log.d\(TAG, "Raw YUV') {
                $end = $j
                break
            }
        }
        # Replace all those lines with simple dimension use
        for ($k = $start; $k -le $end; $k++) {
            $lines[$k] = '<<REMOVE>>'
        }
        $lines[$start] = '                var frameW = latestFrameWidth; var frameH = latestFrameHeight
                if (frameW == 0 || frameH == 0) { frameW = 504; frameH = 896 }
                Log.d(TAG, "Raw YUV frame: ${bytes.size} bytes -> ${frameW}x${frameH}")'
        break
    }
}
$filtered = $lines | Where-Object { $_ -ne '<<REMOVE>>' }
$text = $filtered -join "`n"
[System.IO.File]::WriteAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"), $text, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
