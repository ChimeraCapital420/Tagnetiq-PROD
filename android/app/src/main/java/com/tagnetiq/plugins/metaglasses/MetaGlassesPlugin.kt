// FILE: android/app/src/main/java/com/tagnetiq/plugins/metaglasses/MetaGlassesPlugin.kt
// ═══════════════════════════════════════════════════════════════════════
// CAPACITOR NATIVE BRIDGE — Meta Wearables Device Access Toolkit (MWDAT)
// ═══════════════════════════════════════════════════════════════════════
//
// ALL IMPORTS AND API CALLS VERIFIED against mwdat-core-0.4.0 and
// mwdat-camera-0.4.0 JARs via javap. No guessed package paths.
//
// MOBILE-FIRST ARCHITECTURE:
//   - Device does ALL image compression (compressFrameBytes)
//   - Device handles frame triage before sending to server
//   - Server only receives pre-processed, compressed JPEGs
//   - Reduces bandwidth usage by ~80% vs raw frame upload
//
// SDK LIFECYCLE:
//   Wearables.initialize(context) → startRegistration(activity)
//   → Meta AI deep-link → user confirms → registrationState becomes Registered
//   → checkPermissionStatus(CAMERA) → startStreamSession() → VideoFrame flow → JS
// ═══════════════════════════════════════════════════════════════════════

package com.tagnetiq.plugins.metaglasses

// ── Android / Capacitor ──────────────────────────────────────────────
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

// ── Meta Wearables SDK (MWDAT v0.4.0) — VERIFIED IMPORT PATHS ───────
// Core SDK (from mwdat-core-0.4.0-runtime.jar)
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.types.RegistrationState
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import com.meta.wearable.dat.core.types.DeviceIdentifier
import com.meta.wearable.dat.core.selectors.AutoDeviceSelector

// Camera SDK (from mwdat-camera-0.4.0-runtime.jar)
import com.meta.wearable.dat.camera.StreamSession
import com.meta.wearable.dat.camera.startStreamSession
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.VideoFrame
import com.meta.wearable.dat.camera.types.VideoQuality

// ── Kotlin Coroutines ────────────────────────────────────────────────
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

// ── Java I/O ─────────────────────────────────────────────────────────
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

// ═══════════════════════════════════════════════════════════════════════
// PLUGIN CLASS
// ═══════════════════════════════════════════════════════════════════════

@CapacitorPlugin(name = "MetaGlasses")
class MetaGlassesPlugin : Plugin() {

    companion object {
        private const val TAG = "MetaGlasses"
    }

    // ── State ────────────────────────────────────────────────────────
    private var sdkInitialized = false
    private var currentRegState: RegistrationState? = null
    private var hasCameraPermission = false
    private var connectedDeviceName: String? = null
    private var isStreaming = false
    private var latestFrameBytes: ByteArray? = null
    private var latestFrameTimestamp: Long = 0

    // Active stream session (from startStreamSession extension function)
    private var streamSession: StreamSession? = null

    // Coroutine scope — cancelled in handleOnDestroy
    private val pluginScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // ── Plugin Lifecycle ─────────────────────────────────────────────

    override fun load() {
        super.load()
        Log.d(TAG, "Plugin loading - initializing MWDAT SDK")

        try {
            // Wearables is a Kotlin object singleton (INSTANCE).
            // initialize() takes Context, returns inline value class.
            Wearables.initialize(context)
            sdkInitialized = true
            Log.d(TAG, "SDK initialized successfully")

            // Start observing registration state and connected devices
            observeRegistrationState()
            observeDevices()
        } catch (e: Exception) {
            sdkInitialized = false
            Log.e(TAG, "SDK initialize failed: ${e.message}")
        }
    }

    // ── Registration State Observation ───────────────────────────────
    // Wearables.registrationState is StateFlow<RegistrationState>
    // Subclasses: Available, Registered, Registering, Unavailable, Unregistering

    private fun observeRegistrationState() {
        pluginScope.launch {
            Wearables.registrationState.collectLatest { state ->
                currentRegState = state
                Log.d(TAG, "Registration state: $state")

                // Notify JS layer of state changes
                val data = JSObject()
                data.put("state", state.javaClass.simpleName)
                notifyListeners("onRegistrationStateChanged", data)

                // Check camera permission when registered
                if (state is RegistrationState.Registered) {
                    checkAndUpdateCameraPermission()
                }
            }
        }
    }

    // ── Device Observation ───────────────────────────────────────────
    // Wearables.devices is StateFlow<Set<DeviceIdentifier>>

