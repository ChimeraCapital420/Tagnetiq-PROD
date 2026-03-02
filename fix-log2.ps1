$kt = [System.IO.File]::ReadAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"))
$old = 'session.videoStream.collect { frame ->'
$new = 'session.videoStream.collect { frame ->
                    if (frameCount < 2) Log.d(TAG, "VideoFrame props: ${frame.javaClass.declaredFields.map { it.name }.joinToString()}, toString=${frame}")'
$kt = $kt.Replace($old, $new)
[System.IO.File]::WriteAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"), $kt, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
