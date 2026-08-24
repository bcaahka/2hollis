import Foundation
import UIKit
import Capacitor
import MediaPlayer

/// MPVolumeView that gives the volume slider the full frame (no route-button gap)
/// and vertically centers the track so it lines up with the web volume icon.
private final class FullWidthVolumeView: MPVolumeView {
    override func volumeSliderRect(forBounds bounds: CGRect) -> CGRect {
        // UISlider intrinsic track height ~31pt — center inside the web slot.
        let trackHeight: CGFloat = 31
        let y = bounds.midY - trackHeight / 2
        return CGRect(x: bounds.minX, y: y, width: bounds.width, height: trackHeight)
    }

    override func routeButtonRect(forBounds bounds: CGRect) -> CGRect {
        .zero
    }
}

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

    private var volumeView: FullWidthVolumeView?
    private var didStyle = false

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
            self.didStyle = false
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
            guard
                let webView = self.bridge?.webView,
                let host = self.bridge?.viewController?.view
            else {
                call.reject("WebView unavailable")
                return
            }

            if width < 1 || height < 1 || !visible {
                self.volumeView?.isHidden = true
                call.resolve()
                return
            }

            // getBoundingClientRect is in webView bounds space → convert to host
            // so safe-area / webView origin can't push the slider above the icon.
            let rectInWeb = CGRect(x: x, y: y, width: width, height: height)
            let frame = webView.convert(rectInWeb, to: host)

            let created: Bool
            let view: FullWidthVolumeView
            if let existing = self.volumeView {
                view = existing
                created = false
            } else if createIfNeeded {
                view = FullWidthVolumeView(frame: frame)
                view.showsVolumeSlider = true
                view.backgroundColor = .clear
                view.isOpaque = false
                view.showsRouteButton = false
                host.addSubview(view)
                self.volumeView = view
                created = true
            } else {
                call.resolve()
                return
            }

            if view.superview !== host {
                view.removeFromSuperview()
                host.addSubview(view)
            }

            view.frame = frame
            view.isHidden = false
            view.setNeedsLayout()
            view.layoutIfNeeded()

            if created || !self.didStyle {
                let active = self.color(from: activeHex) ?? UIColor.label
                let track = self.color(from: trackHex) ?? UIColor.tertiaryLabel
                let thumb = self.color(from: thumbHex) ?? UIColor.label
                self.styleSlider(in: view, active: active, track: track, thumb: thumb)
                // Slider subview appears after first layout pass.
                DispatchQueue.main.async {
                    self.styleSlider(in: view, active: active, track: track, thumb: thumb)
                    self.didStyle = true
                }
            }
            call.resolve()
        }
    }

    private func styleSlider(in volumeView: MPVolumeView, active: UIColor, track: UIColor, thumb: UIColor) {
        guard let slider = Self.findSlider(in: volumeView) else { return }

        // Tint alone is unreliable on recent iOS — use stretchable track images.
        slider.setMinimumTrackImage(Self.trackImage(color: active), for: .normal)
        slider.setMaximumTrackImage(Self.trackImage(color: track), for: .normal)
        slider.minimumTrackTintColor = nil
        slider.maximumTrackTintColor = nil

        let thumbImage = Self.makeThumb(color: thumb, diameter: 14)
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

    private static func trackImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 4, height: 2)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { _ in
            color.setFill()
            UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 1).fill()
        }
        return image
            .resizableImage(withCapInsets: UIEdgeInsets(top: 0, left: 2, bottom: 0, right: 2),
                            resizingMode: .stretch)
            .withRenderingMode(.alwaysOriginal)
    }

    private static func makeThumb(color: UIColor, diameter: CGFloat) -> UIImage {
        let size = CGSize(width: diameter, height: diameter)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            color.setFill()
            UIBezierPath(ovalIn: CGRect(origin: .zero, size: size)).fill()
        }.withRenderingMode(.alwaysOriginal)
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
