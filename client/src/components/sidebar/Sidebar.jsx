import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getConversations, deleteConversation } from "../../api";

const THEME_LABELS = { dark: "Dark", light: "Light", sunset: "Sunset" };
const THEME_ICONS = { dark: "🌙", light: "☀️", sunset: "🌅" };

/**
 * Sidebar with conversation list, new chat button, and user profile.
 */
export default function Sidebar({
  conversationId,
  setConversationId,
  refreshKey,
  sidebarOpen,
  setSidebarOpen,
}) {
  const [conversations, setConversations] = useState([]);
  const { user, logout } = useAuth();
  const { theme, cycleTheme } = useTheme();

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await deleteConversation(id);
      if (conversationId === id) setConversationId(null);
      loadConversations();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  function handleNewChat() {
    setConversationId(null);
    setSidebarOpen(false);
  }

  function handleSelect(id) {
    setConversationId(id);
    setSidebarOpen(false);
  }

  function groupByDate(convs) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today - 86400000);
    const weekAgo = new Date(today - 7 * 86400000);

    const groups = { Today: [], Yesterday: [], "Previous 7 Days": [], Older: [] };
    for (const c of convs) {
      const d = new Date(c.updated_at);
      if (d >= today) groups["Today"].push(c);
      else if (d >= yesterday) groups["Yesterday"].push(c);
      else if (d >= weekAgo) groups["Previous 7 Days"].push(c);
      else groups["Older"].push(c);
    }
    return groups;
  }

  const grouped = groupByDate(conversations);
  const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Older"];

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="text-2xl">✨</span>
            <h1 className="text-lg font-bold text-zinc-100">Lumi</h1>
          </div>
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-dashed border-zinc-700 hover:border-violet-500 hover:bg-zinc-800 rounded-xl text-sm font-semibold text-zinc-300 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {conversations.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-8">No conversations yet</p>
          )}

          {groupOrder.map((group) => {
            const items = grouped[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider px-2 mb-1.5">
                  {group}
                </p>
                {items.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition text-sm ${
                      conversationId === c.id
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    <span className="flex-1 truncate">{c.title}</span>
                    <button
                      onClick={(e) => handleDelete(e, c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-800 flex-shrink-0">
          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            title={`Theme: ${THEME_LABELS[theme]} (click to cycle)`}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition"
          >
            <span className="text-base">{THEME_ICONS[theme]}</span>
            <span className="flex-1 text-left">{THEME_LABELS[theme]} mode</span>
            <span className="text-xs text-zinc-600">switch</span>
          </button>

          {/* User row */}
          <div className="p-3 border-t border-zinc-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{user?.name || "User"}</p>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
            <button onClick={logout} title="Logout" className="p-2 text-zinc-500 hover:text-red-400 transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
