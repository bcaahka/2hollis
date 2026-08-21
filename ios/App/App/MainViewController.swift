import UIKit
import Capacitor

/// Registers local plugins that Capacitor 6+ no longer auto-discovers.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NowPlayingPlugin())
    }
}
