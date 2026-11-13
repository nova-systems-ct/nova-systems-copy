import Auth
import Foundation
import FoundationModels
import Observation

@MainActor @Observable
final class OwnerStore {
    enum Access { case checking, signedOut, owner, unavailable }

    private let api = NovaAPI()
    let directory: PlaybookDirectory
    private var startRequest: NovaAction?
    private var pauseRequested = false

    private(set) var access = Access.checking
    private(set) var snapshot: TeamSnapshot?
    private(set) var activeRole: String?
    private(set) var practiceReceipt: PracticeReceipt?
    private(set) var busy = false
    var notice: String?
    var error: String?

    init() {
        if let url = Bundle.main.url(forResource: "ExecutivePlaybooks", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let directory = try? JSONDecoder().decode(PlaybookDirectory.self, from: data) {
            self.directory = directory
        } else {
            directory = PlaybookDirectory(sequence: [], roles: [])
        }
    }

    var supportsModel: Bool {
        if #available(iOS 26.0, *) { return SystemLanguageModel.default.isAvailable }
        return false
    }

    func restore() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        error = nil
        do {
            snapshot = try await api.team()
            access = .owner
        } catch {
            await handleAccessFailure(error, signingIn: false)
        }
    }

    func signIn(email: String, password: String) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        error = nil
        do {
            try await api.auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            snapshot = try await api.team()
            access = .owner
        } catch {
            await handleAccessFailure(error, signingIn: true)
        }
    }

    func signOut() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        // The SDK removes the current device's session before contacting Supabase.
        try? await api.auth.signOut(scope: .local)
        snapshot = nil
        practiceReceipt = nil
        startRequest = nil
        notice = nil
        error = nil
        access = .signedOut
    }

    func selectMission(_ id: UUID?) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            snapshot = try await api.team(missionID: id)
        } catch {
            await handleWorkspaceFailure(error)
        }
    }

    func pause() { pauseRequested = true }

    func run(objective: String? = nil, focus: Focus = .audit, useModel: Bool) async {
        guard !busy, !directory.sequence.isEmpty else { return }
        busy = true
        pauseRequested = false
        error = nil
        notice = nil
        defer { busy = false; activeRole = nil }
        do {
            if let objective {
                let text = objective.trimmingCharacters(in: .whitespacesAndNewlines)
                if startRequest?.objective != text || startRequest?.focus != focus {
                    startRequest = NovaAction(action: "start", mission_id: UUID(), objective: text, focus: focus)
                }
                snapshot = try await api.team(startRequest)
                startRequest = nil
            }
            while let mission = snapshot?.mission,
                  directory.sequence.indices.contains(mission.next_step), !pauseRequested {
                try Task.checkCancellation()
                let role = directory.sequence[mission.next_step]
                activeRole = role
                let note = await proposal(for: role, mission: mission, enabled: useModel)
                try Task.checkCancellation()
                snapshot = try await api.team(NovaAction(
                    action: "advance", mission_id: mission.id, expected_step: mission.next_step, model_note: note
                ))
            }
            notice = snapshot?.mission?.readyForReview == true ? "Campaign saved for review." : "Paused after the last saved handoff."
        } catch {
            await handleWorkspaceFailure(error)
        }
    }

    func assign(_ task: UUID, name: String) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let result = try await api.assign(task, to: name.trimmingCharacters(in: .whitespacesAndNewlines))
            notice = "Assigned to \(result.assigned_to)."
            snapshot = try await api.team(missionID: snapshot?.mission?.id)
        } catch {
            await handleWorkspaceFailure(error)
        }
    }

    func practice(session: UUID, caller: String, reply: String) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            practiceReceipt = try await api.practice(sessionID: session, caller: caller, reply: reply)
            notice = "Saved to the practice CRM and task queue."
        } catch {
            await handleWorkspaceFailure(error)
        }
    }

    private func proposal(for key: String, mission: Mission, enabled: Bool) async -> String? {
        guard enabled, let role = directory.roles.first(where: { $0.key == key }) else { return nil }
        if #available(iOS 26.0, *), SystemLanguageModel.default.isAvailable {
            do {
                let session = LanguageModelSession(instructions: """
                You are Nova Systems' \(role.name). Your goal is: \(role.goal)
                Your tool is: \(role.tool). Your playbook is: \(role.playbook.joined(separator: " "))
                Propose one specific next action for your role in two short sentences. Use the objective and last handoff as context. Avoid promises, prices, and claims of completed work.
                """)
                let response = try await session.respond(to: """
                Campaign objective: \(mission.objective)
                Last saved handoff: \(snapshot?.events.last?.message ?? "Owner brief received")
                """, options: GenerationOptions(maximumResponseTokens: 120))
                return String(response.content.prefix(2000))
            } catch {
                self.error = "The on-device proposal was unavailable. The saved workflow can continue."
            }
        }
        return nil
    }

    private func handleAccessFailure(_ failure: Error, signingIn: Bool) async {
        snapshot = nil
        if let authError = failure as? AuthError, authError == .sessionMissing {
            access = .signedOut
            return
        }
        if let apiError = failure as? NovaAPIError, [401, 403].contains(apiError.status) {
            try? await api.auth.signOut(scope: .local)
            access = .signedOut
            error = apiError.status == 403 ? "This workspace requires a Nova owner account." : "Your session expired. Sign in again."
            return
        }
        if signingIn, let authError = failure as? AuthError, authError.errorCode == .invalidCredentials {
            access = .signedOut
            error = "Nova did not accept that email or password. Use your existing Nova account or recover it on the website."
            return
        }
        access = api.auth.currentSession == nil ? .signedOut : .unavailable
        error = "Nova could not verify workspace access. Check your connection and try again."
    }

    private func handleWorkspaceFailure(_ failure: Error) async {
        if let apiError = failure as? NovaAPIError, [401, 403].contains(apiError.status) {
            await handleAccessFailure(failure, signingIn: false)
        } else if !(failure is CancellationError) {
            error = (failure as? NovaAPIError)?.message ?? "The last action could not be confirmed. Reload your saved work."
        }
    }
}
