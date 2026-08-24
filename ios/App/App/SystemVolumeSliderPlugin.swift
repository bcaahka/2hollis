import Foundation
import UIKit
import Capacitor
import MediaPlayer

/// Overlays a native `MPVolumeView` on the web slot so system volume scrubbing
/// is handled entirely on the UIKit thread (no Capacitor bridge lag).
@objc(SystemVolumeSliderPlugin)
public class SystemVolumeSliderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SystemVolumeSliderPlugin"
    public let jsName = "SystemVolumeSlider"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "mount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unmount", returnType: CAPPluginReturnPromise),
    ]

    private var volumeView: MPVolumeView?

    @objc func mount(_ call: CAPPluginCall) {
        apply(call, createIfNeeded: true)
    }

    @objc func update(_ call: CAPPluginCall) {
        apply(call, createIfNeeded: false)
    }

    @objc func unmount(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.volumeView?.removeFromSuperview()
            self.volumeView = nil
            call.resolve()
        }
    }

    private func apply(_ call: CAPPluginCall, createIfNeeded: Bool) {
        let x = CGFloat(call.getDouble("x") ?? 0)
        let y = CGFloat(call.getDouble("y") ?? 0)
        let width = CGFloat(call.getDouble("width") ?? 0)
        let height = CGFloat(call.getDouble("height") ?? 0)
        let visible = call.getBool("visible") ?? true
        let activeHex = call.getString("activeColor")
        let trackHex = call.getString("trackColor")
        let thumbHex = call.getString("thumbColor")

        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("WebView unavailable")
                return
            }

            if width < 1 || height < 1 || !visible {
                self.volumeView?.isHidden = true
                call.resolve()
                return
            }

            let frame = CGRect(x: x, y: y, width: width, height: height)
            let view: MPVolumeView
            if let existing = self.volumeView {
                view = existing
            } else if createIfNeeded {
                view = MPVolumeView(frame: frame)
                view.showsVolumeSlider = true
                view.backgroundColor = .clear
                view.isOpaque = false
                // Hide AirPlay / route button — volume only.
                view.showsRouteButton = false
                webView.addSubview(view)
                self.volumeView = view
            } else {
                call.resolve()
                return
            }

            view.frame = frame
            view.isHidden = false
            let active = self.color(from: activeHex) ?? UIColor.label
            let track = self.color(from: trackHex) ?? UIColor.tertiaryLabel
            let thumb = self.color(from: thumbHex) ?? UIColor.label
            self.styleSlider(in: view, active: active, track: track, thumb: thumb)
            // Slider subview can appear a tick later after first layout.
            DispatchQueue.main.async {
                self.styleSlider(in: view, active: active, track: track, thumb: thumb)
            }
            call.resolve()
        }
    }

    private func styleSlider(in volumeView: MPVolumeView, active: UIColor, track: UIColor, thumb: UIColor) {
        guard let slider = Self.findSlider(in: volumeView) else { return }
        slider.minimumTrackTintColor = active
        slider.maximumTrackTintColor = track
        let thumbImage = Self.makeThumb(color: thumb, diameter: 12)
        slider.setThumbImage(thumbImage, for: .normal)
        slider.setThumbImage(thumbImage, for: .highlighted)
    }

    private static func findSlider(in root: UIView) -> UISlider? {
        if let slider = root as? UISlider { return slider }
        for child in root.subviews {
            if let slider = findSlider(in: child) { return slider }
        }
        return nil
    }

    private static func makeThumb(color: UIColor, diameter: CGFloat) -> UIImage {
        let size = CGSize(width: diameter, height: diameter)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            color.setFill()
            UIBezierPath(ovalIn: CGRect(origin: .zero, size: size)).fill()
        }
    }

    private func color(from hex: String?) -> UIColor? {
        guard var raw = hex?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if raw.hasPrefix("#") { raw.removeFirst() }
        guard raw.count == 6, let value = UInt64(raw, radix: 16) else { return nil }
        return UIColor(
            red: CGFloat((value >> 16) & 0xff) / 255,
            green: CGFloat((value >> 8) & 0xff) / 255,
            blue: CGFloat(value & 0xff) / 255,
            alpha: 1
        )
    }
}
