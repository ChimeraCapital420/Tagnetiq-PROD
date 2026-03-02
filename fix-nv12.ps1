$kt = [System.IO.File]::ReadAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"))
$old = '                    val yuvImage = android.graphics.YuvImage(bytes, android.graphics.ImageFormat.NV21, frameW, frameH, null)'
$new = '                    // SDK sends NV12 (UVUV), Android YuvImage needs NV21 (VUVU) - swap UV pairs
                    val yPlaneSize = frameW * frameH
                    for (i in yPlaneSize until bytes.size - 1 step 2) {
                        val temp = bytes[i]
                        bytes[i] = bytes[i + 1]
                        bytes[i + 1] = temp
                    }
                    val yuvImage = android.graphics.YuvImage(bytes, android.graphics.ImageFormat.NV21, frameW, frameH, null)'
$kt = $kt.Replace($old, $new)
[System.IO.File]::WriteAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"), $kt, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
