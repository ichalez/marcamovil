import AVFoundation
import HaishinKit
import RTMPHaishinKit
import UIKit
import WebKit

/// Pantalla de emisión: cámara + overlay HTML + envío RTMP.
///
/// El overlay se carga en un WKWebView transparente (detrás de la vista previa) del tamaño del
/// vídeo. Varias veces por segundo se captura y se pone como imagen en la "pantalla" de HaishinKit,
/// que la compone sobre la cámara. La vista previa muestra exactamente lo que se emite.
final class BroadcastViewController: UIViewController {
    private static let maxRetries = 30
    private static let retryDelay: UInt64 = 3_000_000_000

    private let config: BroadcastConfig
    private let onFinish: (Int, String?) -> Void

    private let mixer = MediaMixer()
    private let connection = RTMPConnection()
    private lazy var stream = RTMPStream(connection: connection)
    @ScreenActor private var overlayObject: ImageScreenObject?

    private let preview = MTHKView(frame: .zero)
    private var webView: WKWebView!
    private let statusLabel = PaddingLabel()
    private let infoLabel = PaddingLabel()
    private let startButton = UIButton(type: .system)
    private let muteButton = UIButton(type: .system)
    private let overlayButton = UIButton(type: .system)

    private var overlayTimer: Timer?
    private var uiTimer: Timer?
    private var statusTask: Task<Void, Never>?

    private var position: AVCaptureDevice.Position = .back
    private var isMuted = false
    private var overlayEnabled = true
    private var overlayLoaded = false
    private var wantStreaming = false
    private var connected = false
    private var connecting = false
    private var retries = 0
    private var streamStartedAt: Date?
    private var accumulated: TimeInterval = 0
    private var lastError: String?
    private var finished = false

