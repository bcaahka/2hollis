import UIKit
import Capacitor

/// Registers local plugins that Capacitor 6+ no longer auto-discovers.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        // Instance registration is required for app-local Swift plugins.
        bridge?.registerPluginInstance(NowPlayingPlugin())
    }
}
