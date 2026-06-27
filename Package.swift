// swift-tools-version: 5.8
import PackageDescription

let package = Package(
    name: "RealmLiveDebugger",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15)
    ],
    products: [
        .library(
            name: "RealmLiveDebugger",
            targets: ["RealmLiveDebugger"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/realm/realm-swift.git", from: "20.0.0")
    ],
    targets: [
        .target(
            name: "RealmLiveDebugger",
            dependencies: [
                .product(name: "RealmSwift", package: "realm-swift")
            ],
            path: "client/ios"
        )
    ]
)