    init(config: BroadcastConfig, onFinish: @escaping (Int, String?) -> Void) {
        self.config = config
        self.onFinish = onFinish
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Orientación

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscapeRight }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .landscapeRight }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    // MARK: - Ciclo de vida

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        buildLayout()
        UIApplication.shared.isIdleTimerDisabled = true
        requestPermissions { [weak self] granted in
            guard let self else { return }
            if granted {
                self.setUpCapture()
            } else {
                self.fail("Hacen falta los permisos de cámara y micrófono para emitir. Actívalos en Ajustes.")
            }
        }
        uiTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.updateUi()
        }
        updateUi()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
            view.window?.windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: .landscapeRight)) { _ in }
        }
    }

    private func requestPermissions(_ done: @escaping (Bool) -> Void) {
        AVCaptureDevice.requestAccess(for: .video) { video in
            AVCaptureDevice.requestAccess(for: .audio) { audio in
                DispatchQueue.main.async { done(video && audio) }
            }
        }
    }

    // MARK: - Interfaz

    private func makeButton(_ button: UIButton, _ title: String, color: UIColor, action: Selector) {
        button.setTitle(title, for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .boldSystemFont(ofSize: 15)
        button.backgroundColor = color
        button.layer.cornerRadius = 22
        button.contentEdgeInsets = UIEdgeInsets(top: 10, left: 16, bottom: 10, right: 16)
        button.addTarget(self, action: action, for: .touchUpInside)
    }

    private func buildLayout() {
        // 1) WebView del overlay (al fondo, tapado por la vista previa).
        let scale = UIScreen.main.scale
        let webConfig = WKWebViewConfiguration()
        webConfig.allowsInlineMediaPlayback = true
        webView = WKWebView(
            frame: CGRect(x: 0, y: 0, width: CGFloat(config.width) / scale, height: CGFloat(config.height) / scale),
            configuration: webConfig
        )
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.navigationDelegate = self
        view.addSubview(webView)

        // 2) Vista previa (con el overlay ya compuesto).
        preview.videoGravity = .resizeAspect
        preview.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(preview)

        // 3) Barra superior.
        for label in [statusLabel, infoLabel] {
            label.textColor = .white
            label.layer.cornerRadius = 8
            label.layer.masksToBounds = true
        }
        statusLabel.font = .boldSystemFont(ofSize: 15)
        infoLabel.font = .systemFont(ofSize: 13)
        infoLabel.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        let top = UIStackView(arrangedSubviews: [statusLabel, infoLabel, UIView()])
        top.axis = .horizontal
        top.spacing = 8
        top.alignment = .center
        top.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(top)

        // 4) Botones.
        let gray = UIColor(red: 0.11, green: 0.16, blue: 0.26, alpha: 0.85)
        let exitButton = UIButton(type: .system)
        let cameraButton = UIButton(type: .system)
        makeButton(exitButton, "✕ Salir", color: gray, action: #selector(exitTapped))
        makeButton(cameraButton, "⟲ Cámara", color: gray, action: #selector(switchCamera))
        makeButton(muteButton, "🎤 Micro: sí", color: gray, action: #selector(toggleMute))
        makeButton(overlayButton, "Marcador: sí", color: gray, action: #selector(toggleOverlay))
        makeButton(startButton, "● EMITIR", color: .systemRed, action: #selector(toggleStream))
        startButton.titleLabel?.font = .boldSystemFont(ofSize: 18)
        startButton.layer.cornerRadius = 28
        let bottom = UIStackView(arrangedSubviews: [exitButton, cameraButton, muteButton, overlayButton, UIView(), startButton])
        bottom.axis = .horizontal
        bottom.spacing = 8
        bottom.alignment = .center
        bottom.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottom)

        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            preview.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            preview.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            preview.topAnchor.constraint(equalTo: view.topAnchor),
            preview.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            top.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            top.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            top.topAnchor.constraint(equalTo: guide.topAnchor, constant: 10),
            bottom.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            bottom.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            bottom.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -12),
            startButton.heightAnchor.constraint(equalToConstant: 56),
            startButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 150),
        ])
    }

    // MARK: - Captura

    private func setUpCapture() {
        let width = config.width
        let height = config.height
        Task { @MainActor in
            do {
                var mixerSettings = await mixer.videoMixerSettings
                mixerSettings.mode = .offscreen
                await mixer.setVideoMixerSettings(mixerSettings)
                await mixer.setSessionPreset(height >= 1080 ? .hd1920x1080 : height >= 720 ? .hd1280x720 : .vga640x480)
                await mixer.setVideoOrientation(.landscapeRight)
                await configureScreen(width: width, height: height)

                let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
                try await mixer.attachVideo(camera, track: 0) { unit in
                    unit.isVideoMirrored = false
                }
                try await mixer.attachAudio(AVCaptureDevice.default(for: .audio))
                try? await mixer.setFrameRate(Float64(config.fps))

                var videoSettings = await stream.videoSettings
                videoSettings.videoSize = CGSize(width: width, height: height)
                videoSettings.bitRate = config.videoBitrate
                try await stream.setVideoSettings(videoSettings)
                try await stream.setAudioSettings(AudioCodecSettings(bitRate: config.audioBitrate))
                if config.adaptiveBitrate {
                    await stream.setBitRateStrategy(StreamVideoAdaptiveBitRateStrategy(mamimumVideoBitrate: config.videoBitrate))
                }

                await mixer.addOutput(stream)
                await mixer.addOutput(preview)
                await mixer.startRunning()
            } catch {
                fail("No se pudo iniciar la cámara: \(error.localizedDescription)")
                return
            }
            watchConnection()
            if let url = URL(string: config.overlayUrl), !config.overlayUrl.isEmpty {
                webView.load(URLRequest(url: url))
            }
            let interval = 1.0 / Double(config.overlayFps)
            overlayTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
                self?.captureOverlay()
            }
        }
    }

    @ScreenActor
    private func configureScreen(width: Int, height: Int) async {
        let screen = await mixer.screen
        screen.size = CGSize(width: width, height: height)
        screen.backgroundColor = UIColor.black.cgColor
        let object = ImageScreenObject()
        object.size = CGSize(width: width, height: height)
        try? screen.addChild(object)
        overlayObject = object
    }

    /// Captura el WebView y lo pone como imagen sobre el vídeo.
    private func captureOverlay() {
        guard overlayEnabled, overlayLoaded else { return }
        let snapshotConfig = WKSnapshotConfiguration()
        snapshotConfig.afterScreenUpdates = false
        snapshotConfig.snapshotWidth = NSNumber(value: Double(webView.bounds.width))
        webView.takeSnapshot(with: snapshotConfig) { [weak self] image, _ in
            guard let self, self.overlayEnabled, let cgImage = image?.cgImage else { return }
            Task { @ScreenActor in
                self.overlayObject?.cgImage = cgImage
            }
        }
    }

    // MARK: - Conexión

    private func watchConnection() {
        statusTask = Task { @MainActor [weak self] in
            guard let self else { return }
            for await status in await self.connection.status {
                if status.code == RTMPConnection.Code.connectClosed.rawValue {
                    self.handleClosed(reason: status.description)
                }
            }
        }
    }

    private func connect() {
        guard wantStreaming, !connecting else { return }
        connecting = true
        updateUi()
        Task { @MainActor in
            do {
                _ = try await connection.connect(config.rtmpUrl)
                _ = try await stream.publish(config.streamKey)
                connecting = false
                connected = true
                retries = 0
                streamStartedAt = Date()
            } catch {
                connecting = false
                try? await connection.close()
                scheduleRetry(reason: error.localizedDescription)
            }
            updateUi()
        }
    }

    private func handleClosed(reason: String) {
        if connected, let start = streamStartedAt {
            accumulated += Date().timeIntervalSince(start)
        }
        connected = false
        streamStartedAt = nil
        if wantStreaming && !connecting {
            scheduleRetry(reason: reason)
        }
        updateUi()
    }

    private func scheduleRetry(reason: String) {
        guard wantStreaming else { return }
        if retries >= Self.maxRetries {
            wantStreaming = false
            lastError = reason
            alert("Se ha cortado la emisión", "No se pudo conectar con YouTube: \(reason)\n\nRevisa la conexión y la clave de emisión.")
            updateUi()
            return
        }
        retries += 1
        updateUi()
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: Self.retryDelay)
            self.connect()
        }
    }

    private func stopStreaming() {
        wantStreaming = false
        if connected, let start = streamStartedAt {
            accumulated += Date().timeIntervalSince(start)
        }
        connected = false
        streamStartedAt = nil
        Task {
            _ = try? await stream.close()
            try? await connection.close()
        }
        updateUi()
    }

    // MARK: - Acciones

    @objc private func toggleStream() {
        if wantStreaming {
            let alert = UIAlertController(title: "¿Parar la emisión?", message: "Se cortará el directo en YouTube.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Seguir emitiendo", style: .cancel))
            alert.addAction(UIAlertAction(title: "Parar", style: .destructive) { [weak self] _ in self?.stopStreaming() })
            present(alert, animated: true)
            return
        }
        guard !config.rtmpUrl.isEmpty, !config.streamKey.isEmpty else {
            self.alert("Falta la clave de emisión", "Configura el servidor RTMP y la clave de emisión de YouTube en el partido.")
            return
        }
        wantStreaming = true
        retries = 0
        lastError = nil
        connect()
    }

    @objc private func switchCamera() {
        position = position == .back ? .front : .back
        let newPosition = position
        Task {
            let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPosition)
            try? await mixer.attachVideo(device, track: 0) { unit in
                unit.isVideoMirrored = newPosition == .front
            }
        }
    }

    @objc private func toggleMute() {
        isMuted.toggle()
        let muted = isMuted
        muteButton.setTitle(muted ? "🔇 Micro: no" : "🎤 Micro: sí", for: .normal)
        Task {
            var settings = await mixer.audioMixerSettings
            var track = settings.tracks[0] ?? .init()
            track.isMuted = muted
            settings.tracks[0] = track
            await mixer.setAudioMixerSettings(settings)
        }
    }

    @objc private func toggleOverlay() {
        overlayEnabled.toggle()
        overlayButton.setTitle(overlayEnabled ? "Marcador: sí" : "Marcador: no", for: .normal)
        if !overlayEnabled {
            Task { @ScreenActor in
                self.overlayObject?.cgImage = nil
            }
        }
    }

    @objc private func exitTapped() {
        guard wantStreaming else {
            finish()
            return
        }
        let alert = UIAlertController(title: "¿Salir y parar la emisión?", message: nil, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        alert.addAction(UIAlertAction(title: "Salir", style: .destructive) { [weak self] _ in
            self?.stopStreaming()
            self?.finish()
        })
        present(alert, animated: true)
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        overlayTimer?.invalidate()
        uiTimer?.invalidate()
        statusTask?.cancel()
        UIApplication.shared.isIdleTimerDisabled = false
        let seconds = Int(totalStreamed())
        let error = lastError
        Task {
            await mixer.stopRunning()
            try? await mixer.attachAudio(nil)
            try? await mixer.attachVideo(nil, track: 0)
        }
        dismiss(animated: true) { [onFinish] in
            onFinish(seconds, error)
        }
    }

    private func fail(_ message: String) {
        lastError = message
        let alert = UIAlertController(title: "No se puede emitir", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cerrar", style: .default) { [weak self] _ in self?.finish() })
        present(alert, animated: true)
    }

    private func alert(_ title: String, _ message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Vale", style: .default))
        present(alert, animated: true)
    }

    private func totalStreamed() -> TimeInterval {
        accumulated + (streamStartedAt.map { Date().timeIntervalSince($0) } ?? 0)
    }

    private func updateUi() {
        let seconds = Int(totalStreamed())
        let time = String(format: "%d:%02d:%02d", seconds / 3600, (seconds / 60) % 60, seconds % 60)
        if connected {
            statusLabel.text = "● EN DIRECTO  \(time)"
            statusLabel.backgroundColor = UIColor.systemRed.withAlphaComponent(0.9)
        } else if wantStreaming && retries > 0 {
            statusLabel.text = "Reconectando… (\(retries)/\(Self.maxRetries))"
            statusLabel.backgroundColor = UIColor.systemOrange.withAlphaComponent(0.9)
        } else if wantStreaming {
            statusLabel.text = "Conectando…"
            statusLabel.backgroundColor = UIColor.systemOrange.withAlphaComponent(0.9)
        } else {
            statusLabel.text = "Vista previa"
            statusLabel.backgroundColor = UIColor.darkGray.withAlphaComponent(0.85)
        }
        var info = "\(config.height)p\(config.fps)"
        if config.overlayUrl.isEmpty {
            info += "  ·  sin overlay"
        } else if !overlayLoaded {
            info += "  ·  cargando overlay…"
        }
        if !config.title.isEmpty { info += "  ·  \(config.title)" }
        infoLabel.text = info
        startButton.setTitle(wantStreaming ? "■ PARAR" : "● EMITIR", for: .normal)
        startButton.backgroundColor = wantStreaming ? UIColor.darkGray : UIColor.systemRed
    }
}

extension BroadcastViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        overlayLoaded = true
        updateUi()
    }
}

/// UILabel con margen interior.
final class PaddingLabel: UILabel {
    var insets = UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: insets))
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(width: size.width + insets.left + insets.right, height: size.height + insets.top + insets.bottom)
    }
}
