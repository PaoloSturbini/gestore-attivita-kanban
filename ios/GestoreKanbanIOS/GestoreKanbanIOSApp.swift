import SwiftUI

@main
struct GestoreKanbanIOSApp: App {
    var body: some Scene {
        WindowGroup {
            KanbanWebView()
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}
