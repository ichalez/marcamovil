import Foundation

/// Parámetros de una emisión, recibidos desde Flutter.
struct BroadcastConfig {
    let rtmpUrl: String
    let streamKey: String
    let overlayUrl: String
    let title: String
    let width: Int
    let height: Int
    let fps: Int
    let videoBitrate: Int
    let audioBitrate: Int
    let adaptiveBitrate: Bool
    let overlayFps: Int

    init(_ m: [String: Any]) {
        rtmpUrl = (m["rtmpUrl"] as? String ?? "").trimmingCharacters(in: .whitespaces)
        streamKey = (m["streamKey"] as? String ?? "").trimmingCharacters(in: .whitespaces)
        overlayUrl = m["overlayUrl"] as? String ?? ""
        title = m["title"] as? String ?? ""
        width = (m["width"] as? NSNumber)?.intValue ?? 1280
        height = (m["height"] as? NSNumber)?.intValue ?? 720
        fps = (m["fps"] as? NSNumber)?.intValue ?? 30
        videoBitrate = (m["videoBitrate"] as? NSNumber)?.intValue ?? 2_500_000
        audioBitrate = (m["audioBitrate"] as? NSNumber)?.intValue ?? 128_000
        adaptiveBitrate = m["adaptiveBitrate"] as? Bool ?? true
        overlayFps = max(1, min(15, (m["overlayFps"] as? NSNumber)?.intValue ?? 4))
    }
}
