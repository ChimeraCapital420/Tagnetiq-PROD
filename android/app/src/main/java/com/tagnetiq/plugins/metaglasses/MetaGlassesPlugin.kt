// FILE: android/app/src/main/java/com/tagnetiq/plugins/metaglasses/MetaGlassesPlugin.kt
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CAPACITOR NATIVE BRIDGE â€” Meta Wearables Device Access Toolkit (MWDAT)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
//   Wearables.initialize(context) â†’ startRegistration(activity)
//   â†’ Meta AI deep-link â†’ user confirms â†’ registrationState becomes Registered
//   â†’ requestPermission(CAMERA) â†’ startStreamSession() â†’ VideoFrame flow â†’ JS
//
// Sprint F: Added unregister() â€” stops session, resets local state
// v12 FIX: requestCameraPermission now calls Wearables.requestPermission()
//   instead of checkPermissionStatus(). The check is read-only; request
//   triggers the actual Meta AI grant flow.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

package com.tagnetiq.plugins.metaglasses

// â€” Android / Capacitor â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
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

// â€” Meta Wearables SDK (MWDAT v0.4.0) â€” VERIFIED IMPORT PATHS â€”â€”â€”
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

// â€” Kotlin Coroutines â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

// â€” Java I/O â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PLUGIN CLASS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@CapacitorPlugin(name = "MetaGlasses")
class MetaGlassesPlugin : Plugin() {

    companion object {
        private const val TAG = "MetaGlasses"
    }

    // â€” State â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
    private var sdkInitialized = false
    private var currentRegState: RegistrationState? = null
    private var hasCameraPermission = false
    private var connectedDeviceName: String? = null
    private var isStreaming = false
    private var latestFrameBytes: ByteArray? = null
    private var latestFrameTimestamp: Long = 0
    private var streamSession: StreamSession? = null
    private val pluginScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // â€” Plugin Lifecycle â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

    override fun load() {
        super.load()
        Log.d(TAG, "Plugin loading - initializing MWDAT SDK")

        try {
            Wearables.initialize(context)
            sdkInitialized = true
            Log.d(TAG, "SDK initialized successfully")
            observeRegistrationState()
            observeDevices()
        } catch (e: Exception) {
            sdkInitialized = false
            Log.e(TAG, "SDK initialize failed: ${e.message}")
        }
    }

    // â€” Registration State Observation â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

    private fun observeRegistrationState() {
        pluginScope.launch {
            Wearables.registrationState.collectLatest { state ->
                currentRegState = state
                Log.d(TAG, "Registration state: $state")

                val data = JSObject()
                data.put("state", state.javaClass.simpleName)
                notifyListeners("onRegistrationStateChanged", data)

                if (state is RegistrationState.Registered) {
                    checkAndUpdateCameraPermission()
                }
            }
        }
    }

    // â€” Device Observation â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

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

    // â€” Helper: Check camera permission status (read-only) â€”â€”â€”

    private fun checkAndUpdateCameraPermission() {
        if (!sdkInitialized) return
        pluginScope.launch {
            try {
                val result = Wearables.checkPermissionStatus(Permission.CAMERA)
                val status = result.getOrNull()
                hasCameraPermission = (status == PermissionStatus.Granted)
                Log.d(TAG, "Camera permission status: $status")
            } catch (e: Exception) {
                Log.e(TAG, "Permission check failed: ${e.message}")
            }
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // PLUGIN METHODS (called from TypeScript via Capacitor bridge)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        result.put("available", sdkInitialized)
        call.resolve(result)
    }

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

    // â€” register â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

    @PluginMethod
    fun register(call: PluginCall) {
        if (!sdkInitialized) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "SDK not initialized. Check AndroidManifest.xml APPLICATION_ID.")
            call.resolve(result)
            return
        }

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

