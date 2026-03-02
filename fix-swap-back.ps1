$kt = [System.IO.File]::ReadAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"))
$kt = $kt.Replace('                    // Try NV21 directly (no UV swap)
                    val yuvImage', '                    // NV12 -> NV21: swap UV pairs
                    val yPlaneSize = frameW * frameH
                    for (i in yPlaneSize until bytes.size - 1 step 2) {
                        val temp = bytes[i]
                        bytes[i] = bytes[i + 1]
                        bytes[i + 1] = temp
                    }
                    val yuvImage')
[System.IO.File]::WriteAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"), $kt, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
