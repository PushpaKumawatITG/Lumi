// All API requests use the Vite proxy (/api → http://localhost:5000)
// credentials: 'include' sends the session cookie automatically

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res;
}

// ---- Auth ----
export const me = () => request("/api/auth/me").then((r) => r.json());

export const registerUser = (email, password, name) =>
  request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  }).then((r) => r.json());

export const loginUser = (email, password) =>
  request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());

export const logoutUser = () =>
  request("/api/auth/logout", { method: "POST" }).then((r) => r.json());

// ---- Conversations ----
export const createConversation = () =>
  request("/api/conversation/new", { method: "POST" }).then((r) => r.json());

export const getConversations = () =>
  request("/api/conversation/list").then((r) => r.json());

export const deleteConversation = (id) =>
  request(`/api/conversation/${id}`, { method: "DELETE" }).then((r) => r.json());

export const renameConversation = (id, title) =>
  request(`/api/conversation/${id}/rename`, {
    method: "POST",
    body: JSON.stringify({ title }),
  }).then((r) => r.json());

// ---- Messages ----
export const getMessages = (conversationId) =>
  request(`/api/message/${conversationId}`).then((r) => r.json());

/**
 * Send a message and stream the SSE response.
 * Returns the readable stream body.
 */
export async function sendMessageStream(conversationId, content, history, attachments = []) {
  const res = await fetch("/api/message/send", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, content, history, attachments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.body;
}
