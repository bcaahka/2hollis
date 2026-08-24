import Foundation
import UIKit
import Capacitor
import MediaPlayer

/// Full-bleed volume slider; route button rect is zeroed out.
private final class FullWidthVolumeView: MPVolumeView {
    override func volumeSliderRect(forBounds bounds: CGRect) -> CGRect {
        bounds
    }

    override func routeButtonRect(forBounds bounds: CGRect) -> CGRect {
        .zero
    }
}

/// Invisible native system-volume hit target over the web IonRange.
/// Visuals stay in the web layer (red / small knob); this view only handles touches.
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
    private var styleTimer: Timer?

    @objc func mount(_ call: CAPPluginCall) {
        apply(call, createIfNeeded: true)
    }

    @objc func update(_ call: CAPPluginCall) {
        apply(call, createIfNeeded: false)
    }

    @objc func unmount(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.styleTimer?.invalidate()
            self.styleTimer = nil
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

        DispatchQueue.main.async {
            guard
                let webView = self.bridge?.webView,
                let host = self.bridge?.viewController?.view
            else {
                call.reject("WebView unavailable")
                return
            }

            // Keep last good frame — never hide on transient bad rects (was causing
            // the slider to vanish while the speaker icon stayed).
            guard width >= 8, height >= 8 else {
                call.resolve()
                return
            }

            let rectInWeb = CGRect(x: x, y: y, width: width, height: height)
            let frame = webView.convert(rectInWeb, to: host)

            let view: FullWidthVolumeView
            if let existing = self.volumeView {
                view = existing
            } else if createIfNeeded {
                view = FullWidthVolumeView(frame: frame)
                view.showsVolumeSlider = true
                view.showsRouteButton = false
                view.backgroundColor = .clear
                view.isOpaque = false
                view.alpha = 0.02 // nearly invisible, still receives touches
                host.addSubview(view)
                self.volumeView = view
                self.startStyleWatch(view)
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
            self.makeTransparent(view)
            call.resolve()
        }
    }

    /// iOS periodically resets MPVolumeView chrome — re-clear on a timer.
    private func startStyleWatch(_ view: FullWidthVolumeView) {
        styleTimer?.invalidate()
        makeTransparent(view)
        styleTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self, weak view] _ in
            guard let self, let view else { return }
            self.makeTransparent(view)
        }
        if let styleTimer {
            RunLoop.main.add(styleTimer, forMode: .common)
        }
    }

    private func makeTransparent(_ volumeView: MPVolumeView) {
        guard let slider = Self.findSlider(in: volumeView) else { return }

        let clearTrack = Self.clearImage(size: CGSize(width: 4, height: 2))
            .resizableImage(withCapInsets: UIEdgeInsets(top: 0, left: 1, bottom: 0, right: 1),
                            resizingMode: .stretch)
        let clearThumb = Self.clearImage(size: CGSize(width: 28, height: 28))

        slider.setMinimumTrackImage(clearTrack, for: .normal)
        slider.setMaximumTrackImage(clearTrack, for: .normal)
        slider.setThumbImage(clearThumb, for: .normal)
        slider.setThumbImage(clearThumb, for: .highlighted)
        slider.minimumTrackTintColor = .clear
        slider.maximumTrackTintColor = .clear
        slider.thumbTintColor = .clear
    }

    private static func findSlider(in root: UIView) -> UISlider? {
        if let slider = root as? UISlider { return slider }
        for child in root.subviews {
            if let slider = findSlider(in: child) { return slider }
        }
        return nil
    }

    private static func clearImage(size: CGSize) -> UIImage {
        UIGraphicsImageRenderer(size: size).image { _ in }.withRenderingMode(.alwaysOriginal)
    }
}
