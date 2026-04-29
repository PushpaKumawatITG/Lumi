import { useState, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
import PrivateRoute from "./components/auth/PrivateRoute";
import Sidebar from "./components/sidebar/Sidebar";
import ChatWindow from "./components/chat/ChatWindow";

function ChatLayout() {
  const [conversationId, setConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshSidebar = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="h-dvh flex bg-zinc-900">
      <Sidebar
        conversationId={conversationId}
        setConversationId={setConversationId}
        refreshKey={refreshKey}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with hamburger */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 lg:hidden flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-zinc-400 hover:text-white transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-zinc-200">✨ Lumi</h1>
        </header>
        <ChatWindow
          conversationId={conversationId}
          setConversationId={setConversationId}
          refreshSidebar={refreshSidebar}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <ChatLayout />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
