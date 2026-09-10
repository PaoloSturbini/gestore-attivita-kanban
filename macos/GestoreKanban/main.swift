import Cocoa
import EventKit
import Security
import UniformTypeIdentifiers
import WebKit

// Credenziali di sincronizzazione CouchDB: custodite nel Keychain di macOS, mai in chiaro su disco.
private let syncKeychainService = "it.pst.gestore-attivita-kanban.sync"
private let syncKeychainAccount = "couchdb-sync-auth"

private func syncAuthKeychainRead() -> String? {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: syncKeychainService,
        kSecAttrAccount as String: syncKeychainAccount,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data else { return nil }
    return String(data: data, encoding: .utf8)
}

private func syncAuthKeychainWrite(_ value: String) {
    let data = Data(value.utf8)
    let baseQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: syncKeychainService,
        kSecAttrAccount as String: syncKeychainAccount,
    ]
    let updateStatus = SecItemUpdate(baseQuery as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if updateStatus == errSecItemNotFound {
        var addQuery = baseQuery
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(addQuery as CFDictionary, nil)
    }
}

private func syncAuthKeychainDelete() {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: syncKeychainService,
        kSecAttrAccount as String: syncKeychainAccount,
    ]
    SecItemDelete(query as CFDictionary)
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private let eventStore = EKEventStore()
    private let appSupportDirectory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("Gestore attività Kanban", isDirectory: true)
    }()
    private var stateFileURL: URL {
        appSupportDirectory.appendingPathComponent("kanban-state.json")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "exportMarkdown")
        userContentController.add(self, name: "exportBinary")
        userContentController.add(self, name: "importExcel")
        userContentController.add(self, name: "restoreBackup")
        userContentController.add(self, name: "openExternalUrl")
        userContentController.add(self, name: "selectAttachmentEditor")
        userContentController.add(self, name: "selectAttachmentDirectory")
        userContentController.add(self, name: "selectAutoBackupDirectory")
        userContentController.add(self, name: "pickTaskAttachment")
        userContentController.add(self, name: "createTaskAttachment")
        userContentController.add(self, name: "openTaskAttachment")
        userContentController.add(self, name: "trashTaskAttachment")
        userContentController.add(self, name: "exportBackupZip")
        userContentController.add(self, name: "autoBackupZip")
        userContentController.add(self, name: "verifyAttachments")
        userContentController.add(self, name: "saveAppState")
        userContentController.add(self, name: "saveSyncAuth")
        userContentController.add(self, name: "listReminderCalendars")
        userContentController.add(self, name: "syncReminders")
        userContentController.addUserScript(nativeStateUserScript())

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContentController

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Gestore attività Kanban"
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)

        loadBundledApp()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "restoreBackup" {
            openRestorePanel(message.body as? [String: Any] ?? [:])
            return
        }

        if message.name == "importExcel" {
            openExcelImportPanel()
            return
        }

        if message.name == "selectAttachmentEditor" {
            openAttachmentEditorPanel()
            return
        }

        if message.name == "selectAttachmentDirectory" {
            openAttachmentDirectoryPanel(message.body as? [String: Any] ?? [:])
            return
        }

        if message.name == "selectAutoBackupDirectory" {
            openAutoBackupDirectoryPanel(message.body as? [String: Any] ?? [:])
            return
        }

        if message.name == "pickTaskAttachment" {
            openTaskAttachmentPanel(message.body as? [String: Any] ?? [:])
            return
        }

        if message.name == "createTaskAttachment" {
            guard let payload = message.body as? [String: Any] else { return }
            createTaskAttachment(payload)
            return
        }

        if message.name == "openTaskAttachment" {
            guard let payload = message.body as? [String: Any] else { return }
            openTaskAttachment(payload)
            return
        }

        if message.name == "trashTaskAttachment" {
            trashTaskAttachment(message.body as? [String: Any] ?? [:])
            return
        }

        if message.name == "exportBackupZip" {
            guard let payload = message.body as? [String: Any],
                  let filename = payload["filename"] as? String,
                  let backupText = payload["backupText"] as? String else { return }
            exportBackupZip(
                filename: filename,
                backupText: backupText,
                directoryPath: payload["directoryPath"] as? String,
                directoryBookmark: payload["directoryBookmark"] as? String,
                files: payload["files"] as? [[String: Any]] ?? []
            )
            return
        }

        if message.name == "autoBackupZip" {
            guard let payload = message.body as? [String: Any] else { return }
            autoBackupZip(payload)
            return
        }

        if message.name == "verifyAttachments" {
            verifyAttachments(message.body as? [String: Any] ?? [:])
            return
        }

        if message.name == "openExternalUrl" {
            guard let payload = message.body as? [String: Any],
                  let urlString = payload["url"] as? String,
                  let url = URL(string: urlString) else { return }
            NSWorkspace.shared.open(url)
            return
        }

        if message.name == "saveAppState" {
            if let text = message.body as? String {
                saveState(text)
            } else if JSONSerialization.isValidJSONObject(message.body),
                      let data = try? JSONSerialization.data(withJSONObject: message.body, options: []),
                      let text = String(data: data, encoding: .utf8) {
                saveState(text)
            }
            return
        }

        if message.name == "saveSyncAuth" {
            if let text = message.body as? String {
                let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmed.isEmpty || trimmed == "{}" {
                    syncAuthKeychainDelete()
                } else {
                    syncAuthKeychainWrite(text)
                }
            }
            return
        }

        if message.name == "listReminderCalendars" {
            listReminderCalendars()
            return
        }

        if message.name == "syncReminders" {
            syncReminders(message.body as? [String: Any] ?? [:])
            return
        }

        if message.name == "exportBinary" {
            guard let payload = message.body as? [String: Any],
                  let filename = payload["filename"] as? String,
                  let base64 = payload["base64"] as? String,
                  let data = Data(base64Encoded: base64) else { return }

            let panel = NSSavePanel()
            panel.nameFieldStringValue = filename
            panel.allowedContentTypes = [UTType(filenameExtension: "xlsx") ?? .spreadsheet]
            panel.canCreateDirectories = true

            panel.beginSheetModal(for: window) { response in
                guard response == .OK, let url = panel.url else { return }
                do {
                    try data.write(to: url, options: [.atomic])
                } catch {
                    self.presentExportError(error)
                }
            }
            return
        }

        guard message.name == "exportMarkdown",
              let payload = message.body as? [String: Any],
              let filename = payload["filename"] as? String,
              let text = payload["text"] as? String else { return }

        let panel = NSSavePanel()
        panel.nameFieldStringValue = filename
        panel.allowedContentTypes = [.plainText]
        panel.canCreateDirectories = true

        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                try text.write(to: url, atomically: true, encoding: .utf8)
            } catch {
                self.presentExportError(error)
            }
        }
    }

    private func openRestorePanel(_ payload: [String: Any]) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.plainText, .json, UTType(filenameExtension: "zip")].compactMap { $0 }
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            if url.pathExtension.lowercased() == "zip" {
                self.openBackupZip(url, attachmentDirectoryPath: payload["attachmentDirectoryPath"] as? String)
                return
            }
            do {
                let text = try String(contentsOf: url, encoding: .utf8)
                let data = Data(text.utf8)
                let base64 = data.base64EncodedString()
                let script = "window.loadBackupFromNative && window.loadBackupFromNative('\(base64)')"
                self.webView.evaluateJavaScript(script)
            } catch {
                self.presentExportError(error)
            }
        }
    }

    private func openExcelImportPanel() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [UTType(filenameExtension: "xlsx") ?? .spreadsheet]
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                let data = try Data(contentsOf: url)
                let base64 = data.base64EncodedString()
                let filename = url.lastPathComponent
                    .replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "'", with: "\\'")
                let script = "window.loadExcelFromNative && window.loadExcelFromNative('\(base64)', '\(filename)')"
                self.webView.evaluateJavaScript(script)
            } catch {
                self.presentExportError(error)
            }
        }
    }

    private func openAttachmentEditorPanel() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.applicationBundle]
        panel.directoryURL = URL(fileURLWithPath: "/Applications", isDirectory: true)
        panel.prompt = "Scegli editor"

        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            self.postJSON(
                functionName: "receiveAttachmentEditor",
                payload: [
                    "name": url.deletingPathExtension().lastPathComponent,
                    "path": url.path,
                ]
            )
        }
    }

    private func openAttachmentDirectoryPanel(_ payload: [String: Any]) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Usa cartella"
        if let path = payload["attachmentDirectoryPath"] as? String, !path.isEmpty {
            panel.directoryURL = URL(fileURLWithPath: path, isDirectory: true)
        }

        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
                self.postJSON(
                    functionName: "receiveAttachmentDirectory",
                    payload: [
                        "name": url.lastPathComponent,
                        "path": url.path,
                    ]
                )
            } catch {
                self.presentExportError(error)
            }
        }
    }

    private func openAutoBackupDirectoryPanel(_ payload: [String: Any]) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Usa cartella"
        if let path = payload["autoBackupDirectoryPath"] as? String, !path.isEmpty {
            panel.directoryURL = URL(fileURLWithPath: path, isDirectory: true)
        }

        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
                let bookmark = (try? url.bookmarkData(options: [.withSecurityScope], includingResourceValuesForKeys: nil, relativeTo: nil).base64EncodedString()) ?? ""
                self.postJSON(
                    functionName: "receiveAutoBackupDirectory",
                    payload: [
                        "name": url.lastPathComponent,
                        "path": url.path,
                        "bookmark": bookmark,
                    ]
                )
            } catch {
                self.presentExportError(error)
            }
        }
    }

    private func openTaskAttachmentPanel(_ payload: [String: Any]) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = attachmentContentTypes()
        panel.prompt = "Allega"

        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                let storedURL = try self.storeAttachmentIfNeeded(url, directoryPath: payload["attachmentDirectoryPath"] as? String)
                self.postJSON(functionName: "receiveTaskAttachment", payload: self.attachmentPayload(for: storedURL))
            } catch {
                self.presentExportError(error)
            }
        }
    }

    private func createTaskAttachment(_ payload: [String: Any]) {
        let suggestedName = sanitizedAttachmentFilename(payload["suggestedName"] as? String)
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedName
        panel.allowedContentTypes = attachmentContentTypes()
        panel.canCreateDirectories = true
        panel.prompt = "Crea"
        if let directoryURL = attachmentDirectoryURL(payload["attachmentDirectoryPath"] as? String) {
            try? FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
            panel.directoryURL = directoryURL
        }

        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                if !FileManager.default.fileExists(atPath: url.path) {
                    try Data().write(to: url, options: [.atomic])
                }
                self.postJSON(functionName: "receiveTaskAttachment", payload: self.attachmentPayload(for: url))
                self.openFile(url, editorPath: payload["editorPath"] as? String)
            } catch {
                self.presentExportError(error)
            }
        }
    }

    private func openTaskAttachment(_ payload: [String: Any]) {
        guard let path = payload["path"] as? String, !path.isEmpty else {
            sendAttachmentError("Percorso allegato non valido.")
            return
        }
        let url = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: url.path) else {
            sendAttachmentError("Il file allegato non esiste piu sul disco.")
            return
        }
        openFile(url, editorPath: payload["editorPath"] as? String)
    }

    private func trashTaskAttachment(_ payload: [String: Any]) {
        let id = payload["id"] as? String ?? ""
        guard let path = payload["path"] as? String, !path.isEmpty else {
            postJSON(functionName: "receiveTaskAttachmentTrashResult", payload: [
                "id": id,
                "ok": false,
                "message": "Percorso allegato non valido.",
            ])
            return
        }
        let url = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: url.path) else {
            postJSON(functionName: "receiveTaskAttachmentTrashResult", payload: [
                "id": id,
                "ok": false,
                "message": "Il file allegato non esiste piu sul disco.",
            ])
            return
        }
        do {
            var trashedURL: NSURL?
            try FileManager.default.trashItem(at: url, resultingItemURL: &trashedURL)
            postJSON(functionName: "receiveTaskAttachmentTrashResult", payload: [
                "id": id,
                "ok": true,
                "trashedPath": trashedURL?.path ?? "",
            ])
        } catch {
            postJSON(functionName: "receiveTaskAttachmentTrashResult", payload: [
                "id": id,
                "ok": false,
                "message": error.localizedDescription,
            ])
        }
    }

    private func storeAttachmentIfNeeded(_ sourceURL: URL, directoryPath: String?) throws -> URL {
        guard let directoryURL = attachmentDirectoryURL(directoryPath) else { return sourceURL }
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        if sourceURL.deletingLastPathComponent().standardizedFileURL.path == directoryURL.standardizedFileURL.path {
            return sourceURL
        }
        let destinationURL = uniqueFileURL(in: directoryURL, preferredName: sourceURL.lastPathComponent)
        try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
        return destinationURL
    }

    private func attachmentDirectoryURL(_ path: String?) -> URL? {
        guard let path = path?.trimmingCharacters(in: .whitespacesAndNewlines), !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func uniqueFileURL(in directoryURL: URL, preferredName: String) -> URL {
        let cleanName = sanitizedFilename(preferredName.isEmpty ? "allegato.md" : preferredName)
        let baseURL = directoryURL.appendingPathComponent(cleanName, isDirectory: false)
        if !FileManager.default.fileExists(atPath: baseURL.path) {
            return baseURL
        }

        let ext = baseURL.pathExtension
        let stem = baseURL.deletingPathExtension().lastPathComponent
        var counter = 2
        while true {
            let name = ext.isEmpty ? "\(stem)-\(counter)" : "\(stem)-\(counter).\(ext)"
            let candidate = directoryURL.appendingPathComponent(name, isDirectory: false)
            if !FileManager.default.fileExists(atPath: candidate.path) {
                return candidate
            }
            counter += 1
        }
    }

    private func sanitizedFilename(_ value: String) -> String {
        let forbidden = CharacterSet(charactersIn: "/\\?%*|\"<>:")
        let pieces = value.components(separatedBy: forbidden).joined(separator: "-")
        let clean = pieces.trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? "allegato.md" : clean
    }

    private func openFile(_ fileURL: URL, editorPath: String?) {
        if let editorPath, !editorPath.isEmpty {
            let appURL = URL(fileURLWithPath: editorPath)
            if FileManager.default.fileExists(atPath: appURL.path) {
                let configuration = NSWorkspace.OpenConfiguration()
                NSWorkspace.shared.open([fileURL], withApplicationAt: appURL, configuration: configuration) { _, error in
                    if let error {
                        DispatchQueue.main.async {
                            self.sendAttachmentError("Non riesco ad aprire l'allegato con l'editor scelto: \(error.localizedDescription)")
                        }
                    }
                }
                return
            }
        }

        if !NSWorkspace.shared.open(fileURL) {
            sendAttachmentError("Non riesco ad aprire questo allegato.")
        }
    }

    private func attachmentContentTypes() -> [UTType] {
        [
            UTType(filenameExtension: "md"),
            UTType(filenameExtension: "markdown"),
            .plainText,
        ].compactMap { $0 }
    }

    private func sanitizedAttachmentFilename(_ filename: String?) -> String {
        let raw = (filename ?? "nuovo-allegato.md").trimmingCharacters(in: .whitespacesAndNewlines)
        let clean = raw.isEmpty ? "nuovo-allegato.md" : raw
        if clean.lowercased().hasSuffix(".md") || clean.lowercased().hasSuffix(".markdown") || clean.lowercased().hasSuffix(".txt") {
            return clean
        }
        return "\(clean).md"
    }

    private func attachmentPayload(for url: URL) -> [String: Any] {
        [
            "name": url.lastPathComponent,
            "path": url.path,
            "kind": attachmentKind(for: url),
        ]
    }

    private func attachmentKind(for url: URL) -> String {
        let ext = url.pathExtension.lowercased()
        if ext == "md" || ext == "markdown" {
            return "markdown"
        }
        if ext == "txt" || ext == "text" {
            return "text"
        }
        return "file"
    }

    private func requestReminderAccess(_ completion: @escaping (Bool, String?) -> Void) {
        if #available(macOS 14.0, *) {
            eventStore.requestFullAccessToReminders { granted, error in
                completion(granted, error?.localizedDescription)
            }
        } else {
            eventStore.requestAccess(to: .reminder) { granted, error in
                completion(granted, error?.localizedDescription)
            }
        }
    }

    private func listReminderCalendars() {
        requestReminderAccess { granted, errorMessage in
            DispatchQueue.main.async {
                guard granted else {
                    self.postJSON(functionName: "receiveReminderLists", payload: [
                        "ok": false,
                        "message": errorMessage ?? "Permesso Promemoria non concesso.",
                    ])
                    return
                }
                let names = self.eventStore.calendars(for: .reminder)
                    .map { $0.title }
                    .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
                self.postJSON(functionName: "receiveReminderLists", payload: ["ok": true, "lists": names])
            }
        }
    }

    private func syncReminders(_ payload: [String: Any]) {
        requestReminderAccess { granted, errorMessage in
            DispatchQueue.main.async {
                guard granted else {
                    self.postJSON(functionName: "receiveReminderSyncResult", payload: [
                        "ok": false,
                        "message": errorMessage ?? "Permesso Promemoria non concesso.",
                    ])
                    return
                }
                do {
                    try self.syncRemindersAfterAccess(payload)
                } catch {
                    self.postJSON(functionName: "receiveReminderSyncResult", payload: [
                        "ok": false,
                        "message": error.localizedDescription,
                    ])
                }
            }
        }
    }

    private func syncRemindersAfterAccess(_ payload: [String: Any]) throws {
        let listName = cleanReminderListName(payload["listName"] as? String)
        let workspaceId = cleanReminderMarkerValue(payload["workspaceId"] as? String ?? "workspace-default")
        let workspaceName = String(payload["workspaceName"] as? String ?? "default")
        let calendar = try reminderCalendar(named: listName)
        let reminderItems = payload["reminders"] as? [[String: Any]] ?? []
        let incomingKeys = Set(reminderItems.compactMap { $0["key"] as? String }.map(cleanReminderMarkerValue))
        let existing = fetchExistingReminders(in: calendar)
        var existingByKey: [String: EKReminder] = [:]
        var stale: [EKReminder] = []

        for reminder in existing {
            guard let notes = reminder.notes, notes.contains("KANBAN_REMINDER"), notes.contains("workspaceId:\(workspaceId)") else { continue }
            if let key = reminderMarkerValue("taskKey", in: notes) {
                if incomingKeys.contains(key) {
                    existingByKey[key] = reminder
                } else {
                    stale.append(reminder)
                }
            }
        }

        var synced = 0
        for item in reminderItems {
            guard let rawKey = item["key"] as? String else { continue }
            let key = cleanReminderMarkerValue(rawKey)
            guard let dueComponents = reminderDueDateComponents(item["dueDate"] as? String) else { continue }
            let projectName = String(item["projectName"] as? String ?? "")
            let taskTitle = String(item["taskName"] as? String ?? item["title"] as? String ?? "Attività senza nome")
            let reminder = existingByKey[key] ?? EKReminder(eventStore: eventStore)
            reminder.calendar = calendar
            reminder.title = projectName.isEmpty ? taskTitle : "\(projectName) - \(taskTitle)"
            reminder.dueDateComponents = dueComponents
            reminder.isCompleted = false
            reminder.notes = reminderNotes(item: item, workspaceId: workspaceId, workspaceName: workspaceName, taskKey: key)
            try eventStore.save(reminder, commit: false)
            synced += 1
        }

        for reminder in stale {
            try eventStore.remove(reminder, commit: false)
        }

        try eventStore.commit()
        postJSON(functionName: "receiveReminderSyncResult", payload: [
            "ok": true,
            "synced": synced,
            "removed": stale.count,
            "listName": listName,
            "syncedAt": ISO8601DateFormatter().string(from: Date()),
        ])
    }

    private func reminderCalendar(named name: String) throws -> EKCalendar {
        if let calendar = eventStore.calendars(for: .reminder).first(where: { $0.title.caseInsensitiveCompare(name) == .orderedSame }) {
            return calendar
        }
        let calendar = EKCalendar(for: .reminder, eventStore: eventStore)
        calendar.title = name
        if let source = eventStore.defaultCalendarForNewReminders()?.source {
            calendar.source = source
        } else if let source = eventStore.sources.first(where: { $0.sourceType == .calDAV || $0.sourceType == .local }) {
            calendar.source = source
        } else if let source = eventStore.sources.first {
            calendar.source = source
        }
        try eventStore.saveCalendar(calendar, commit: true)
        return calendar
    }

    private func fetchExistingReminders(in calendar: EKCalendar) -> [EKReminder] {
        let semaphore = DispatchSemaphore(value: 0)
        var reminders: [EKReminder] = []
        let predicate = eventStore.predicateForReminders(in: [calendar])
        eventStore.fetchReminders(matching: predicate) { result in
            reminders = result ?? []
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 10)
        return reminders
    }

    private func reminderDueDateComponents(_ value: String?) -> DateComponents? {
        guard let value = value, !value.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: value) else { return nil }
        return Calendar.current.dateComponents([.year, .month, .day], from: date)
    }

    private func reminderNotes(item: [String: Any], workspaceId: String, workspaceName: String, taskKey: String) -> String {
        let projectName = String(item["projectName"] as? String ?? "")
        let taskTitle = String(item["taskName"] as? String ?? item["title"] as? String ?? "Attività senza nome")
        let notes = String(item["notes"] as? String ?? "")
        let lines = [
            projectName.isEmpty ? "" : "Nome progetto: \(projectName)",
            "Nome attività: \(taskTitle)",
            notes.isEmpty ? "" : "Nota: \(notes)",
            "",
            "KANBAN_REMINDER",
            "workspaceId:\(workspaceId)",
            "taskKey:\(taskKey)",
            "Spazio: \(workspaceName)",
        ]
        return lines.filter { !$0.isEmpty }.joined(separator: "\n")
    }

    private func reminderMarkerValue(_ key: String, in notes: String) -> String? {
        let prefix = "\(key):"
        return notes
            .components(separatedBy: .newlines)
            .first { $0.hasPrefix(prefix) }
            .map { cleanReminderMarkerValue(String($0.dropFirst(prefix.count))) }
    }

    private func cleanReminderListName(_ value: String?) -> String {
        let cleaned = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "kanban" : cleaned
    }

    private func cleanReminderMarkerValue(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "\r", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func postJSON(functionName: String, payload: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.\(functionName) && window.\(functionName)(\(json))")
    }

    private func sendAttachmentError(_ message: String) {
        postJSON(functionName: "reportNativeAttachmentError", payload: ["message": message])
    }

    private func exportBackupZip(filename: String, backupText: String, directoryPath: String?, directoryBookmark: String?, files: [[String: Any]]) {
        let cleanFilename = sanitizedFilename(filename.isEmpty ? "backup-spazi-kanban.zip" : filename)
        let finalFilename = cleanFilename.lowercased().hasSuffix(".zip") ? cleanFilename : "\(cleanFilename).zip"

        if let directoryPath,
           !directoryPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            do {
                let scopedDirectory = try resolvedDirectoryURL(path: directoryPath, bookmarkBase64: directoryBookmark)
                defer { scopedDirectory.stopAccessing() }
                let destinationURL = scopedDirectory.url.appendingPathComponent(finalFilename, isDirectory: false)
                let missing = try createBackupZip(backupText: backupText, files: files, destinationURL: destinationURL)
                if !missing.isEmpty {
                    presentWarning("Backup creato", informativeText: "\(missing.count) allegati non sono stati trovati sul disco e non sono stati inclusi nello zip.")
                }
            } catch {
                openBackupSavePanel(filename: finalFilename, backupText: backupText, files: files, directoryURL: URL(fileURLWithPath: directoryPath, isDirectory: true))
            }
            return
        }

        openBackupSavePanel(filename: finalFilename, backupText: backupText, files: files, directoryURL: nil)
    }

    private func openBackupSavePanel(filename: String, backupText: String, files: [[String: Any]], directoryURL: URL?) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = filename
        panel.allowedContentTypes = [UTType(filenameExtension: "zip")].compactMap { $0 }
        panel.canCreateDirectories = true
        panel.directoryURL = directoryURL

        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                let didStartAccessing = url.startAccessingSecurityScopedResource()
                defer {
                    if didStartAccessing {
                        url.stopAccessingSecurityScopedResource()
                    }
                }
                let missing = try self.createBackupZip(backupText: backupText, files: files, destinationURL: url)
                if !missing.isEmpty {
                    self.presentWarning("Backup creato", informativeText: "\(missing.count) allegati non sono stati trovati sul disco e non sono stati inclusi nello zip.")
                }
            } catch {
                self.presentExportError(error)
            }
        }
    }

    private func resolvedDirectoryURL(path: String, bookmarkBase64: String?) throws -> (url: URL, stopAccessing: () -> Void) {
        if let bookmarkBase64,
           let bookmarkData = Data(base64Encoded: bookmarkBase64),
           !bookmarkData.isEmpty {
            var isStale = false
            let url = try URL(
                resolvingBookmarkData: bookmarkData,
                options: [.withSecurityScope],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            )
            let didStartAccessing = url.startAccessingSecurityScopedResource()
            return (url, {
                if didStartAccessing {
                    url.stopAccessingSecurityScopedResource()
                }
            })
        }
        return (URL(fileURLWithPath: path, isDirectory: true), {})
    }

    private func createBackupZip(backupText: String, files: [[String: Any]], destinationURL: URL) throws -> [String] {
        let tempRoot = FileManager.default.temporaryDirectory.appendingPathComponent("KanbanBackup-\(UUID().uuidString)", isDirectory: true)
        let tempZip = FileManager.default.temporaryDirectory.appendingPathComponent("KanbanBackup-\(UUID().uuidString).zip", isDirectory: false)
        try FileManager.default.createDirectory(at: destinationURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: tempRoot, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: tempRoot)
            try? FileManager.default.removeItem(at: tempZip)
        }

        try backupText.write(to: tempRoot.appendingPathComponent("backup.json"), atomically: true, encoding: .utf8)
        let missing = try copyBackupAttachments(files, into: tempRoot)
        try runDitto(arguments: ["-c", "-k", "--norsrc", tempRoot.path, tempZip.path])
        if FileManager.default.fileExists(atPath: destinationURL.path) {
            try FileManager.default.removeItem(at: destinationURL)
        }
        try FileManager.default.copyItem(at: tempZip, to: destinationURL)
        return missing
    }

    private func autoBackupZip(_ payload: [String: Any]) {
        guard let directoryPath = payload["directoryPath"] as? String,
              let filename = payload["filename"] as? String,
              let backupText = payload["backupText"] as? String,
              !directoryPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            postJSON(functionName: "receiveAutoBackupResult", payload: [
                "ok": false,
                "message": "Cartella backup automatico non valida.",
            ])
            return
        }

        let cleanFilename = sanitizedFilename(filename.isEmpty ? "backup-automatico-kanban.zip" : filename)
        let finalFilename = cleanFilename.lowercased().hasSuffix(".zip") ? cleanFilename : "\(cleanFilename).zip"
        let tempRoot = FileManager.default.temporaryDirectory.appendingPathComponent("KanbanAutoBackup-\(UUID().uuidString)", isDirectory: true)

        do {
            let scopedDirectory = try resolvedDirectoryURL(path: directoryPath, bookmarkBase64: payload["directoryBookmark"] as? String)
            defer { scopedDirectory.stopAccessing() }
            let directoryURL = scopedDirectory.url
            let destinationURL = directoryURL.appendingPathComponent(finalFilename, isDirectory: false)
            try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
            try FileManager.default.createDirectory(at: tempRoot, withIntermediateDirectories: true)
            defer { try? FileManager.default.removeItem(at: tempRoot) }

            try backupText.write(to: tempRoot.appendingPathComponent("backup.json"), atomically: true, encoding: .utf8)
            let missing = try self.copyBackupAttachments(payload["files"] as? [[String: Any]] ?? [], into: tempRoot)
            if FileManager.default.fileExists(atPath: destinationURL.path) {
                try FileManager.default.removeItem(at: destinationURL)
            }
            try self.runDitto(arguments: ["-c", "-k", "--norsrc", tempRoot.path, destinationURL.path])
            postJSON(functionName: "receiveAutoBackupResult", payload: [
                "ok": true,
                "path": destinationURL.path,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
                "missingCount": missing.count,
            ])
        } catch {
            postJSON(functionName: "receiveAutoBackupResult", payload: [
                "ok": false,
                "message": error.localizedDescription,
            ])
        }
    }

    private func verifyAttachments(_ payload: [String: Any]) {
        let attachments = payload["attachments"] as? [[String: Any]] ?? []
        let missing = attachments.compactMap { item -> [String: Any]? in
            let path = (item["path"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard path.isEmpty || !FileManager.default.fileExists(atPath: path) else { return nil }
            return [
                "id": item["id"] as? String ?? "",
                "name": item["name"] as? String ?? "",
                "path": path,
                "workspaceName": item["workspaceName"] as? String ?? "",
                "projectName": item["projectName"] as? String ?? "",
                "taskName": item["taskName"] as? String ?? "",
            ]
        }
        postJSON(functionName: "receiveAttachmentVerification", payload: [
            "checkedAt": ISO8601DateFormatter().string(from: Date()),
            "total": attachments.count,
            "missing": missing,
        ])
    }

    private func copyBackupAttachments(_ files: [[String: Any]], into tempRoot: URL) throws -> [String] {
        var missing: [String] = []
        for file in files {
            guard let sourcePath = file["sourcePath"] as? String,
                  let zipPath = file["zipPath"] as? String,
                  !sourcePath.isEmpty,
                  !zipPath.isEmpty else { continue }
            let sourceURL = URL(fileURLWithPath: sourcePath)
            guard FileManager.default.fileExists(atPath: sourceURL.path) else {
                missing.append(sourcePath)
                continue
            }
            let cleanPath = cleanRelativePath(zipPath)
            let destinationURL = tempRoot.appendingPathComponent(cleanPath, isDirectory: false)
            try FileManager.default.createDirectory(at: destinationURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: destinationURL.path) {
                try FileManager.default.removeItem(at: destinationURL)
            }
            try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
        }
        return missing
    }

    private func openBackupZip(_ url: URL, attachmentDirectoryPath: String?) {
        let extractRoot = FileManager.default.temporaryDirectory.appendingPathComponent("KanbanRestore-\(UUID().uuidString)", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: extractRoot, withIntermediateDirectories: true)
            defer { try? FileManager.default.removeItem(at: extractRoot) }

            try runDitto(arguments: ["-x", "-k", url.path, extractRoot.path])
            guard let backupURL = findBackupJson(in: extractRoot) else {
                throw AppError.invalidBackupArchive
            }

            let data = try Data(contentsOf: backupURL)
            guard var backup = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
                throw AppError.invalidBackupArchive
            }

            let destinationRoot = restoreAttachmentRoot(attachmentDirectoryPath)
            let restoredAttachments = try rewriteRestoredAttachmentPaths(in: &backup, extractedRoot: extractRoot, destinationRoot: destinationRoot)
            if restoredAttachments {
                rewriteAttachmentDirectoryConfig(in: &backup, destinationRoot: destinationRoot)
            }
            let rewrittenData = try JSONSerialization.data(withJSONObject: backup, options: [.prettyPrinted, .sortedKeys])
            let base64 = rewrittenData.base64EncodedString()
            let script = "window.loadBackupFromNative && window.loadBackupFromNative('\(base64)')"
            webView.evaluateJavaScript(script)
        } catch {
            presentExportError(error)
        }
    }

    private func rewriteRestoredAttachmentPaths(in backup: inout [String: Any], extractedRoot: URL, destinationRoot: URL) throws -> Bool {
        guard var workspaces = backup["workspaces"] as? [[String: Any]] else { return false }
        var restoredAnyAttachment = false
        for workspaceIndex in workspaces.indices {
            var workspace = workspaces[workspaceIndex]
            guard var projects = workspace["projects"] as? [[String: Any]] else { continue }
            for projectIndex in projects.indices {
                var project = projects[projectIndex]
                guard var tasks = project["tasks"] as? [[String: Any]] else { continue }
                for taskIndex in tasks.indices {
                    var task = tasks[taskIndex]
                    guard var attachments = task["attachments"] as? [[String: Any]] else { continue }
                    for attachmentIndex in attachments.indices {
                        var attachment = attachments[attachmentIndex]
                        guard let backupPath = attachment["backupPath"] as? String, !backupPath.isEmpty else { continue }
                        if let restoredURL = try copyRestoredAttachment(backupPath: backupPath, extractedRoot: extractedRoot, destinationRoot: destinationRoot) {
                            attachment["path"] = restoredURL.path
                            attachment["name"] = restoredURL.lastPathComponent
                            restoredAnyAttachment = true
                        }
                        attachments[attachmentIndex] = attachment
                    }
                    task["attachments"] = attachments
                    tasks[taskIndex] = task
                }
                project["tasks"] = tasks
                projects[projectIndex] = project
            }
            workspace["projects"] = projects
            workspaces[workspaceIndex] = workspace
        }
        backup["workspaces"] = workspaces
        return restoredAnyAttachment
    }

    private func rewriteAttachmentDirectoryConfig(in backup: inout [String: Any], destinationRoot: URL) {
        let directoryName = destinationRoot.lastPathComponent
        if var configuration = backup["configuration"] as? [String: Any] {
            configuration["attachmentDirectoryName"] = directoryName
            configuration["attachmentDirectoryPath"] = destinationRoot.path
            backup["configuration"] = configuration
        }

        guard var workspaces = backup["workspaces"] as? [[String: Any]] else { return }
        for index in workspaces.indices {
            var workspace = workspaces[index]
            var ui = workspace["ui"] as? [String: Any] ?? [:]
            ui["attachmentDirectoryName"] = directoryName
            ui["attachmentDirectoryPath"] = destinationRoot.path
            workspace["ui"] = ui
            workspaces[index] = workspace
        }
        backup["workspaces"] = workspaces
    }

    private func copyRestoredAttachment(backupPath: String, extractedRoot: URL, destinationRoot: URL) throws -> URL? {
        let cleanPath = cleanRelativePath(backupPath)
        let sourceURL = extractedRoot.appendingPathComponent(cleanPath, isDirectory: false)
        guard FileManager.default.fileExists(atPath: sourceURL.path) else { return nil }
        let destinationURL = destinationRoot.appendingPathComponent(cleanPath, isDirectory: false)
        let finalURL = uniqueFileURL(in: destinationURL.deletingLastPathComponent(), preferredName: destinationURL.lastPathComponent)
        try FileManager.default.createDirectory(at: finalURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: sourceURL, to: finalURL)
        return finalURL
    }

    private func restoreAttachmentRoot(_ configuredPath: String?) -> URL {
        if let configuredURL = attachmentDirectoryURL(configuredPath) {
            return configuredURL
        }
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        return appSupportDirectory.appendingPathComponent("Restored Attachments", isDirectory: true).appendingPathComponent(stamp, isDirectory: true)
    }

    private func findBackupJson(in root: URL) -> URL? {
        let directURL = root.appendingPathComponent("backup.json", isDirectory: false)
        if FileManager.default.fileExists(atPath: directURL.path) {
            return directURL
        }
        guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else { return nil }
        for case let url as URL in enumerator where url.lastPathComponent == "backup.json" {
            return url
        }
        return nil
    }

    private func cleanRelativePath(_ value: String) -> String {
        let components = value
            .split(separator: "/")
            .map(String.init)
            .filter { !$0.isEmpty && $0 != "." && $0 != ".." }
            .map(sanitizedFilename)
        return components.isEmpty ? "attachments/allegato.md" : components.joined(separator: "/")
    }

    private func runDitto(arguments: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/ditto")
        process.arguments = arguments
        let errorPipe = Pipe()
        process.standardError = errorPipe
        try process.run()
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            let data = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let message = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
            throw AppError.processFailed(message?.isEmpty == false ? message! : "ditto non ha completato l'operazione")
        }
    }

    private func presentWarning(_ message: String, informativeText: String) {
        let alert = NSAlert()
        alert.messageText = message
        alert.informativeText = informativeText
        alert.alertStyle = .warning
        alert.runModal()
    }

    private func loadBundledApp() {
        guard let resourceURL = Bundle.main.resourceURL else {
            presentExportError(AppError.missingResources)
            return
        }

        let webDirectory = resourceURL.appendingPathComponent("Web", isDirectory: true)
        let indexURL = webDirectory.appendingPathComponent("index.html")
        webView.loadFileURL(indexURL, allowingReadAccessTo: webDirectory)
    }

    private func nativeStateUserScript() -> WKUserScript {
        let base64: String
        if let data = try? Data(contentsOf: stateFileURL) {
            base64 = data.base64EncodedString()
        } else {
            base64 = ""
        }
        let statePathBase64 = Data(stateFileURL.path.utf8).base64EncodedString()
        let appSupportPathBase64 = Data(appSupportDirectory.path.utf8).base64EncodedString()
        let syncAuthBase64: String
        if let raw = syncAuthKeychainRead() {
            syncAuthBase64 = Data(raw.utf8).base64EncodedString()
        } else {
            syncAuthBase64 = ""
        }
        let script = """
        window.KANBAN_NATIVE_PERSISTENCE = true;
        window.KANBAN_NATIVE_STATE_BASE64 = '\(base64)';
        window.KANBAN_NATIVE_STATE_PATH_BASE64 = '\(statePathBase64)';
        window.KANBAN_NATIVE_APP_SUPPORT_PATH_BASE64 = '\(appSupportPathBase64)';
        window.KANBAN_SYNC_AUTH_BASE64 = '\(syncAuthBase64)';
        """
        return WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    // Rete di sicurezza: se sta per arrivare uno stato SENZA progetti ma il file salvato
    // ne contiene, conserva una copia dei dati prima di sovrascrivere. Così un eventuale
    // salvataggio "vuoto" non distrugge mai definitivamente i dati dell'utente.
    private func backupBeforeEmptyOverwrite(_ newText: String) {
        guard !stateHasProjects(newText),
              let existing = try? String(contentsOf: stateFileURL, encoding: .utf8),
              stateHasProjects(existing) else { return }
        let backupURL = appSupportDirectory.appendingPathComponent("kanban-state.autobackup.json")
        try? Data(existing.utf8).write(to: backupURL, options: [.atomic])
        NSLog("Kanban: stato vuoto in arrivo, backup dei dati esistenti in kanban-state.autobackup.json")
    }

    private func stateHasProjects(_ text: String) -> Bool {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
        if let projects = obj["projects"] as? [Any], !projects.isEmpty { return true }
        if let workspaces = obj["workspaces"] as? [[String: Any]] {
            for workspace in workspaces {
                if let projects = workspace["projects"] as? [Any], !projects.isEmpty { return true }
            }
        }
        return false
    }

    private func saveState(_ text: String) {
        backupBeforeEmptyOverwrite(text)
        do {
            try FileManager.default.createDirectory(at: appSupportDirectory, withIntermediateDirectories: true)
            let data = Data(text.utf8)
            let temporaryURL = appSupportDirectory.appendingPathComponent("kanban-state.json.tmp")
            try data.write(to: temporaryURL, options: [.atomic])
            if FileManager.default.fileExists(atPath: stateFileURL.path) {
                _ = try FileManager.default.replaceItemAt(stateFileURL, withItemAt: temporaryURL)
            } else {
                try FileManager.default.moveItem(at: temporaryURL, to: stateFileURL)
            }
        } catch {
            NSLog("Errore salvataggio stato Kanban: \(error.localizedDescription)")
        }
    }

    private func presentExportError(_ error: Error) {
        let alert = NSAlert(error: error)
        alert.messageText = "Operazione non riuscita"
        alert.runModal()
    }
}

enum AppError: LocalizedError {
    case missingResources
    case invalidBackupArchive
    case processFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingResources:
            return "Le risorse dell'app non sono state trovate nel bundle."
        case .invalidBackupArchive:
            return "Il backup .zip non contiene un file backup.json valido."
        case .processFailed(let message):
            return message
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
