import UIKit
import Capacitor
import CryptoKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        connectionOptions.urlContexts.forEach(handle)
        connectionOptions.userActivities.forEach(handle)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        URLContexts.forEach(handle)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        handle(userActivity)
    }

    private func handle(_ urlContext: UIOpenURLContext) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            open: urlContext.url,
            options: urlOptions(from: urlContext)
        )
    }

    private func handle(_ userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity) { _ in }
    }

    private func urlOptions(from urlContext: UIOpenURLContext) -> [UIApplication.OpenURLOptionsKey: Any] {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [
            .openInPlace: urlContext.options.openInPlace
        ]

        if let sourceApplication = urlContext.options.sourceApplication {
            options[.sourceApplication] = sourceApplication
        }

        return options
    }

}

// System export picker reports an actual saved document, unlike a share sheet.
class MigrationBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BrewGuideDocumentPlugin())
    }
}

@objc(BrewGuideDocumentPlugin)
class BrewGuideDocumentPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "BrewGuideDocumentPlugin"
    let jsName = "BrewGuideDocument"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "saveFile", returnType: CAPPluginReturnPromise)]
    private var pending: CAPPluginCall?
    private var stagedDirectory: URL?
    private var expectedDigest: String?

    @objc func saveFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("A backup save is already active"); return }
            guard let source = call.getString("sourceUri"), let url = URL(string: source), url.isFileURL,
                  let name = call.getString("fileName"), name == URL(fileURLWithPath: name).lastPathComponent,
                  let digest = call.getString("sha256"), digest.count == 64,
                  let controller = self.bridge?.viewController else {
                call.reject("Invalid backup save request"); return
            }
            do {
                let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].resolvingSymlinksInPath().path + "/"
                guard url.resolvingSymlinksInPath().path.hasPrefix(cache) else {
                    call.reject("Backup source must be an app cache file"); return
                }
                guard try self.sha256(url) == digest else {
                    call.reject("Backup source verification failed"); return
                }
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                self.stagedDirectory = directory
                let staged = directory.appendingPathComponent(name)
                try FileManager.default.copyItem(at: url, to: staged)
                self.expectedDigest = digest
                self.pending = call
                let picker = UIDocumentPickerViewController(forExporting: [staged], asCopy: true)
                picker.delegate = self
                controller.present(picker, animated: true)
            } catch {
                let wasPending = self.pending != nil
                self.finish(error: error)
                if !wasPending { call.reject(error.localizedDescription) }
            }
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pending?.resolve(["cancelled": true])
        finish()
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { finish(error: NSError(domain: "Backup", code: 1)); return }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        var coordinationError: NSError?
        var readError: Error?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { readable in
            do {
                guard try self.sha256(readable) == self.expectedDigest else {
                    throw NSError(domain: "Backup", code: 2, userInfo: [NSLocalizedDescriptionKey: "备份文件读回校验失败"])
                }
            } catch { readError = error }
        }
        if let error = coordinationError ?? readError as NSError? { finish(error: error); return }
        pending?.resolve(["uri": url.absoluteString])
        finish()
    }

    private func sha256(_ url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hash = SHA256()
        while let chunk = try handle.read(upToCount: 1024 * 1024), !chunk.isEmpty { hash.update(data: chunk) }
        return hash.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private func finish(error: Error? = nil) {
        if let error = error { pending?.reject(error.localizedDescription) }
        pending = nil
        expectedDigest = nil
        if let directory = stagedDirectory { try? FileManager.default.removeItem(at: directory) }
        stagedDirectory = nil
    }
}
