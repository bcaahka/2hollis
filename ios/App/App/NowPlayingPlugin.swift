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
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
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
                self.activateAudioSession()
                self.tearDownPlayer()

                let item = AVPlayerItem(url: fileURL)
                let player = AVPlayer(playerItem: item)
                self.player = player

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
                self.attachObservers(to: player, item: item)
                player.play()
                self.isPlayingFlag = true
                // One reinforce after AVPlayer starts — not a loop (loops drop artwork on iOS).
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
                    guard let self = self, self.player === player else { return }
                    self.publishNowPlaying()
                }
                self.notifyListeners("playing", data: [:])
                call.resolve()
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Keep AVPlayer + Now Playing card alive (Yandex Music style) — only freeze rate.
            self.activateAudioSession()
            self.player?.pause()
            self.isPlayingFlag = false
            self.publishNowPlaying()
            self.notifyListeners("paused", data: [:])
            call.resolve()
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.activateAudioSession()
            self.player?.play()
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
            let cm = CMTime(seconds: max(0, time), preferredTimescale: 600)
            self.player?.seek(to: cm, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] finished in
                guard let self = self, finished else {
                    call.resolve()
                    return
                }
                self.publishNowPlaying()
                self.emitTimeUpdate()
                call.resolve()
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
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
            let position = self.player?.currentTime().seconds ?? 0
            let duration = self.playerDuration()
            call.resolve([
                "position": position.isFinite ? max(0, position) : 0,
                "duration": duration,
                "playing": self.isPlayingFlag
            ])
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
            // "paused" / "playing" keep the card; only explicit stop/clear dismisses it.
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
            self.tearDownPlayer()
            self.isPlayingFlag = false
            self.hasActiveTrack = false
            self.setArtwork(nil)
            self.info.removeAll()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }

    // MARK: - Player helpers

    private func attachObservers(to player: AVPlayer, item: AVPlayerItem) {
        // Frequent Now Playing writes drop artwork. Only push progress to JS here;
        // lock screen uses ElapsedPlaybackTime + PlaybackRate to animate on its own.
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
            queue: .main
        ) { [weak self] _ in
            self?.emitTimeUpdate()
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            guard let self = self else { return }
            // Stay on lock screen / Control Center with cover until next track or stop.
            self.isPlayingFlag = false
            self.publishNowPlaying()
            self.notifyListeners("ended", data: [:])
        }

        item.asset.loadValuesAsynchronously(forKeys: ["duration"]) {
            var error: NSError?
            let status = item.asset.statusOfValue(forKey: "duration", error: &error)
            guard status == .loaded else { return }
            DispatchQueue.main.async {
                let duration = self.playerDuration()
                if duration > 0 {
                    self.info[MPMediaItemPropertyPlaybackDuration] = duration
                    self.publishNowPlaying()
                    self.emitTimeUpdate()
                }
            }
        }
    }

    private func tearDownPlayer() {
        if let observer = timeObserver, let player = player {
            player.removeTimeObserver(observer)
        }
        timeObserver = nil
        if let endObserver = endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil
        player?.pause()
        player = nil
    }

    private func playerDuration() -> Double {
        guard let item = player?.currentItem else { return 0 }
        let seconds = item.duration.seconds
        if seconds.isFinite && seconds > 0 { return seconds }
        let assetSeconds = item.asset.duration.seconds
        return assetSeconds.isFinite && assetSeconds > 0 ? assetSeconds : 0
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
        let position = player?.currentTime().seconds ?? 0
        let safePosition = position.isFinite ? max(0, position) : 0
        let duration = playerDuration()

        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = safePosition
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        // rate 0 = paused, but card + artwork stay (like Yandex Music).
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
        let position = player?.currentTime().seconds ?? 0
        let duration = playerDuration()
        let safePosition = position.isFinite ? max(0, position) : 0

        notifyListeners("timeupdate", data: [
            "position": safePosition,
            "duration": duration,
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
            self.player?.play()
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
            self.player?.pause()
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
            let cm = CMTime(seconds: max(0, time), preferredTimescale: 600)
            self.player?.seek(to: cm, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] finished in
                guard let self = self, finished else { return }
                self.publishNowPlaying()
                self.emitTimeUpdate()
            }
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
