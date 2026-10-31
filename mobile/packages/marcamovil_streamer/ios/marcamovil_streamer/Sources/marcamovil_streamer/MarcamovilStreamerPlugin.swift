import Flutter
import UIKit

/// Puente Flutter → pantalla nativa de emisión.
public class MarcamovilStreamerPlugin: NSObject, FlutterPlugin {
    private var isOpen = false

    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(name: "marcamovil_streamer", binaryMessenger: registrar.messenger())
        let instance = MarcamovilStreamerPlugin()
        registrar.addMethodCallDelegate(instance, channel: channel)
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "openBroadcast":
            guard !isOpen else {
                result(FlutterError(code: "BUSY", message: "Ya hay una emisión abierta", details: nil))
                return
            }
            guard let presenter = Self.topViewController() else {
                result(FlutterError(code: "NO_VIEW", message: "No hay pantalla activa", details: nil))
                return
            }
            let config = BroadcastConfig(call.arguments as? [String: Any] ?? [:])
            isOpen = true
            let controller = BroadcastViewController(config: config) { [weak self] seconds, error in
                self?.isOpen = false
                result(["streamedSeconds": seconds, "error": error as Any])
            }
            controller.modalPresentationStyle = .fullScreen
            presenter.present(controller, animated: true)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap { $0.windows }
        let window = windows.first { $0.isKeyWindow } ?? windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
