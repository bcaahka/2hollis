import Foundation
import UIKit
import Capacitor
import MediaPlayer
import AVFoundation

@objc(NowPlayingPlugin)
public class NowPlayingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NowPlayingPlugin"
    public let jsName = "NowPlaying"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMetadata", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPlaybackState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPositionState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEq", returnType: CAPPluginReturnPromise)
    ]

    private var engine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var eqUnit: AVAudioUnitEQ?
    private var audioFile: AVAudioFile?
    private var seekSeconds: Double = 0
    private var eqGains: [Float] = [0, 0, 0, 0, 0]
    private var playGen = 0
    private var ignoreCompletion = false
    private var posTimer: Timer?
    private var downloadTask: URLSessionDownloadTask?

    private var info: [String: Any] = [:]
    private var artworkImage: UIImage?
    /// Keep one artwork wrapper — recreating it on every Now Playing write drops the cover on iOS.
    private var artworkItem: MPMediaItemArtwork?
    private var isPlayingFlag = false
    /// True while a track is loaded (playing or paused). Cleared only on stop/clear.
    private var hasActiveTrack = false
    private var lifecycleObservers: [NSObjectProtocol] = []

    override public func load() {
        UIApplication.shared.beginReceivingRemoteControlEvents()
        setupRemoteCommands()
        activateAudioSession()
        setupLifecycleObservers()
    }

    deinit {
        lifecycleObservers.forEach { NotificationCenter.default.removeObserver($0) }
        tearDownPlayer()
    }

    // MARK: - Playback

    @objc func play(_ call: CAPPluginCall) {
        guard let rawUrl = call.getString("url"), !rawUrl.isEmpty else {
            call.reject("url is required")
            return
        }

        let title = call.getString("title") ?? ""
        let artist = call.getString("artist") ?? "2hollis"
        let album = call.getString("album") ?? ""
        let artworkPath = call.getString("artworkPath")
        let artworkBase64 = call.getString("artworkBase64")

        DispatchQueue.global(qos: .userInitiated).async {
            guard let fileURL = self.resolvePublicFileURL(rawUrl) else {
                DispatchQueue.main.async {
                    call.reject("Audio file not found: \(rawUrl)")
                }
                return
            }

            let artwork = self.resolveArtwork(path: artworkPath, base64: artworkBase64, src: nil)

            DispatchQueue.main.async {
                self.playGen += 1
                let gen = self.playGen
                self.activateAudioSession()
                self.tearDownPlayer()

                self.info = [
                    MPMediaItemPropertyTitle: title,
                    MPMediaItemPropertyArtist: artist,
                    MPMediaItemPropertyAlbumTitle: album,
                    MPNowPlayingInfoPropertyMediaType: NSNumber(value: MPNowPlayingInfoMediaType.audio.rawValue),
                    MPNowPlayingInfoPropertyPlaybackRate: 1.0,
                    MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
                    MPNowPlayingInfoPropertyElapsedPlaybackTime: 0.0
                ]

                self.hasActiveTrack = true
                self.setArtwork(artwork)
                self.publishNowPlaying()
                self.startPlayback(url: fileURL, generation: gen, call: call)
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.activateAudioSession()
            self.pauseEngine()
            self.isPlayingFlag = false
            self.publishNowPlaying()
            self.notifyListeners("paused", data: [:])
            call.resolve()
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.activateAudioSession()
            self.playerNode?.play()
            self.isPlayingFlag = true
            self.publishNowPlaying()
            self.notifyListeners("playing", data: [:])
            call.resolve()
        }
    }

    @objc func seek(_ call: CAPPluginCall) {
        guard let time = call.getDouble("time") else {
            call.reject("time is required")
            return
        }
        DispatchQueue.main.async {
            self.seekEngine(to: time)
            self.publishNowPlaying()
            self.emitTimeUpdate()
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.playGen += 1
            self.tearDownPlayer()
            self.isPlayingFlag = false
            self.hasActiveTrack = false
            self.setArtwork(nil)
            self.info.removeAll()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let position = self.enginePosition()
            let duration = self.playerDuration()
            call.resolve([
                "position": position,
                "duration": duration,
                "playing": self.isPlayingFlag
            ])
        }
    }

    @objc func setEq(_ call: CAPPluginCall) {
        var gains: [Float] = []
        if let arr = call.getArray("gains") {
            for item in arr {
                if let number = item as? NSNumber {
                    gains.append(number.floatValue)
                }
            }
        }
        DispatchQueue.main.async {
            self.applyEqGains(gains)
            call.resolve()
        }
    }

    // MARK: - Legacy metadata APIs (kept for compatibility)

    @objc func setMetadata(_ call: CAPPluginCall) {
        let title = call.getString("title")
        let artist = call.getString("artist")
        let album = call.getString("album")
        let artworkPath = call.getString("artworkPath")
        let artworkBase64 = call.getString("artworkBase64")
        let artworkSrc = call.getString("artworkSrc")

        DispatchQueue.global(qos: .userInitiated).async {
            let image = self.resolveArtwork(path: artworkPath, base64: artworkBase64, src: artworkSrc)
            DispatchQueue.main.async {
                if let title = title { self.info[MPMediaItemPropertyTitle] = title }
                if let artist = artist { self.info[MPMediaItemPropertyArtist] = artist }
                if let album = album { self.info[MPMediaItemPropertyAlbumTitle] = album }
                self.info[MPNowPlayingInfoPropertyMediaType] =
                    NSNumber(value: MPNowPlayingInfoMediaType.audio.rawValue)
                if let image = image {
                    self.setArtwork(image)
                }
                if !self.info.isEmpty {
                    self.hasActiveTrack = true
                }
                self.publishNowPlaying()
                call.resolve()
            }
        }
    }

    @objc func setPlaybackState(_ call: CAPPluginCall) {
        let state = call.getString("playbackState") ?? "none"
        DispatchQueue.main.async {
            if state == "none" {
                call.resolve()
                return
            }
            self.isPlayingFlag = (state == "playing")
            if self.hasActiveTrack {
                self.activateAudioSession()
                self.publishNowPlaying()
            }
            call.resolve()
        }
    }

    @objc func setPositionState(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let duration = call.getDouble("duration") {
                self.info[MPMediaItemPropertyPlaybackDuration] = max(0, duration)
            }
            if let position = call.getDouble("position") {
                let duration = (self.info[MPMediaItemPropertyPlaybackDuration] as? Double) ?? 0
                self.info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = max(0, min(position, max(0, duration)))
            }
            if let rate = call.getDouble("playbackRate") {
                self.info[MPNowPlayingInfoPropertyPlaybackRate] = rate
            }
            if self.hasActiveTrack {
                self.publishNowPlaying()
            }
            call.resolve()
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.playGen += 1
            self.tearDownPlayer()
            self.isPlayingFlag = false
            self.hasActiveTrack = false
            self.setArtwork(nil)
            self.info.removeAll()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }

    // MARK: - Engine

    private func startPlayback(url: URL, generation: Int, call: CAPPluginCall) {
        if url.isFileURL, FileManager.default.fileExists(atPath: url.path) {
            do {
                try startEngine(fileURL: url)
                finishPlayStart(call)
            } catch {
                call.reject(error.localizedDescription)
            }
            return
        }

        downloadTask?.cancel()
        let task = URLSession.shared.downloadTask(with: url) { [weak self] tmp, _, error in
            DispatchQueue.main.async {
                guard let self = self, generation == self.playGen else { return }
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let tmp = tmp else {
                    call.reject("download failed")
                    return
                }
                let dest = self.cacheURL(generation)
                try? FileManager.default.removeItem(at: dest)
                do {
                    try FileManager.default.moveItem(at: tmp, to: dest)
                    try self.startEngine(fileURL: dest)
                    self.finishPlayStart(call)
                } catch {
                    call.reject(error.localizedDescription)
                }
            }
        }
        downloadTask = task
        task.resume()
    }

    private func finishPlayStart(_ call: CAPPluginCall) {
        isPlayingFlag = true
        publishNowPlaying()
        notifyListeners("playing", data: [:])
        call.resolve()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            self?.publishNowPlaying()
        }
    }

    private func startEngine(fileURL: URL) throws {
        tearDownEngine()
        let file = try AVAudioFile(forReading: fileURL)
        audioFile = file
        seekSeconds = 0

        let engine = AVAudioEngine()
        let playerNode = AVAudioPlayerNode()
        let eq = AVAudioUnitEQ(numberOfBands: 5)
        configureEq(eq)

        engine.attach(playerNode)
        engine.attach(eq)
        let format = file.processingFormat
        engine.connect(playerNode, to: eq, format: format)
        engine.connect(eq, to: engine.mainMixerNode, format: format)
        engine.prepare()
        try engine.start()

        self.engine = engine
        self.playerNode = playerNode
        self.eqUnit = eq

        scheduleFrom(0)
        playerNode.play()
        startPositionTimer()

        let duration = playerDuration()
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
    }

    private func configureEq(_ eq: AVAudioUnitEQ) {
        let freqs: [Float] = [60, 250, 1000, 4000, 12000]
        for (index, band) in eq.bands.enumerated() {
            if index == 0 {
                band.filterType = .lowShelf
            } else if index == eq.bands.count - 1 {
                band.filterType = .highShelf
            } else {
                band.filterType = .parametric
            }
            band.frequency = freqs[index]
            band.bandwidth = 1.0
            band.gain = index < eqGains.count ? eqGains[index] : 0
            band.bypass = eqGains.allSatisfy { $0.magnitude < 0.05 }
        }
    }

    private func applyEqGains(_ gains: [Float]) {
        var next = [Float](repeating: 0, count: 5)
        for i in 0..<min(5, gains.count) {
            next[i] = max(-12, min(12, gains[i]))
        }
        eqGains = next
        let eq = eqUnit
        let bypass = next.allSatisfy { $0.magnitude < 0.05 }
        if let eq = eq {
            for (index, band) in eq.bands.enumerated() where index < next.count {
                band.gain = next[index]
                band.bypass = bypass
            }
        }
    }

    private func scheduleFrom(_ seconds: Double) {
        guard let file = audioFile, let node = playerNode else { return }
        let rate = file.processingFormat.sampleRate
        let start = AVAudioFramePosition(max(0, seconds) * rate)
        guard start < file.length else { return }
        let frames = AVAudioFrameCount(file.length - start)
        ignoreCompletion = false
        node.scheduleSegment(file, startingFrame: start, frameCount: frames, at: nil, completionCallbackType: .dataPlayedBack) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self, !self.ignoreCompletion else { return }
                self.isPlayingFlag = false
                self.publishNowPlaying()
                self.notifyListeners("ended", data: [:])
            }
        }
    }

    private func seekEngine(to time: Double) {
        guard audioFile != nil, playerNode != nil else { return }
        let duration = playerDuration()
        let clamped = max(0, duration > 0 ? min(time, duration) : time)
        ignoreCompletion = true
        playerNode?.stop()
        seekSeconds = clamped
        scheduleFrom(clamped)
        if isPlayingFlag {
            playerNode?.play()
        }
    }

    private func pauseEngine() {
        playerNode?.pause()
    }

    private func enginePosition() -> Double {
        guard let node = playerNode, audioFile != nil else { return seekSeconds }
        if let last = node.lastRenderTime, last.isSampleTimeValid,
           let playerTime = node.playerTime(forNodeTime: last) {
            let elapsed = Double(playerTime.sampleTime) / playerTime.sampleRate
            let position = seekSeconds + elapsed
            return position.isFinite ? max(0, position) : seekSeconds
        }
        return seekSeconds
    }

    private func cacheURL(_ generation: Int) -> URL {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return dir.appendingPathComponent("nowplaying-\(generation).mp3")
    }

    private func startPositionTimer() {
        posTimer?.invalidate()
        let timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.emitTimeUpdate()
        }
        RunLoop.main.add(timer, forMode: .common)
        posTimer = timer
    }

    private func tearDownEngine() {
        ignoreCompletion = true
        posTimer?.invalidate()
        posTimer = nil
        playerNode?.stop()
        engine?.stop()
        engine?.reset()
        playerNode = nil
        eqUnit = nil
        engine = nil
        audioFile = nil
        seekSeconds = 0
    }

    private func tearDownPlayer() {
        downloadTask?.cancel()
        downloadTask = nil
        tearDownEngine()
    }

    private func playerDuration() -> Double {
        guard let file = audioFile else { return 0 }
        let seconds = Double(file.length) / file.processingFormat.sampleRate
        return seconds.isFinite && seconds > 0 ? seconds : 0
    }

    private func setArtwork(_ image: UIImage?) {
        artworkImage = image
        artworkItem = nil
        if let image = image {
            let size = CGSize(
                width: max(image.size.width, 600),
                height: max(image.size.height, 600)
            )
            artworkItem = MPMediaItemArtwork(boundsSize: size) { _ in image }
        }
    }

    private func applyArtworkToInfo() {
        if let artworkItem = artworkItem {
            info[MPMediaItemPropertyArtwork] = artworkItem
        } else {
            info.removeValue(forKey: MPMediaItemPropertyArtwork)
        }
    }

    /// Always write from local `info` (with cached artwork). Never round-trip the center.
    private func publishNowPlaying() {
        guard hasActiveTrack, !info.isEmpty else { return }
        syncPlaybackFields()
        applyArtworkToInfo()
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func syncPlaybackFields() {
        let position = enginePosition()
        let duration = playerDuration()

        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlayingFlag ? 1.0 : 0.0
        info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
        info[MPNowPlayingInfoPropertyMediaType] =
            NSNumber(value: MPNowPlayingInfoMediaType.audio.rawValue)
    }

    private func setupLifecycleObservers() {
        let center = NotificationCenter.default
        let reassert: (Notification) -> Void = { [weak self] _ in
            guard let self = self, self.hasActiveTrack else { return }
            self.activateAudioSession()
            self.publishNowPlaying()
        }
        lifecycleObservers = [
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main, using: reassert),
            center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main, using: reassert),
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main, using: reassert),
        ]
    }

    private func emitTimeUpdate() {
        notifyListeners("timeupdate", data: [
            "position": enginePosition(),
            "duration": playerDuration(),
            "playing": isPlayingFlag
        ])
    }

    private func activateAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            // Continue; playback may still work.
        }
    }

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.isEnabled = true
        center.playCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.activateAudioSession()
            self.playerNode?.play()
            self.isPlayingFlag = true
            self.publishNowPlaying()
            self.notifyListeners("playing", data: [:])
            self.notifyListeners("action", data: ["action": "play"])
            return .success
        }

        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.activateAudioSession()
            self.pauseEngine()
            self.isPlayingFlag = false
            self.publishNowPlaying()
            self.notifyListeners("paused", data: [:])
            self.notifyListeners("action", data: ["action": "pause"])
            return .success
        }

        center.nextTrackCommand.isEnabled = true
        center.nextTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("action", data: ["action": "nexttrack"])
            return .success
        }

        center.previousTrackCommand.isEnabled = true
        center.previousTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("action", data: ["action": "previoustrack"])
            return .success
        }

        center.changePlaybackPositionCommand.isEnabled = true
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self = self,
                  let event = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            let time = event.positionTime
            self.seekEngine(to: time)
            self.publishNowPlaying()
            self.emitTimeUpdate()
            self.notifyListeners("action", data: [
                "action": "seekto",
                "seekTime": time
            ])
            return .success
        }
    }

    // MARK: - Asset resolution

    private func resolvePublicFileURL(_ path: String) -> URL? {
        if path.hasPrefix("file://"), let url = URL(string: path), FileManager.default.fileExists(atPath: url.path) {
            return url
        }

        if path.hasPrefix("http://") || path.hasPrefix("https://") || path.hasPrefix("capacitor://") {
            return URL(string: path)
        }

        let cleaned = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let roots: [URL] = [
            Bundle.main.bundleURL.appendingPathComponent("public"),
            Bundle.main.resourceURL?.appendingPathComponent("public"),
            Bundle.main.bundleURL
        ].compactMap { $0 }

        for root in roots {
            let url = root.appendingPathComponent(cleaned)
            if FileManager.default.fileExists(atPath: url.path) {
                return url
            }
        }

        if let decoded = cleaned.removingPercentEncoding, decoded != cleaned {
            for root in roots {
                let url = root.appendingPathComponent(decoded)
                if FileManager.default.fileExists(atPath: url.path) {
                    return url
                }
            }
        }
        return nil
    }

    private func resolveArtwork(path: String?, base64: String?, src: String?) -> UIImage? {
        if let path = path, let image = imageFromPublicPath(path) {
            return image
        }
        if let base64 = base64, !base64.isEmpty,
           let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
           let image = UIImage(data: data) {
            return image
        }
        if let src = src, let image = loadImageSync(from: src) {
            return image
        }
        return nil
    }

    private func imageFromPublicPath(_ path: String) -> UIImage? {
        let cleaned = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let roots: [URL] = [
            Bundle.main.bundleURL.appendingPathComponent("public"),
            Bundle.main.resourceURL?.appendingPathComponent("public"),
            Bundle.main.bundleURL
        ].compactMap { $0 }

        for root in roots {
            let url = root.appendingPathComponent(cleaned)
            if let image = UIImage(contentsOfFile: url.path) {
                return image
            }
        }

        if let decoded = cleaned.removingPercentEncoding, decoded != cleaned {
            for root in roots {
                let url = root.appendingPathComponent(decoded)
                if let image = UIImage(contentsOfFile: url.path) {
                    return image
                }
            }
        }
        return nil
    }

    private func loadImageSync(from src: String) -> UIImage? {
        if src.hasPrefix("data:"),
           let range = src.range(of: "base64,"),
           let data = Data(base64Encoded: String(src[range.upperBound...]), options: .ignoreUnknownCharacters),
           let image = UIImage(data: data) {
            return image
        }

        guard let url = URL(string: src) else { return nil }
        if url.isFileURL {
            return UIImage(contentsOfFile: url.path)
        }

        let semaphore = DispatchSemaphore(value: 0)
        var image: UIImage?
        URLSession.shared.dataTask(with: url) { data, _, _ in
            if let data = data {
                image = UIImage(data: data)
            }
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 2.5)
        return image
    }
}
