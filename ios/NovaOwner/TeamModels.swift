import Foundation

struct TeamSnapshot: Decodable {
    let mission: Mission?
    let missions: [MissionSummary]
    let events: [Handoff]
    let pending_tasks: [Assignment]
    let channels: [Channel]
}

struct Mission: Decodable, Identifiable {
    let id: UUID
    let objective: String
    let focus: Focus
    let state: String
    let next_step: Int

    var readyForReview: Bool { state == "review" }
}

struct MissionSummary: Decodable, Identifiable {
    let id: UUID
    let objective: String
}

enum Focus: String, Codable, CaseIterable, Identifiable {
    case audit, agents, demand

    var id: Self { self }
    var title: String {
        switch self {
        case .audit: "Nova Audit"
        case .agents: "Nova Agents"
        case .demand: "Nova Demand"
        }
    }
}

struct Handoff: Decodable, Identifiable {
    let step: Int
    let sender: String
    let recipient: String
    let message: String
    let model_note: String?
    let receipt: WorkReceipt

    var id: Int { step }
}

struct WorkReceipt: Decodable {
    let title: String?
    let drafts: [PlatformDraft]?
    let script: String?
    let spent_cents: Int?
    let booked_appointments: Int?
    let pending_tasks: Int?
}

struct PlatformDraft: Decodable, Identifiable {
    let asset_id: UUID
    let platform: String
    let caption: String
    var id: UUID { asset_id }
}

struct Assignment: Decodable, Identifiable {
    let id: UUID
    let title: String?
    let assigned_to: String?
}

struct Channel: Decodable, Identifiable {
    let key: String
    let name: String
    let status: String
    let delivery_verified: Bool
    var id: String { key }

    var label: String {
        if delivery_verified { return "Delivery verified" }
        switch status {
        case "connection_required": return "Connection needed"
        case "dispatch_paused": return "Dispatch paused"
        default: return "Delivery unverified"
        }
    }
}

struct PracticeReceipt: Decodable {
    let transcript: [PracticeTurn]
}

struct PracticeTurn: Decodable {
    let direction: String
    let text: String
}

struct NovaAction: Encodable {
    let action: String
    var mission_id: UUID?
    var objective: String?
    var focus: Focus?
    var expected_step: Int?
    var model_note: String?
    var task_id: UUID?
    var assignee: String?
    var session_id: UUID?
    var text: String?
    var reply: String?

    enum CodingKeys: String, CodingKey {
        case action, mission_id, objective, focus, expected_step, model_note, task_id, assignee, session_id, text, reply
    }

    // Nova validates UUIDs case-insensitively. A single representation also keeps
    // the same request key across the web and iPhone clients.
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(action, forKey: .action)
        try values.encodeIfPresent(mission_id?.uuidString.lowercased(), forKey: .mission_id)
        try values.encodeIfPresent(objective, forKey: .objective)
        try values.encodeIfPresent(focus, forKey: .focus)
        try values.encodeIfPresent(expected_step, forKey: .expected_step)
        try values.encodeIfPresent(model_note, forKey: .model_note)
        try values.encodeIfPresent(task_id?.uuidString.lowercased(), forKey: .task_id)
        try values.encodeIfPresent(assignee, forKey: .assignee)
        try values.encodeIfPresent(session_id?.uuidString.lowercased(), forKey: .session_id)
        try values.encodeIfPresent(text, forKey: .text)
        try values.encodeIfPresent(reply, forKey: .reply)
    }
}

struct AssignmentReceipt: Decodable { let assigned_to: String }

struct RolePlaybook: Decodable, Identifiable {
    let key: String
    let name: String
    let goal: String
    let tool: String
    let playbook: [String]
    var id: String { key }
}

struct PlaybookDirectory: Decodable {
    let sequence: [String]
    let roles: [RolePlaybook]

    func name(for key: String) -> String {
        if key == "owner" { return "Owner" }
        return roles.first { $0.key == key }?.name ?? key
    }
}
