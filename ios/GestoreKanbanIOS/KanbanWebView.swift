import EventKit
import Security
import SwiftUI
import UniformTypeIdentifiers
import WebKit

struct KanbanWebView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> KanbanViewController { KanbanViewController() }
    func updateUIViewController(_ uiViewController: KanbanViewController, context: Context) {}
}

final class KanbanViewController: UIViewController, WKScriptMessageHandler, UIDocumentPickerDelegate {
    private let eventStore = EKEventStore()
    private var webView: WKWebView!
    private var pendingImport: ImportKind?

    private enum ImportKind { case excel, backup }
    private let handlers = [
        "exportMarkdown", "exportBinary", "importExcel", "restoreBackup", "openExternalUrl",
        "exportBackupZip", "saveAppState", "saveSyncAuth", "listReminderCalendars", "syncReminders"
    ]

    private var supportDirectory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Gestore attività Kanban", isDirectory: true)
    }
    private var stateURL: URL { supportDirectory.appendingPathComponent("kanban-state.json") }

    override func viewDidLoad() {
        super.viewDidLoad()
        let controller = WKUserContentController()
        handlers.forEach { controller.add(self, name: $0) }
        controller.addUserScript(nativeStateScript())

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        loadApp()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let payload = message.body as? [String: Any] ?? [:]
        switch message.name {
        case "saveAppState":
            if let text = message.body as? String { saveState(text) }
        case "saveSyncAuth":
            saveSyncAuth(message.body as? String ?? "")
        case "openExternalUrl":
            if let raw = payload["url"] as? String, let url = URL(string: raw) { UIApplication.shared.open(url) }
        case "exportMarkdown":
            share(Data((payload["text"] as? String ?? "").utf8), filename: payload["filename"] as? String ?? "kanban.md")
        case "exportBinary":
            if let base64 = payload["base64"] as? String, let data = Data(base64Encoded: base64) {
                share(data, filename: payload["filename"] as? String ?? "kanban.xlsx")
            }
        case "exportBackupZip":
            // iOS condivide il backup JSON tramite il foglio di condivisione. Gli allegati restano nei loro provider originali.
            share(Data((payload["backupText"] as? String ?? "{}").utf8), filename: "backup-kanban.json")
        case "importExcel":
            presentPicker(types: [UTType(filenameExtension: "xlsx") ?? .data], kind: .excel)
        case "restoreBackup":
            presentPicker(types: [.json, .plainText], kind: .backup)
        case "listReminderCalendars":
            withReminderAccess { [weak self] in self?.sendReminderLists() }
        case "syncReminders":
            withReminderAccess { [weak self] in self?.syncReminders(payload) }
        default:
            break
        }
    }

    private func loadApp() {
        guard let directory = Bundle.main.resourceURL else { return }
        webView.loadFileURL(directory.appendingPathComponent("index.html"), allowingReadAccessTo: directory)
    }

    private func nativeStateScript() -> WKUserScript {
        let state = (try? Data(contentsOf: stateURL))?.base64EncodedString() ?? ""
        let auth = Keychain.read().map { Data($0.utf8).base64EncodedString() } ?? ""
        let script = """
        window.KANBAN_NATIVE_PERSISTENCE = true;
        window.KANBAN_NATIVE_PLATFORM = 'ios';
        window.KANBAN_NATIVE_STATE_BASE64 = '\(state)';
        window.KANBAN_NATIVE_STATE_PATH_BASE64 = '';
        window.KANBAN_NATIVE_APP_SUPPORT_PATH_BASE64 = '';
        window.KANBAN_SYNC_AUTH_BASE64 = '\(auth)';
        document.documentElement.dataset.nativePlatform = 'ios';
        """
        return WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    private func saveState(_ text: String) {
        do {
            try FileManager.default.createDirectory(at: supportDirectory, withIntermediateDirectories: true)
            try Data(text.utf8).write(to: stateURL, options: .atomic)
        } catch { NSLog("Kanban iOS: salvataggio non riuscito: %@", error.localizedDescription) }
    }

    private func saveSyncAuth(_ value: String) {
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        clean.isEmpty || clean == "{}" ? Keychain.delete() : Keychain.write(clean)
    }

    private func share(_ data: Data, filename: String) {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename.replacingOccurrences(of: "/", with: "-"))
        do {
            try data.write(to: url, options: .atomic)
            let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            controller.popoverPresentationController?.sourceView = view
            controller.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            present(controller, animated: true)
        } catch { showError(error.localizedDescription) }
    }

    private func presentPicker(types: [UTType], kind: ImportKind) {
        pendingImport = kind
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        picker.delegate = self
        present(picker, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first, let data = try? Data(contentsOf: url) else { return }
        switch pendingImport {
        case .excel:
            evaluate("receiveImportedExcelBase64", value: data.base64EncodedString())
        case .backup:
            evaluate("receiveRestoredBackupBase64", value: data.base64EncodedString())
        case .none: break
        }
        pendingImport = nil
    }

    private func evaluate(_ function: String, value: String) {
        guard let data = try? JSONSerialization.data(withJSONObject: value), let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.\(function) && window.\(function)(\(json))")
    }

    private func postJSON(_ function: String, _ payload: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.\(function) && window.\(function)(\(json))")
    }

    private func withReminderAccess(_ action: @escaping @MainActor @Sendable () -> Void) {
        eventStore.requestFullAccessToReminders { [weak self] granted, error in
            DispatchQueue.main.async {
                if granted { action() }
                else { self?.postJSON("receiveReminderSyncResult", ["ok": false, "message": error?.localizedDescription ?? "Permesso Promemoria non concesso."]) }
            }
        }
    }

    private func sendReminderLists() {
        let names = eventStore.calendars(for: .reminder).map(\.title).sorted()
        postJSON("receiveReminderLists", ["ok": true, "lists": names])
    }

    private func syncReminders(_ payload: [String: Any]) {
        do {
            let listName = (payload["listName"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "kanban"
            let calendar = try reminderCalendar(named: listName.isEmpty ? "kanban" : listName)
            let items = payload["reminders"] as? [[String: Any]] ?? []
            for item in items {
                guard let dateText = item["dueDate"] as? String else { continue }
                let reminder = EKReminder(eventStore: eventStore)
                reminder.calendar = calendar
                let project = item["projectName"] as? String ?? ""
                let task = item["taskName"] as? String ?? "Attività"
                reminder.title = project.isEmpty ? task : "\(project) - \(task)"
                reminder.dueDateComponents = dateComponents(dateText)
                reminder.notes = item["notes"] as? String
                try eventStore.save(reminder, commit: false)
            }
            try eventStore.commit()
            postJSON("receiveReminderSyncResult", ["ok": true, "synced": items.count, "removed": 0, "listName": listName, "syncedAt": ISO8601DateFormatter().string(from: Date())])
        } catch { postJSON("receiveReminderSyncResult", ["ok": false, "message": error.localizedDescription]) }
    }

    private func reminderCalendar(named name: String) throws -> EKCalendar {
        if let existing = eventStore.calendars(for: .reminder).first(where: { $0.title.caseInsensitiveCompare(name) == .orderedSame }) { return existing }
        let calendar = EKCalendar(for: .reminder, eventStore: eventStore)
        calendar.title = name
        calendar.source = eventStore.defaultCalendarForNewReminders()?.source ?? eventStore.sources.first
        try eventStore.saveCalendar(calendar, commit: true)
        return calendar
    }

    private func dateComponents(_ value: String) -> DateComponents? {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: value) else { return nil }
        return Calendar.current.dateComponents([.year, .month, .day], from: date)
    }

    private func showError(_ message: String) {
        let alert = UIAlertController(title: "Operazione non riuscita", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default)); present(alert, animated: true)
    }
}

private enum Keychain {
    static let service = "it.pst.gestore-attivita-kanban.sync"
    static let account = "couchdb-sync-auth"
    static func read() -> String? {
        var query: [String: Any] = base; query[kSecReturnData as String] = true; query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?; guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func write(_ value: String) {
        delete(); var query = base; query[kSecValueData as String] = Data(value.utf8); query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(query as CFDictionary, nil)
    }
    static func delete() { SecItemDelete(base as CFDictionary) }
    private static var base: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account] }
}
