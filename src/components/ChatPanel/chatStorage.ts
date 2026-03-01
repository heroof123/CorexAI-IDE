import { StoredSession } from "./types";

const SESSION_STORAGE_KEY = "corex-chat-sessions";

/**
 * Oturumları localStorage'dan yükle
 */
export function loadSessions(): StoredSession[] {
    try {
        return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "[]");
    } catch {
        return [];
    }
}

/**
 * Oturumu localStorage'a kaydet (ilk 20 oturumda sınırlı)
 */
export function saveSession(session: StoredSession) {
    const sessions = loadSessions().filter(s => s.id !== session.id);
    sessions.unshift(session);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions.slice(0, 20)));
}
