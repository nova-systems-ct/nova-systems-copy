import SwiftUI

let novaGold = Color(red: 0.91, green: 0.75, blue: 0.43)
let novaBackground = Color(red: 0.05, green: 0.05, blue: 0.05)

@main
struct NovaOwnerApp: App {
    @State private var store = OwnerStore()

    var body: some Scene {
        WindowGroup {
            Group {
                switch store.access {
                case .checking:
                    ProgressView("Opening your workspace…")
                case .signedOut:
                    OwnerLogin(store: store)
                case .owner:
                    OwnerWorkspace(store: store)
                case .unavailable:
                    VStack(spacing: 16) {
                        Image(systemName: "wifi.exclamationmark").font(.title)
                        Text(store.error ?? "The Nova workspace is unavailable.")
                        Button("Try again") { Task { await store.restore() } }
                            .buttonStyle(.borderedProminent)
                        Button("Sign out") { Task { await store.signOut() } }
                    }
                    .multilineTextAlignment(.center)
                    .padding(28)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(novaBackground.ignoresSafeArea())
            .preferredColorScheme(.dark)
            .tint(novaGold)
            .task { if store.access == .checking { await store.restore() } }
        }
    }
}

private struct OwnerLogin: View {
    let store: OwnerStore
    @State private var email = ""
    @State private var password = ""
    @State private var showWallet = false
    @FocusState private var focus: Field?

    private enum Field { case email, password }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Image("NovaEmblem")
                    .resizable().scaledToFit().frame(width: 80, height: 80)
                    .accessibilityLabel("Nova Systems")
                VStack(alignment: .leading, spacing: 7) {
                    Text("Welcome back.").font(.largeTitle.bold())
                    Text("Sign in to Nova Systems.").foregroundStyle(.secondary)
                }
                TextField("Nova account email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .focused($focus, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focus = .password }
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)
                    .focused($focus, equals: .password)
                    .submitLabel(.go)
                    .onSubmit(signIn)
                if let error = store.error {
                    Label(error, systemImage: "exclamationmark.circle").font(.callout).foregroundStyle(novaGold)
                }
                Button(action: signIn) {
                    Text(store.busy ? "Signing in…" : "Sign in").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(store.busy || email.isEmpty || password.isEmpty)
                Link("Recover your Nova account", destination: NovaAPI.site.appendingPathComponent("login"))
                Button("Apple Wallet setup pass", systemImage: "wallet.bifold") { showWallet = true }
            }
            .frame(maxWidth: 390, alignment: .leading)
            .frame(maxWidth: .infinity)
            .padding(28)
            .padding(.vertical, 24)
        }
        .sheet(isPresented: $showWallet) { NavigationStack { WalletView() } }
    }

    private func signIn() {
        guard !store.busy, !email.isEmpty, !password.isEmpty else { return }
        let enteredPassword = password
        password = ""
        focus = nil
        Task { await store.signIn(email: email, password: enteredPassword) }
    }
}

private struct OwnerWorkspace: View {
    let store: OwnerStore

    var body: some View {
        TabView {
            NavigationStack { TeamView(store: store) }
                .tabItem { Label("Company HQ", systemImage: "point.3.connected.trianglepath.dotted") }
            NavigationStack { TasksView(store: store) }
                .tabItem { Label("Tasks", systemImage: "checklist") }
            NavigationStack { ChannelsView(store: store) }
                .tabItem { Label("Channels", systemImage: "phone.bubble") }
            NavigationStack { WalletView() }
                .tabItem { Label("Wallet", systemImage: "wallet.bifold") }
        }
    }
}

struct WorkspaceMessages: View {
    let store: OwnerStore

    var body: some View {
        if let error = store.error { Label(error, systemImage: "exclamationmark.circle").foregroundStyle(novaGold) }
        if let notice = store.notice { Label(notice, systemImage: "checkmark.circle").foregroundStyle(.secondary) }
    }
}
