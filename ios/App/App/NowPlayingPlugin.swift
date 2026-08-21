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
        CAPPluginMethod(name: "setMetadata", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPlaybackState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPositionState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private var info: [String: Any] = [:]
    private var republishWorkItem: DispatchWorkItem?

    override public func load() {
        UIApplication.shared.beginReceivingRemoteControlEvents()
        setupRemoteCommands()
        activateAudioSession()
    }

    @objc func setMetadata(_ call: CAPPluginCall) {
        let title = call.getString("title")
        let artist = call.getString("artist")
        let album = call.getString("album")
        let artworkPath = call.getString("artworkPath")
        let artworkBase64 = call.getString("artworkBase64")
        let artworkSrc = call.getString("artworkSrc")

        DispatchQueue.global(qos: .userInitiated).async {
            let image = self.resolveArtwork(
                path: artworkPath,
                base64: artworkBase64,
                src: artworkSrc
            )

            DispatchQueue.main.async {
                if let title = title {
                    self.info[MPMediaItemPropertyTitle] = title
                }
                if let artist = artist {
                    self.info[MPMediaItemPropertyArtist] = artist
                }
                if let album = album {
                    self.info[MPMediaItemPropertyAlbumTitle] = album
                }

                self.info[MPNowPlayingInfoPropertyMediaType] =
                    NSNumber(value: MPNowPlayingInfoMediaType.audio.rawValue)

                if let image = image {
                    let size = CGSize(
                        width: max(image.size.width, 600),
                        height: max(image.size.height, 600)
                    )
                    self.info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: size) { _ in image }
                }

                self.publish()
                self.scheduleRepublish()
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
                self.scheduleRepublish()
            case "paused":
                self.info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
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
            self.republishWorkItem?.cancel()
            self.republishWorkItem = nil
            self.info.removeAll()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }

    private func publish() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    /// WKWebView HTMLAudio often overwrites Now Playing right after play — push again.
    private func scheduleRepublish() {
        republishWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self, !self.info.isEmpty else { return }
            self.publish()
        }
        republishWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self = self, !self.info.isEmpty else { return }
            self.publish()
        }
    }

    private func activateAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            // Keep going; HTMLAudio may still play.
        }
    }

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.isEnabled = true
        center.playCommand.addTarget { [weak self] _ in
            self?.notifyListeners("action", data: ["action": "play"])
            return .success
        }

        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget { [weak self] _ in
            self?.notifyListeners("action", data: ["action": "pause"])
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
            guard let event = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self?.notifyListeners("action", data: [
                "action": "seekto",
                "seekTime": event.positionTime
            ])
            return .success
        }
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

    /// Covers are shipped in the Capacitor `public/` folder inside the app bundle.
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

        // Try URL-decoding in case JS sent an encoded path.
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

        // Capacitor local server / remote URL — short sync wait for Now Playing.
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