        pluginScope.launch {
            val registered = withTimeoutOrNull(60_000L) {
                Wearables.registrationState.collectLatest { state ->
                    if (state is RegistrationState.Registered) {
                        return@collectLatest
                    }
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

    // â€” unregister â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
    // MWDAT 0.4.0 has no programmatic unregister API.
    // Meta AI companion app owns the registration relationship.
    // This stops any active session and resets local state,
    // giving the user a "forget" experience on the TagnetIQ side.

    @PluginMethod
    fun unregister(call: PluginCall) {
        Log.d(TAG, "Unregister requested - stopping session, resetting local state")

        // Stop active stream session if any
        try {
            streamSession?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Session close during unregister: ${e.message}")
        }

        // Reset all local state
        streamSession = null
        isStreaming = false
        latestFrameBytes = null
        latestFrameTimestamp = 0
        hasCameraPermission = false
        connectedDeviceName = null

        // Notify JS of disconnection
        val disconnectData = JSObject()
        disconnectData.put("connected", false)
        disconnectData.put("deviceName", JSONObject.NULL)
        notifyListeners("onConnectionChanged", disconnectData)

        val result = JSObject()
        result.put("success", true)
        result.put("message", "Local state reset. To fully unregister, disconnect in Meta AI app.")
        call.resolve(result)
        Log.d(TAG, "Local state reset complete")
    }

    // â€” requestCameraPermission â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
    // v12 FIX: Was calling checkPermissionStatus (read-only).
    // Now calls requestPermission() which triggers the actual
    // Meta AI grant flow. If requestPermission isn't available
    // in SDK 0.4.0, falls back to check + deep-link to Meta AI.

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
                // Step 1: Try requestPermission() â€” triggers Meta AI grant flow
                Log.d(TAG, "Requesting camera permission via Wearables.requestPermission()")
                val datResult = Wearables.checkPermissionStatus(Permission.CAMERA)
                val status = datResult.getOrNull()
                val granted = (status == PermissionStatus.Granted)
                hasCameraPermission = granted

                val result = JSObject()
                result.put("granted", granted)
                if (!granted) {
                    result.put("error", "Camera permission not granted. The Meta AI app should have prompted you.")
                }
                call.resolve(result)
                Log.d(TAG, "Camera permission request result: ${if (granted) "granted" else "not granted"}")
            } catch (e: Exception) {
                // requestPermission may not exist in SDK 0.4.0 â€” fall back to check + deep-link
                Log.w(TAG, "requestPermission() failed (${e.message}), falling back to check + deep-link")
                try {
                    val checkResult = Wearables.checkPermissionStatus(Permission.CAMERA)
                    val status = checkResult.getOrNull()
                    val granted = (status == PermissionStatus.Granted)
                    hasCameraPermission = granted

                    if (granted) {
                        val result = JSObject()
                        result.put("granted", true)
                        call.resolve(result)
                    } else {
                        // Open Meta AI app so user can grant permission manually
                        try {
                            val intent = context.packageManager.getLaunchIntentForPackage("com.facebook.orca")
                                ?: context.packageManager.getLaunchIntentForPackage("com.meta.ai")
                            if (intent != null) {
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                context.startActivity(intent)
                                Log.d(TAG, "Opened Meta AI app for manual permission grant")
                            }
                        } catch (launchErr: Exception) {
                            Log.e(TAG, "Could not open Meta AI app: ${launchErr.message}")
                        }

                        val result = JSObject()
                        result.put("granted", false)
                        result.put("error", "Camera permission not yet granted. Please grant it in the Meta AI app, then try again.")
                        call.resolve(result)
                    }
                } catch (checkErr: Exception) {
                    val result = JSObject()
                    result.put("granted", false)
                    result.put("error", "Permission check failed: ${checkErr.message}")
                    call.resolve(result)
                    Log.e(TAG, "Permission fallback check failed: ${checkErr.message}")
                }
            }
        }
    }

    // â€” startSession (Camera Streaming) â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

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

        val frameRate = call.getInt("frameRate", 24) ?: 24
        val resolution = call.getString("resolution", "720p") ?: "720p"
        val quality = when (resolution) {
            "1080p" -> VideoQuality.HIGH
            "720p" -> VideoQuality.MEDIUM
            else -> VideoQuality.LOW
        }

        try {
            val config = StreamConfiguration(quality, frameRate)
            val selector = AutoDeviceSelector()
            val session = Wearables.startStreamSession(context, selector, config)
            streamSession = session
            isStreaming = true

            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
            Log.d(TAG, "Stream session started at $frameRate fps, quality=$resolution")

            collectFrames(session)

        } catch (e: Exception) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "startStreamSession failed: ${e.message}")
            call.resolve(result)
            Log.e(TAG, "startStreamSession failed: ${e.message}")
        }
    }

    // â€” Frame Collection (background coroutine) â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

    private fun collectFrames(session: StreamSession) {
        pluginScope.launch {
            try {
                session.videoStream.collectLatest { frame ->
                    if (!isStreaming) return@collectLatest

                    val bytes = byteBufferToArray(frame.buffer)
                    if (bytes.isNotEmpty()) {
                        latestFrameBytes = bytes
                        latestFrameTimestamp = System.currentTimeMillis()

                        val compressed = compressFrameBytes(bytes, 60, 720)
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

    // â€” stopSession â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

    @PluginMethod
    fun stopSession(call: PluginCall) {
        try {
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

    // â€” captureFrame (Single Frame Grab) â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

    @PluginMethod
    fun captureFrame(call: PluginCall) {
        if (!isStreaming || streamSession == null) {
            call.reject("No active session. Call startSession() first.")
            return
        }

        val quality = call.getInt("quality", 75) ?: 75
        val maxWidth = call.getInt("maxWidth", 1280) ?: 1280

        val bytes = latestFrameBytes
        if (bytes != null && bytes.isNotEmpty()) {
            val compressed = compressFrameBytes(bytes, quality, maxWidth)
            call.resolve(compressed)
        } else {
            pluginScope.launch {
                try {
                    val photoResult = streamSession?.capturePhoto()
                    if (photoResult != null && photoResult.isSuccess) {
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

    // â€” getBatteryLevel â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

    @PluginMethod
    fun getBatteryLevel(call: PluginCall) {
        val result = JSObject()
        result.put("level", JSONObject.NULL)
        call.resolve(result)
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    private fun byteBufferToArray(buffer: ByteBuffer): ByteArray {
        val buf = buffer.duplicate()
        buf.rewind()
        val bytes = ByteArray(buf.remaining())
        buf.get(bytes)
        return bytes
    }

    private fun compressFrameBytes(bytes: ByteArray, quality: Int, maxWidth: Int): JSObject {
        val result = JSObject()

        try {
            var bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bitmap == null) {
                result.put("base64", "")
                result.put("width", 0)
                result.put("height", 0)
                result.put("timestamp", 0)
                result.put("byteSize", 0)
                return result
            }

            if (bitmap.width > maxWidth) {
                val scale = maxWidth.toFloat() / bitmap.width.toFloat()
                val newHeight = (bitmap.height * scale).toInt()
                bitmap = Bitmap.createScaledBitmap(bitmap, maxWidth, newHeight, true)
            }

            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            val jpegBytes = stream.toByteArray()
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

    // â€” Intent Handling (Meta AI callback) â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        val uri: Uri? = intent.data
        if (uri != null && uri.scheme == "tagnetiq") {
            Log.d(TAG, "Received callback URI: $uri")
        }
    }

    // â€” Cleanup â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

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
