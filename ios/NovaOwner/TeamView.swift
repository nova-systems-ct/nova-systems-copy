import SwiftUI

struct TeamView: View {
    let store: OwnerStore
    @State private var objective = ""
    @State private var focus = Focus.audit
    @State private var onDevice = false
    @State private var openedRole: RolePlaybook?

    var body: some View {
        List {
            Section {
                WorkspaceMessages(store: store)
                if let mission = store.snapshot?.mission {
                    Text(mission.objective).font(.headline)
                    ProgressView(value: Double(mission.next_step), total: Double(max(1, store.directory.sequence.count))) {
                        Text(mission.readyForReview ? "Ready for review" : "\(mission.next_step) handoffs completed")
                    }
                    if let activeRole = store.activeRole {
                        Label("\(store.directory.name(for: activeRole)) is working", systemImage: "hourglass")
                        Button("Pause after this handoff", systemImage: "pause") { store.pause() }
                    } else if !mission.readyForReview {
                        Button("Resume mission", systemImage: "play.fill") { Task { await store.run(useModel: onDevice) } }
                            .disabled(store.busy)
                    }
                }
                if let missions = store.snapshot?.missions, !missions.isEmpty {
                    Menu("Open a saved mission", systemImage: "list.bullet") {
                        ForEach(missions) { item in
                            Button(item.objective) { Task { await store.selectMission(item.id) } }
                        }
                    }
                    .disabled(store.busy)
                }
            }
            Section("Executive team") {
                ForEach(store.directory.roles) { role in
                    Button { openedRole = role } label: {
                        HStack {
                            Image(systemName: roleIcon(role.key)).foregroundStyle(novaGold)
                            Text(role.name).foregroundStyle(.primary)
                            Spacer()
                            if store.activeRole == role.key { ProgressView().controlSize(.small) }
                            else if store.snapshot?.events.contains(where: { $0.sender == role.key }) == true {
                                Image(systemName: "checkmark").foregroundStyle(novaGold).accessibilityLabel("Work saved")
                            }
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            Section("New campaign") {
                TextField("What should the team prepare?", text: $objective, axis: .vertical)
                    .lineLimit(2...5)
                    .onChange(of: objective) { _, value in
                        if value.count > 1000 { objective = String(value.prefix(1000)) }
                    }
                Picker("Focus", selection: $focus) {
                    ForEach(Focus.allCases) { Text($0.title).tag($0) }
                }
                if store.supportsModel {
                    Toggle("Generate on-device proposals", isOn: $onDevice)
                    Text("Each role uses its own playbook with the device’s shared model.").font(.caption).foregroundStyle(.secondary)
                }
                Button("Start $0 mission", systemImage: "play.fill") {
                    Task {
                        await store.run(objective: objective, focus: focus, useModel: onDevice)
                        if store.snapshot?.mission?.objective == objective.trimmingCharacters(in: .whitespacesAndNewlines) { objective = "" }
                    }
                }
                .disabled(objective.trimmingCharacters(in: .whitespacesAndNewlines).count < 8)
            }
            .disabled(store.busy)
            if let events = store.snapshot?.events, !events.isEmpty {
                Section("Saved handoffs") {
                    ForEach(events) { handoff in HandoffRow(handoff: handoff, directory: store.directory) }
                }
            }
        }
        .navigationTitle("Company HQ")
        .refreshable { await store.selectMission(store.snapshot?.mission?.id) }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") {
                    Task { await store.signOut() }
                }.labelStyle(.iconOnly).disabled(store.busy)
            }
        }
        .sheet(item: $openedRole) { role in
            NavigationStack {
                List {
                    Section("Goal") { Text(role.goal) }
                    Section("Tool") { Text(role.tool) }
                    Section("Playbook") { ForEach(role.playbook, id: \.self) { Text($0) } }
                }
                .navigationTitle(role.name)
            }
            .presentationDetents([.medium, .large])
        }
    }

    private func roleIcon(_ key: String) -> String {
        switch key {
        case "ceo": "person.crop.circle"
        case "chief": "list.bullet.rectangle"
        case "coo": "gearshape.2"
        case "cmo": "megaphone"
        case "zion": "film"
        case "cfo": "wallet.bifold"
        default: "person"
        }
    }
}

private struct HandoffRow: View {
    let handoff: Handoff
    let directory: PlaybookDirectory

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(directory.name(for: handoff.sender)) → \(directory.name(for: handoff.recipient))")
                .font(.subheadline.bold()).foregroundStyle(novaGold)
            Text(handoff.message).font(.callout)
            if let note = handoff.model_note {
                DisclosureGroup("AI proposal") { Text(note).font(.callout).textSelection(.enabled) }
            }
            if let drafts = handoff.receipt.drafts {
                ForEach(drafts) { draft in
                    DisclosureGroup("\(draft.platform) draft") {
                        Text(draft.caption).font(.callout).textSelection(.enabled)
                    }
                }
            }
            if let script = handoff.receipt.script {
                DisclosureGroup("Zion’s script") { Text(script).font(.callout).textSelection(.enabled) }
            }
            if handoff.sender == "cfo", let cents = handoff.receipt.spent_cents {
                Text("Spend: \(Decimal(cents) / 100, format: .currency(code: "USD"))").font(.footnote)
            }
        }
        .padding(.vertical, 5)
    }
}
