// FILE: plugins/meta-glasses/ios/Sources/MetaGlassesPlugin.swift
// REAL Capacitor plugin using the Meta Wearables Device Access Toolkit (MWDAT).
// This replaces the placeholder version — actual SDK calls, no TODOs.
//
// PREREQUISITES:
//   1. In Xcode: File > Add Package Dependencies >
//      https://github.com/facebook/meta-wearables-dat-ios (version 0.2.1)
//   2. Info.plist must contain the MWDAT dictionary (MetaAppID, ClientToken, AppLinkURLScheme)
//   3. URL scheme "tagnetiq" registered in Xcode (for Meta AI callback)
//
// SDK LIFECYCLE:
//   configure() → startRegistration() → Meta AI deep-link → handleUrl() callback
//   → requestCameraPermission() → startStreaming() → JPEG frames flow to JS

import Foundation
import UIKit
import Capacitor
import MWDATCore
import MWDATCamera

@objc(MetaGlassesPlugin)
public class MetaGlassesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MetaGlassesPlugin"
    public let jsName = "MetaGlasses"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestCameraPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "captureFrame", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getBatteryLevel", returnType: CAPPluginReturnPromise),
    ]

    // ── State ────────────────────────────────────────────────────────────

    private var sdkConfigured = false
    private var registrationState: String = "unknown"
    private var connectedDeviceName: String? = nil
    private var isStreaming = false
    private var latestFrame: UIImage? = nil
    private var latestFrameTimestamp: Int = 0

    // Track pending calls waiting for async SDK callbacks
    private var pendingRegisterCall: CAPPluginCall? = nil
    private var pendingPermissionCall: CAPPluginCall? = nil

    // Observation tasks
    private var registrationTask: Task<Void, Never>? = nil
    private var devicesTask: Task<Void, Never>? = nil
    private var streamingTask: Task<Void, Never>? = nil

    // ── Plugin Lifecycle ─────────────────────────────────────────────────

    override public func load() {
        // Configure MWDAT SDK once when plugin loads
        do {
            try Wearables.configure()
            sdkConfigured = true
            startObservingRegistration()
            startObservingDevices()
        } catch {
            print("[MetaGlasses] SDK configure failed: \(error)")
            sdkConfigured = false
        }

        // Listen for URL callbacks from Meta AI app
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppUrl(_:)),
            name: NSNotification.Name("CAPNotifications.URLOpen"),
            object: nil
        )
    }

    /// Handle URL callback from Meta AI app (registration/permission deep-link return)
    @objc private func handleAppUrl(_ notification: Notification) {
        guard let urlString = notification.userInfo?["url"] as? String,
              let url = URL(string: urlString) else { return }

        // Only process URLs with the metaWearablesAction param
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.queryItems?.contains(where: { $0.name == "metaWearablesAction" }) == true
        else { return }

        Task { @MainActor in
            do {
                _ = try await Wearables.shared.handleUrl(url)
            } catch {
                print("[MetaGlasses] handleUrl error: \(error)")
            }
        }
    }

    // ── Registration State Observation ───────────────────────────────────

    private func startObservingRegistration() {
        registrationTask = Task { @MainActor in
            let wearables = Wearables.shared
            for await state in wearables.registrationStateStream() {
                let stateString = "\(state)"
                let wasRegistering = self.registrationState == "registering"
                self.registrationState = stateString

                // If we have a pending register call and state just became "registered"
                if wasRegistering && stateString.contains("registered") {
                    self.pendingRegisterCall?.resolve(["success": true])
                    self.pendingRegisterCall = nil
                }

                // If registration failed
                if stateString.contains("error") || stateString.contains("unavailable") {
                    self.pendingRegisterCall?.resolve([
                        "success": false,
                        "error": "Registration failed: \(stateString)"
                    ])
                    self.pendingRegisterCall = nil
                }
            }
        }
    }

    // ── Device Observation ───────────────────────────────────────────────

    private func startObservingDevices() {
        devicesTask = Task { @MainActor in
            let wearables = Wearables.shared
            for await devices in wearables.devicesStream() {
                let deviceList = Array(devices)
                if let first = deviceList.first {
                    let name = "\(first)"  // SDK device description
                    let wasDisconnected = self.connectedDeviceName == nil
                    self.connectedDeviceName = name

                    if wasDisconnected {
                        self.notifyListeners("onConnectionChanged", data: [
                            "connected": true,
                            "deviceName": name
                        ])
                    }
                } else {
                    let wasConnected = self.connectedDeviceName != nil
                    self.connectedDeviceName = nil

                    if wasConnected {
                        self.notifyListeners("onConnectionChanged", data: [
                            "connected": false,
                            "deviceName": NSNull()
                        ])
                    }
                }
            }
        }
    }

    // ── isAvailable ──────────────────────────────────────────────────────

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": sdkConfigured])
    }

    // ── getStatus ────────────────────────────────────────────────────────

    @objc func getStatus(_ call: CAPPluginCall) {
        let isRegistered = registrationState.contains("registered")
            && !registrationState.contains("unregistered")

        var cameraGranted = false
        if sdkConfigured {
            let permStatus = Wearables.shared.checkPermissionStatus(.camera)
            cameraGranted = "\(permStatus)".contains("granted")
        }

        call.resolve([
            "sdkAvailable": sdkConfigured,
            "isRegistered": isRegistered,
            "cameraPermissionGranted": cameraGranted,
            "isConnected": connectedDeviceName != nil,
            "isSessionActive": isStreaming,
            "deviceName": connectedDeviceName as Any,
            "batteryLevel": NSNull(),
        ])
    }

    // ── register ─────────────────────────────────────────────────────────

    @objc func register(_ call: CAPPluginCall) {
        guard sdkConfigured else {
            call.resolve(["success": false, "error": "SDK not configured. Check Info.plist."])
            return
        }

        // Store pending call — will be resolved when registrationStateStream emits "registered"
        pendingRegisterCall = call

        do {
            try Wearables.shared.startRegistration()
            // Deep-links to Meta AI app. User confirms, Meta AI callbacks via URL scheme.
            // The handleUrl → registrationStateStream flow will resolve the call.
        } catch {
            pendingRegisterCall = nil
            call.resolve(["success": false, "error": "startRegistration failed: \(error.localizedDescription)"])
        }

        // Timeout: if Meta AI doesn't respond in 60 seconds, fail gracefully
        DispatchQueue.main.asyncAfter(deadline: .now() + 60) { [weak self] in
            if let pending = self?.pendingRegisterCall {
                pending.resolve(["success": false, "error": "Registration timed out. Please try again."])
                self?.pendingRegisterCall = nil
            }
        }
    }

    // ── requestCameraPermission ──────────────────────────────────────────

    @objc func requestCameraPermission(_ call: CAPPluginCall) {
        guard sdkConfigured else {
            call.resolve(["granted": false, "error": "SDK not configured."])
            return
        }

        let currentStatus = Wearables.shared.checkPermissionStatus(.camera)
        if "\(currentStatus)".contains("granted") {
            call.resolve(["granted": true])
            return
        }

        // Request permission — this deep-links to Meta AI for user confirmation
        pendingPermissionCall = call

        Task { @MainActor in
            do {
                let result = try await Wearables.shared.requestPermission(.camera)
                let granted = "\(result)".contains("granted")
                self.pendingPermissionCall?.resolve(["granted": granted])
                self.pendingPermissionCall = nil
            } catch {
                self.pendingPermissionCall?.resolve([
                    "granted": false,
                    "error": "Permission request failed: \(error.localizedDescription)"
                ])
                self.pendingPermissionCall = nil
            }
        }
    }

    // ── startSession (Camera Streaming) ──────────────────────────────────

    @objc func startSession(_ call: CAPPluginCall) {
        guard sdkConfigured else {
            call.resolve(["success": false, "error": "SDK not configured."])
            return
        }

        // Check registration and permission
        let isRegistered = registrationState.contains("registered")
            && !registrationState.contains("unregistered")
        let permStatus = Wearables.shared.checkPermissionStatus(.camera)
        let hasPermission = "\(permStatus)".contains("granted")

        guard isRegistered else {
            call.resolve(["success": false, "error": "Not registered. Call register() first."])
            return
        }

        guard hasPermission else {
            call.resolve(["success": false, "error": "Camera permission not granted. Call requestCameraPermission() first."])
            return
        }

        // Parse options
        let frameRateRaw = call.getInt("frameRate") ?? 24
        // Map to SDK-supported values: 30, 24, 15, 7, 2
        let frameRate = [30, 24, 15, 7, 2].min(by: { abs($0 - frameRateRaw) < abs($1 - frameRateRaw) }) ?? 24

        // Start streaming
        Task { @MainActor in
            do {
                // The SDK streaming API — start the camera stream
                try Wearables.shared.startStreaming(
                    frameRate: frameRate
                )
                self.isStreaming = true

                call.resolve(["success": true])

                // Start collecting frames
                self.startFrameCollection()

            } catch {
                call.resolve(["success": false, "error": "startStreaming failed: \(error.localizedDescription)"])
            }
        }
    }

    /// Collect video frames from the SDK stream and emit to JS
    private func startFrameCollection() {
        streamingTask?.cancel()
        streamingTask = Task { @MainActor in
            let wearables = Wearables.shared
            for await frame in wearables.videoFrameStream() {
                guard !Task.isCancelled else { break }

                // frame is a video frame from the SDK
                // Convert to UIImage, compress to JPEG, emit as base64
                if let image = frame.image {
                    self.latestFrame = image
                    self.latestFrameTimestamp = Int(Date().timeIntervalSince1970 * 1000)

                    // Emit frame event to JS listeners (for Hunt Mode continuous streaming)
                    let compressed = self.compressImage(image, quality: 0.6, maxWidth: 720)
                    self.notifyListeners("onFrameAvailable", data: compressed)
                }
            }
        }
    }

    // ── stopSession ──────────────────────────────────────────────────────

    @objc func stopSession(_ call: CAPPluginCall) {
        streamingTask?.cancel()
        streamingTask = nil
        isStreaming = false
        latestFrame = nil

        if sdkConfigured {
            do {
                try Wearables.shared.stopStreaming()
            } catch {
                print("[MetaGlasses] stopStreaming error: \(error)")
            }
        }

        call.resolve()
    }

    // ── captureFrame (Single Frame Grab) ─────────────────────────────────

    @objc func captureFrame(_ call: CAPPluginCall) {
        guard isStreaming else {
            call.reject("No active session. Call startSession() first.")
            return
        }

        let quality = call.getFloat("quality") ?? 0.75
        let maxWidth = call.getInt("maxWidth") ?? 1280

        // Use the latest frame from the stream
        if let image = latestFrame {
            let compressed = compressImage(image, quality: CGFloat(quality), maxWidth: maxWidth)
            call.resolve(compressed)
        } else {
            // No frame available yet — try a photo capture
            Task { @MainActor in
                do {
                    let photo = try await Wearables.shared.capturePhoto()
                    if let image = photo.image {
                        self.latestFrame = image
                        let compressed = self.compressImage(image, quality: CGFloat(quality), maxWidth: maxWidth)
                        call.resolve(compressed)
                    } else {
                        call.reject("Photo capture returned no image data.")
                    }
                } catch {
                    call.reject("capturePhoto failed: \(error.localizedDescription)")
                }
            }
        }
    }

    // ── getBatteryLevel ──────────────────────────────────────────────────

    @objc func getBatteryLevel(_ call: CAPPluginCall) {
        // Battery level not directly exposed in current MWDAT SDK (0.2.x)
        // Will be available in future SDK versions
        call.resolve(["level": NSNull()])
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /// Compress and resize UIImage to JPEG base64 — runs on device to reduce upload size
    private func compressImage(_ image: UIImage, quality: CGFloat, maxWidth: Int) -> [String: Any] {
        var targetImage = image

        // Resize if wider than maxWidth (mobile-first: reduce before sending over network)
        if Int(image.size.width) > maxWidth {
            let scale = CGFloat(maxWidth) / image.size.width
            let newSize = CGSize(width: CGFloat(maxWidth), height: image.size.height * scale)
            let renderer = UIGraphicsImageRenderer(size: newSize)
            targetImage = renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: newSize))
            }
        }

        // Compress to JPEG — device does the heavy lifting, not the server
        guard let jpegData = targetImage.jpegData(compressionQuality: quality) else {
            return ["base64": "", "width": 0, "height": 0, "timestamp": 0, "byteSize": 0]
        }

        let base64 = jpegData.base64EncodedString()
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)

        return [
            "base64": base64,
            "width": Int(targetImage.size.width),
            "height": Int(targetImage.size.height),
            "timestamp": timestamp,
            "byteSize": jpegData.count,
        ]
    }

    // ── Cleanup ──────────────────────────────────────────────────────────

    deinit {
        registrationTask?.cancel()
        devicesTask?.cancel()
        streamingTask?.cancel()
        NotificationCenter.default.removeObserver(self)
    }
}