import Auth
import Foundation

struct NovaAPIError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}

struct NovaAPI {
    static let site = URL(string: "https://nova-systems.app")!
    let auth: AuthClient

    init() {
        let publicKey = Bundle.main.object(forInfoDictionaryKey: "NovaSupabaseKey") as? String ?? ""
        auth = AuthClient(configuration: .init(
            url: URL(string: "https://xizmgruvuazmummotzkp.supabase.co/auth/v1")!,
            headers: ["apikey": publicKey, "Authorization": "Bearer \(publicKey)"],
            localStorage: KeychainLocalStorage(service: "app.nova-systems.owner"),
            autoRefreshToken: true
        ))
    }

    func team(_ action: NovaAction? = nil, missionID: UUID? = nil) async throws -> TeamSnapshot {
        try await request(operation: "team", action: action, missionID: missionID)
    }

    func assign(_ id: UUID, to name: String) async throws -> AssignmentReceipt {
        try await request(operation: "team", action: NovaAction(action: "assign", task_id: id, assignee: name))
    }

    func practice(sessionID: UUID, caller: String, reply: String) async throws -> PracticeReceipt {
        try await request(action: NovaAction(action: "voice_practice", session_id: sessionID, text: caller, reply: reply))
    }

    private func request<Result: Decodable>(operation: String? = nil, action: NovaAction? = nil, missionID: UUID? = nil) async throws -> Result {
        let accessToken = try await auth.session.accessToken
        var url = URLComponents(url: Self.site.appendingPathComponent("api/client"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "resource", value: "company")]
        if let operation { url.queryItems?.append(URLQueryItem(name: "op", value: operation)) }
        if let missionID { url.queryItems?.append(URLQueryItem(name: "mission_id", value: missionID.uuidString.lowercased())) }
        var request = URLRequest(url: url.url!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let action {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(action)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        if !(200..<300).contains(http.statusCode) {
            struct Failure: Decodable { let error: String? }
            let message = (try? JSONDecoder().decode(Failure.self, from: data))?.error
            throw NovaAPIError(status: http.statusCode, message: message ?? "Nova could not confirm this action. Try refreshing.")
        }
        return try JSONDecoder().decode(Result.self, from: data)
    }
}
