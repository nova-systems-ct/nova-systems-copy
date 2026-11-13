import FoundationModels
import PassKit
import SwiftUI
import UIKit

struct TasksView: View {
    let store: OwnerStore
    @State private var selection: Assignment?
    @State private var assignee = ""

    var body: some View {
        List {
            WorkspaceMessages(store: store)
            let tasks = store.snapshot?.pending_tasks ?? []
            if tasks.isEmpty { Text("No pending assignments.").foregroundStyle(.secondary) }
            ForEach(tasks) { task in
                Button {
                    assignee = task.assigned_to ?? ""
                    selection = task
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(task.title ?? "Untitled task").foregroundStyle(.primary)
                            Text(task.assigned_to ?? "Unassigned").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "person.badge.plus").foregroundStyle(novaGold)
                    }
                }.disabled(store.busy)
            }
        }
        .navigationTitle("Tasks")
        .refreshable { await store.selectMission(store.snapshot?.mission?.id) }
        .sheet(item: $selection) { task in
            NavigationStack {
                Form {
                    Text(task.title ?? "Task")
                    TextField("Worker or staff name", text: $assignee)
                    WorkspaceMessages(store: store)
                    Button("Save assignment") {
                        Task {
                            await store.assign(task.id, name: assignee)
                            if store.error == nil { selection = nil }
                        }
                    }
                    .disabled(store.busy || !(2...80).contains(assignee.trimmingCharacters(in: .whitespacesAndNewlines).count))
                }
                .navigationTitle("Assign task")
                .toolbar { Button("Cancel") { selection = nil }.disabled(store.busy) }
            }
            .presentationDetents([.medium, .large])
        }
    }
}

struct ChannelsView: View {
    let store: OwnerStore

    var body: some View {
        List {
            Section("Business channels") {
                ForEach(store.snapshot?.channels ?? []) { channel in
                    LabeledContent(channel.name, value: channel.label)
                }
            }
            Section("Phone assistant") {
                NavigationLink("Practice with Aria") { CallPracticeView(store: store) }
                Text("Practice turns save to the test CRM and task queue.").foregroundStyle(.secondary)
            }
            Section("Workspace") {
                Link("Connections on Nova’s website", destination: NovaAPI.site.appendingPathComponent("dashboard/integrations"))
                Link("Calendar", destination: NovaAPI.site.appendingPathComponent("dashboard/calendar"))
                Link("CFO budgets", destination: NovaAPI.site.appendingPathComponent("dashboard/cfo"))
            }
        }
        .navigationTitle("Channels")
        .refreshable { await store.selectMission(store.snapshot?.mission?.id) }
    }
}

private struct CallPracticeView: View {
    let store: OwnerStore
    @State private var session = UUID()
    @State private var caller = ""
    @State private var reply = ""
    @State private var drafting = false
    @State private var draftError: String?
    @State private var turns: [PracticeTurn] = []

    var body: some View {
        Form {
            Section("Private practice") {
                TextField("Caller’s words", text: $caller, axis: .vertical).lineLimit(2...5)
                if store.supportsModel {
                    Button(drafting ? "Drafting…" : "Draft with on-device AI", systemImage: "sparkles") {
                        Task { await draftReply() }
                    }.disabled(drafting || caller.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                TextField("Reviewed assistant reply", text: $reply, axis: .vertical).lineLimit(2...5)
                if let draftError { Text(draftError).foregroundStyle(novaGold) }
                Button("Save practice turn") {
                    Task {
                        await store.practice(session: session, caller: caller, reply: reply)
                        if store.error == nil {
                            turns = store.practiceReceipt?.transcript ?? []
                            caller = ""
                            reply = ""
                        }
                    }
                }.disabled(drafting || store.busy || caller.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || caller.count > 2000 || reply.count > 2000)
                WorkspaceMessages(store: store)
            }
            if !turns.isEmpty {
                Section("Saved transcript") {
                    ForEach(Array(turns.enumerated()), id: \.offset) { item in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(item.element.direction == "inbound" ? "Caller" : "Aria · practice")
                                .font(.caption.bold()).foregroundStyle(novaGold)
                            Text(item.element.text)
                        }
                    }
                    Button("Start another practice") { session = UUID(); turns = []; caller = ""; reply = "" }
                        .disabled(store.busy || drafting)
                }
            }
        }
        .navigationTitle("Aria practice")
    }

    @MainActor private func draftReply() async {
        guard #available(iOS 26.0, *), SystemLanguageModel.default.isAvailable else { return }
        drafting = true
        draftError = nil
        defer { drafting = false }
        do {
            let model = LanguageModelSession(instructions: """
            You are Aria, Nova Systems’ AI phone assistant. Acknowledge the caller’s business problem and ask one useful question about intake or booking. Use two brief sentences. Avoid prices and promises about appointments or work.
            """)
            let result = try await model.respond(to: String(caller.prefix(2000)), options: GenerationOptions(maximumResponseTokens: 100))
            reply = String(result.content.prefix(2000))
        } catch {
            draftError = "On-device drafting was unavailable. You can enter a reply and save the practice turn."
        }
    }
}

struct WalletView: View {
    @State private var sheet: WalletSheet?
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Image("NovaEmblem").resizable().scaledToFit().frame(width: 82, height: 82).accessibilityHidden(true)
                Text("Nova Wallet setup pass").font(.largeTitle.bold())
                Text("Install the signed Nova Systems pass to check Wallet setup on your device.")
                    .foregroundStyle(.secondary)
                if PKAddPassesViewController.canAddPasses() {
                    AddPassButton(action: add).frame(width: 220, height: 48)
                } else {
                    Text("Adding passes requires a Wallet-capable iPhone.").font(.callout)
                }
                if let error { Text(error).foregroundStyle(novaGold) }
                Link("Open the Wallet page in Safari", destination: NovaAPI.site.appendingPathComponent("wallet"))
                Text("Installation test · No reward value").font(.caption).foregroundStyle(.secondary)
            }.frame(maxWidth: 500, alignment: .leading).padding(26)
        }
        .navigationTitle("Wallet")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $sheet) { pass in AddPassSheet(controller: pass.controller) }
    }

    private func add() {
        error = nil
        do {
            guard let url = Bundle.main.url(forResource: "nova-setup-test", withExtension: "pkpass"),
                  let controller = PKAddPassesViewController(pass: try PKPass(data: Data(contentsOf: url))) else {
                error = "Wallet could not open the setup pass on this device."
                return
            }
            sheet = WalletSheet(controller: controller)
        } catch {
            self.error = "Wallet could not verify the bundled pass. Try the Safari download."
        }
    }
}

private struct WalletSheet: Identifiable {
    let id = UUID()
    let controller: PKAddPassesViewController
}

private struct AddPassButton: UIViewRepresentable {
    let action: () -> Void

    func makeUIView(context: Context) -> PKAddPassButton {
        let button = PKAddPassButton(addPassButtonStyle: .blackOutline)
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return button
    }

    func updateUIView(_ button: PKAddPassButton, context: Context) {}
}

private struct AddPassSheet: UIViewControllerRepresentable {
    let controller: PKAddPassesViewController
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(close: dismiss) }

    func makeUIViewController(context: Context) -> PKAddPassesViewController {
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: PKAddPassesViewController, context: Context) {}

    final class Coordinator: NSObject, PKAddPassesViewControllerDelegate {
        let close: DismissAction
        init(close: DismissAction) { self.close = close }

        func addPassesViewControllerDidFinish(_ controller: PKAddPassesViewController) { close() }
    }
}
