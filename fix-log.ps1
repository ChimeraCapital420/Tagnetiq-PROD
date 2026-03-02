$kt = [System.IO.File]::ReadAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"))
$old = 'Log.d(TAG, "Raw YUV frame: ${bytes.size} bytes -> ${frameW}x${frameH}")'
$new = 'Log.d(TAG, "Raw YUV frame: ${bytes.size} bytes -> ${frameW}x${frameH}, first16=[${bytes.take(16).joinToString(",") { String.format("%02X", it) }}]")'
$kt = $kt.Replace($old, $new)
[System.IO.File]::WriteAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"), $kt, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
