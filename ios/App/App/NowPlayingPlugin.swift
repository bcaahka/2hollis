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

    override public func load() {
        UIApplication.shared.beginReceivingRemoteControlEvents()
        setupRemoteCommands()
        activateAudioSession()
    }

    @objc func setMetadata(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let title = call.getString("title") {
                self.info[MPMediaItemPropertyTitle] = title
            }
            if let artist = call.getString("artist") {
                self.info[MPMediaItemPropertyArtist] = artist
            }
            if let album = call.getString("album") {
                self.info[MPMediaItemPropertyAlbumTitle] = album
            }

            if let artworkBase64 = call.getString("artworkBase64"),
               let data = Data(base64Encoded: artworkBase64, options: .ignoreUnknownCharacters),
               let image = UIImage(data: data) {
                self.info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            } else if let src = call.getString("artworkSrc") {
                self.loadImage(from: src) { image in
                    if let image = image {
                        self.info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                    }
                    self.publish()
                    call.resolve()
                }
                return
            }

            self.publish()
            call.resolve()
        }
    }

    @objc func setPlaybackState(_ call: CAPPluginCall) {
        let state = call.getString("playbackState") ?? "none"
        DispatchQueue.main.async {
            switch state {
            case "playing":
                self.info[MPNowPlayingInfoPropertyPlaybackRate] = 1.0
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
            self.info.removeAll()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
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

    private func loadImage(from src: String, completion: @escaping (UIImage?) -> Void) {
        if src.hasPrefix("data:"),
           let range = src.range(of: "base64,"),
           let data = Data(base64Encoded: String(src[range.upperBound...]), options: .ignoreUnknownCharacters),
           let image = UIImage(data: data) {
            completion(image)
            return
        }

        guard let url = URL(string: src) else {
            completion(nil)
            return
        }

        if url.isFileURL {
            completion(UIImage(contentsOfFile: url.path))
            return
        }

        URLSession.shared.dataTask(with: url) { data, _, _ in
            let image = data.flatMap { UIImage(data: $0) }
            DispatchQueue.main.async {
                completion(image)
            }
        }.resume()
    }
}
