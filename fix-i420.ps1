$kt = [System.IO.File]::ReadAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"))
$old = '                    // NV12 -> NV21: swap UV pairs
                    val yPlaneSize = frameW * frameH
                    for (i in yPlaneSize until bytes.size - 1 step 2) {
                        val temp = bytes[i]
                        bytes[i] = bytes[i + 1]
                        bytes[i + 1] = temp
                    }
                    val yuvImage = android.graphics.YuvImage(bytes, android.graphics.ImageFormat.NV21, frameW, frameH, null)'
$new = '                    // Convert I420 (planar YUV) -> NV21 (semi-planar)
                    // I420: [Y plane][U plane][V plane]
                    // NV21: [Y plane][V0 U0 V1 U1 ...]
                    val ySize = frameW * frameH
                    val uvSize = ySize / 4
                    val nv21 = ByteArray(bytes.size)
                    // Copy Y plane as-is
                    System.arraycopy(bytes, 0, nv21, 0, ySize)
                    // Interleave V and U
                    val uOffset = ySize
                    val vOffset = ySize + uvSize
                    for (i in 0 until uvSize) {
                        nv21[ySize + i * 2] = bytes[vOffset + i]     // V first (NV21)
                        nv21[ySize + i * 2 + 1] = bytes[uOffset + i] // then U
                    }
                    val yuvImage = android.graphics.YuvImage(nv21, android.graphics.ImageFormat.NV21, frameW, frameH, null)'
$kt = $kt.Replace($old, $new)
[System.IO.File]::WriteAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"), $kt, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
