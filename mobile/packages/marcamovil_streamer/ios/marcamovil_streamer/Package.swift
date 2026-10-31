// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "marcamovil_streamer",
    platforms: [
        .iOS("15.0")
    ],
    products: [
        .library(name: "marcamovil-streamer", targets: ["marcamovil_streamer"])
    ],
    dependencies: [
        .package(name: "FlutterFramework", path: "../FlutterFramework"),
        // Captura, composición y emisión RTMP
        .package(url: "https://github.com/HaishinKit/HaishinKit.swift", exact: "2.2.5"),
    ],
    targets: [
        .target(
            name: "marcamovil_streamer",
            dependencies: [
                .product(name: "FlutterFramework", package: "FlutterFramework"),
                .product(name: "HaishinKit", package: "HaishinKit.swift"),
                .product(name: "RTMPHaishinKit", package: "HaishinKit.swift"),
            ],
            resources: [
                .process("PrivacyInfo.xcprivacy"),
            ],
            swiftSettings: [
                .swiftLanguageMode(.v5),
            ]
        )
    ]
)