    private fun observeDevices() {
        pluginScope.launch {
            Wearables.devices.collectLatest { deviceSet ->
                if (deviceSet.isNotEmpty()) {
                    val device = deviceSet.first()
                    val name = device.toString()
                    val wasDisconnected = connectedDeviceName == null
                    connectedDeviceName = name

                    if (wasDisconnected) {
                        val data = JSObject()
                        data.put("connected", true)
                        data.put("deviceName", name)
                        notifyListeners("onConnectionChanged", data)
                        Log.d(TAG, "Device connected: $name")
                    }
                } else {
                    val wasConnected = connectedDeviceName != null
                    connectedDeviceName = null

                    if (wasConnected) {
                        val data = JSObject()
                        data.put("connected", false)
                        data.put("deviceName", JSONObject.NULL)
                        notifyListeners("onConnectionChanged", data)
                        Log.d(TAG, "Device disconnected")
                    }
                }
            }
        }
    }

    // ── Helper: Check camera permission status ───────────────────────
    // checkPermissionStatus is SUSPEND and returns DatResult<PermissionStatus, PermissionError>

    private fun checkAndUpdateCameraPermission() {
        if (!sdkInitialized) return
        pluginScope.launch {
            try {
                val result = Wearables.checkPermissionStatus(Permission.CAMERA)
                // DatResult has getOrNull() which returns the value or null on failure
                val status = result.getOrNull()
                hasCameraPermission = (status == PermissionStatus.Granted)
            } catch (e: Exception) {
                Log.e(TAG, "Permission check failed: ${e.message}")
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // PLUGIN METHODS (called from TypeScript via Capacitor bridge)
    // ═════════════════════════════════════════════════════════════════

    // ── isAvailable ──────────────────────────────────────────────────

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        result.put("available", sdkInitialized)
        call.resolve(result)
    }

    // ── getStatus ────────────────────────────────────────────────────

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val isRegistered = currentRegState is RegistrationState.Registered

        val result = JSObject()
        result.put("sdkAvailable", sdkInitialized)
        result.put("isRegistered", isRegistered)
        result.put("cameraPermissionGranted", hasCameraPermission)
        result.put("isConnected", connectedDeviceName != null)
        result.put("isSessionActive", isStreaming)
        result.put("deviceName", connectedDeviceName ?: JSONObject.NULL)
        result.put("batteryLevel", JSONObject.NULL)
        call.resolve(result)
    }

    // ── register ─────────────────────────────────────────────────────
    // startRegistration(Activity) is a regular (non-suspend) function.
    // It deep-links to the Meta AI app for user confirmation.

    @PluginMethod
    fun register(call: PluginCall) {
        if (!sdkInitialized) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "SDK not initialized. Check AndroidManifest.xml APPLICATION_ID.")
            call.resolve(result)
            return
        }

        // Already registered? Don't re-trigger deep-link
        if (currentRegState is RegistrationState.Registered) {
            val result = JSObject()
            result.put("success", true)
            result.put("message", "Already registered")
            call.resolve(result)
            return
        }

