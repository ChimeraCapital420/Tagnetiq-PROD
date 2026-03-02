$kt = [System.IO.File]::ReadAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"))
$old = "            var bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)`n            if (bitmap == null) {`n                result.put(""base64"", """")`n                result.put(""width"", 0)`n                result.put(""height"", 0)`n                result.put(""timestamp"", 0)`n                result.put(""byteSize"", 0)`n                return result`n            }"
$new = @"
            // First try decoding as JPEG/PNG
            var bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            // If null, treat as raw NV21 YUV frame from video stream
            if (bitmap == null) {
                var frameW = 896; var frameH = 504
                val frameSize = bytes.size
                when {
                    frameSize == 3110400 -> { frameW = 1920; frameH = 1080 }
                    frameSize == 677376 -> { frameW = 896; frameH = 504 }
                    frameSize == 345600 -> { frameW = 640; frameH = 360 }
                }
                Log.d(TAG, "Raw YUV frame: `$frameSize bytes -> `${frameW}x`$frameH")
                try {
                    val yuvImage = android.graphics.YuvImage(bytes, android.graphics.ImageFormat.NV21, frameW, frameH, null)
                    val jpegStream = ByteArrayOutputStream()
                    yuvImage.compressToJpeg(android.graphics.Rect(0, 0, frameW, frameH), quality, jpegStream)
                    bitmap = BitmapFactory.decodeByteArray(jpegStream.toByteArray(), 0, jpegStream.size())
                } catch (yuvErr: Exception) {
                    Log.e(TAG, "YUV conversion failed: `${yuvErr.message}")
                }
            }
            if (bitmap == null) {
                result.put("base64", "")
                result.put("width", 0)
                result.put("height", 0)
                result.put("timestamp", 0)
                result.put("byteSize", 0)
                return result
            }
"@
$kt = $kt.Replace($old, $new)
[System.IO.File]::WriteAllText((Resolve-Path "android\app\src\main\java\com\tagnetiq\plugins\metaglasses\MetaGlassesPlugin.kt"), $kt, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
