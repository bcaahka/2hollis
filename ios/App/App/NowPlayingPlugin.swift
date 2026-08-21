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
    private var isPlayingFlag = false

    override public func load() {
        UIApplication.shared.beginReceivingRemoteControlEvents()
        setupRemoteCommands()
        activateAudioSession()
    }

    deinit {
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

                if let artwork = artwork {
                    let size = CGSize(
                        width: max(artwork.size.width, 600),
                        height: max(artwork.size.height, 600)
                    )
                    self.info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: size) { _ in artwork }
                }

                self.publish()
                self.attachObservers(to: player, item: item)
                player.play()
                self.isPlayingFlag = true
                self.notifyListeners("playing", data: [:])
                call.resolve()
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.player?.pause()
            self.isPlayingFlag = false
            self.info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            self.syncElapsedFromPlayer()
            self.publish()
            self.notifyListeners("paused", data: [:])
            call.resolve()
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.activateAudioSession()
            self.player?.play()
            self.isPlayingFlag = true
            self.info[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
            self.syncElapsedFromPlayer()
            self.publish()
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
                self.info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = max(0, time)
                self.publish()
                self.emitTimeUpdate()
                call.resolve()
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.tearDownPlayer()
            self.isPlayingFlag = false
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
                    let size = CGSize(width: max(image.size.width, 600), height: max(image.size.height, 600))
                    self.info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: size) { _ in image }
                }
                self.publish()
                call.resolve()
            }
        }
    }

    @objc func setPlaybackState(_ call: CAPPluginCall) {
        let state = call.getString("playbackState") ?? "none"
        DispatchQueue.main.async {
            switch state {
            case "playing":
                self.info[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
            default:
                self.info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            }
            self.info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
            self.publish()
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
            self.info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
            self.publish()
            call.resolve()
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.tearDownPlayer()
            self.isPlayingFlag = false
            self.info.removeAll()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }

    // MARK: - Player helpers

    private func attachObservers(to player: AVPlayer, item: AVPlayerItem) {
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
            self.isPlayingFlag = false
            self.info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            self.publish()
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
                    self.publish()
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

    private func syncElapsedFromPlayer() {
        let position = player?.currentTime().seconds ?? 0
        if position.isFinite {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = max(0, position)
        }
    }

    private func emitTimeUpdate() {
        let position = player?.currentTime().seconds ?? 0
        let duration = playerDuration()
        let safePosition = position.isFinite ? max(0, position) : 0
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = safePosition
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlayingFlag ? 1.0 : 0.0
        publish()
        notifyListeners("timeupdate", data: [
            "position": safePosition,
            "duration": duration,
            "playing": isPlayingFlag
        ])
    }

    private func publish() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
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
            self.player?.play()
            self.isPlayingFlag = true
            self.info[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
            self.syncElapsedFromPlayer()
            self.publish()
            self.notifyListeners("playing", data: [:])
            self.notifyListeners("action", data: ["action": "play"])
            return .success
        }

        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.player?.pause()
            self.isPlayingFlag = false
            self.info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            self.syncElapsedFromPlayer()
            self.publish()
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
                self.info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = max(0, time)
                self.publish()
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