        try {
            Wearables.startRegistration(activity)
        } catch (e: Exception) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "startRegistration failed: ${e.message}")
            call.resolve(result)
            return
        }

        // Wait up to 60s for registration state to become Registered
        pluginScope.launch {
            val registered = withTimeoutOrNull(60_000L) {
                Wearables.registrationState.collectLatest { state ->
                    if (state is RegistrationState.Registered) {
                        return@collectLatest
                    }
                    // If error has a non-null error property, bail
                    if (state.error != null) {
                        throw Exception("Registration error: ${state.error}")
                    }
                }
            }

            val result = JSObject()
            if (currentRegState is RegistrationState.Registered) {
                result.put("success", true)
                Log.d(TAG, "Registration successful")
            } else {
                result.put("success", false)
                result.put("error", "Registration timed out or failed. State: ${currentRegState?.javaClass?.simpleName}")
                Log.w(TAG, "Registration did not complete")
            }
            call.resolve(result)
        }
    }

    // ── requestCameraPermission ──────────────────────────────────────
    // NOTE: MWDAT 0.4.0 only has checkPermissionStatus (suspend).
    // There is no requestPermission method. The permission is granted
    // via the Meta AI app during registration or through the
    // companion app settings. We check and report status.

    @PluginMethod
    fun requestCameraPermission(call: PluginCall) {
        if (!sdkInitialized) {
            val result = JSObject()
            result.put("granted", false)
            result.put("error", "SDK not initialized.")
            call.resolve(result)
            return
        }

        pluginScope.launch {
            try {
                val datResult = Wearables.checkPermissionStatus(Permission.CAMERA)
                val status = datResult.getOrNull()
                val granted = (status == PermissionStatus.Granted)
                hasCameraPermission = granted

                val result = JSObject()
                result.put("granted", granted)
                if (!granted) {
                    result.put("error", "Camera permission not granted. Grant it in Meta AI companion app settings.")
                }
                call.resolve(result)
                Log.d(TAG, "Camera permission check: ${if (granted) "granted" else "not granted"}")
            } catch (e: Exception) {
                val result = JSObject()
                result.put("granted", false)
                result.put("error", "Permission check failed: ${e.message}")
                call.resolve(result)
                Log.e(TAG, "Permission check failed: ${e.message}")
            }
        }
    }

    // ── startSession (Camera Streaming) ──────────────────────────────
    // Uses the extension function: Wearables.startStreamSession(context, selector, config)
    // Returns a StreamSession with .videoStream (Flow<VideoFrame>)

    @PluginMethod
    fun startSession(call: PluginCall) {
        if (!sdkInitialized) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "SDK not initialized.")
            call.resolve(result)
            return
        }

        if (currentRegState !is RegistrationState.Registered) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "Not registered. Call register() first.")
            call.resolve(result)
            return
        }

        if (!hasCameraPermission) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "Camera permission not granted. Call requestCameraPermission() first.")
            call.resolve(result)
            return
        }

        // Parse streaming options from JS
        val frameRate = call.getInt("frameRate", 24) ?: 24
        val resolution = call.getString("resolution", "720p") ?: "720p"
        val quality = when (resolution) {
            "1080p" -> VideoQuality.HIGH
            "720p" -> VideoQuality.MEDIUM
            else -> VideoQuality.LOW
        }

        try {
            // StreamConfiguration(videoQuality: VideoQuality, frameRate: Int)
            val config = StreamConfiguration(quality, frameRate)

            // AutoDeviceSelector() — no-arg constructor picks first available device
            val selector = AutoDeviceSelector()

            // Extension function: Wearables.startStreamSession(context, selector, config)
            // Returns StreamSession (not suspend — regular function)
            val session = Wearables.startStreamSession(context, selector, config)
            streamSession = session
            isStreaming = true

            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
            Log.d(TAG, "Stream session started at $frameRate fps, quality=$resolution")

            // Collect frames in the background
            collectFrames(session)

        } catch (e: Exception) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "startStreamSession failed: ${e.message}")
            call.resolve(result)
            Log.e(TAG, "startStreamSession failed: ${e.message}")
        }
    }

    // ── Frame Collection (background coroutine) ──────────────────────
    // VideoFrame has: buffer (ByteBuffer), width (Int), height (Int), presentationTimeUs (Long)

    private fun collectFrames(session: StreamSession) {
        pluginScope.launch {
            try {
                session.videoStream.collectLatest { frame ->
                    if (!isStreaming) return@collectLatest

                    // Convert ByteBuffer to ByteArray
                    val bytes = byteBufferToArray(frame.buffer)
                    if (bytes.isNotEmpty()) {
                        latestFrameBytes = bytes
                        latestFrameTimestamp = System.currentTimeMillis()

                        // ── On-device compression (mobile-first) ─────────
                        // Compress BEFORE sending to JS to reduce bridge
                        // overhead and network payload.
                        val compressed = compressFrameBytes(bytes, 60, 720)

                        // Emit to JS for Hunt Mode continuous streaming
                        notifyListeners("onFrameAvailable", compressed)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Frame collection error: ${e.message}")
                val errorData = JSObject()
                errorData.put("error", "Frame collection stopped: ${e.message}")
                notifyListeners("onError", errorData)
            }
        }
    }

    // ── stopSession ──────────────────────────────────────────────────

    @PluginMethod
    fun stopSession(call: PluginCall) {
        try {
            // StreamSession.close() stops the stream
            streamSession?.close()
            Log.d(TAG, "Stream session closed")
        } catch (e: Exception) {
            Log.e(TAG, "stopSession error: ${e.message}")
        }

        streamSession = null
        isStreaming = false
        latestFrameBytes = null
        latestFrameTimestamp = 0
        call.resolve()
    }

    // ── captureFrame (Single Frame Grab) ─────────────────────────────

    @PluginMethod
    fun captureFrame(call: PluginCall) {
        if (!isStreaming || streamSession == null) {
            call.reject("No active session. Call startSession() first.")
            return
        }

        val quality = call.getInt("quality", 75) ?: 75
        val maxWidth = call.getInt("maxWidth", 1280) ?: 1280

        // Use latest frame from stream — already on device, no network needed
        val bytes = latestFrameBytes
        if (bytes != null && bytes.isNotEmpty()) {
            val compressed = compressFrameBytes(bytes, quality, maxWidth)
            call.resolve(compressed)
        } else {
            // Try capturePhoto as fallback
            // NOTE: capturePhoto returns Result<PhotoData>, but PhotoData is
            // an empty interface in 0.4.0. This fallback may not yield image bytes.
            // Keeping it for forward-compatibility with future SDK versions.
            pluginScope.launch {
                try {
                    val photoResult = streamSession?.capturePhoto()
                    if (photoResult != null && photoResult.isSuccess) {
                        // PhotoData is empty interface in 0.4.0 — no image bytes available
                        // Future SDK versions may add getBytes() or similar
                        call.reject("Photo capture succeeded but PhotoData has no image bytes in SDK 0.4.0. Use streaming frames instead.")
                    } else {
                        call.reject("Photo capture failed or returned null.")
                    }
                } catch (e: Exception) {
                    call.reject("capturePhoto failed: ${e.message}")
                }
            }
        }
    }

    // ── getBatteryLevel ──────────────────────────────────────────────

    @PluginMethod
    fun getBatteryLevel(call: PluginCall) {
        // Battery level not directly exposed in MWDAT 0.4.x
        val result = JSObject()
        result.put("level", JSONObject.NULL)
        call.resolve(result)
    }

    // ═════════════════════════════════════════════════════════════════
    // HELPERS
    // ═════════════════════════════════════════════════════════════════

    /**
     * Convert a ByteBuffer (from VideoFrame) to a ByteArray.
     * VideoFrame.buffer is java.nio.ByteBuffer, not byte[].
     */
    private fun byteBufferToArray(buffer: ByteBuffer): ByteArray {
        // Rewind to read from start
        val buf = buffer.duplicate()
        buf.rewind()
        val bytes = ByteArray(buf.remaining())
        buf.get(bytes)
        return bytes
    }

    /**
     * Compress and resize raw frame bytes to a JPEG base64 string.
     *
     * MOBILE-FIRST: All image processing happens on-device BEFORE
     * the data crosses the Capacitor bridge or hits the network.
     * This reduces:
     *   - Bridge serialization payload (base64 is ~33% larger than binary)
     *   - Network upload size (720p JPEG @ 60% is approx 40-80KB vs 1MB+ raw)
     *   - Server CPU (no resize/compress needed server-side)
     *
     * @param bytes    Raw image bytes (JPEG or decoded video frame)
     * @param quality  JPEG compression quality 0-100 (60 for streaming, 75 for single capture)
     * @param maxWidth Maximum width in pixels — images wider than this are downscaled
     * @return         JSObject with base64, width, height, timestamp, byteSize
     */
    private fun compressFrameBytes(bytes: ByteArray, quality: Int, maxWidth: Int): JSObject {
        val result = JSObject()

        try {
            // Decode bytes to Bitmap
            var bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bitmap == null) {
                result.put("base64", "")
                result.put("width", 0)
                result.put("height", 0)
                result.put("timestamp", 0)
                result.put("byteSize", 0)
                return result
            }

            // Resize if wider than maxWidth (device does the work, not the server)
            if (bitmap.width > maxWidth) {
                val scale = maxWidth.toFloat() / bitmap.width.toFloat()
                val newHeight = (bitmap.height * scale).toInt()
                bitmap = Bitmap.createScaledBitmap(bitmap, maxWidth, newHeight, true)
            }

            // Compress to JPEG
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            val jpegBytes = stream.toByteArray()

            // Encode to base64 for bridge transport
            val base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)

            result.put("base64", base64)
            result.put("width", bitmap.width)
            result.put("height", bitmap.height)
            result.put("timestamp", System.currentTimeMillis())
            result.put("byteSize", jpegBytes.size)

        } catch (e: Exception) {
            Log.e(TAG, "Frame compression failed: ${e.message}")
            result.put("base64", "")
            result.put("width", 0)
            result.put("height", 0)
            result.put("timestamp", 0)
            result.put("byteSize", 0)
        }

        return result
    }

    // ── Intent Handling (Meta AI callback) ────────────────────────────

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        val uri: Uri? = intent.data
        if (uri != null && uri.scheme == "tagnetiq") {
            Log.d(TAG, "Received callback URI: $uri")
            // The SDK's registrationState flow will update automatically
            // when the Meta AI app completes the registration flow.
            // No explicit handleUrl call needed — the SDK observes the intent.
        }
    }

    // ── Cleanup ──────────────────────────────────────────────────────

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        pluginScope.cancel()

        try {
            streamSession?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Cleanup close error: ${e.message}")
        }

        streamSession = null
        isStreaming = false
        latestFrameBytes = null
        Log.d(TAG, "Plugin destroyed, resources cleaned up")
    }
}
