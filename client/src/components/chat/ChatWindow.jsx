import { useState, useEffect, useRef, useCallback } from "react";
import {
  createConversation,
  getMessages,
  sendMessageStream,
} from "../../api";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";

export default function ChatWindow({ conversationId, setConversationId, refreshSidebar }) {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const bottomRef = useRef(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const msgs = await getMessages(conversationId);
        setMessages(msgs);
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    })();
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  const handleSend = useCallback(
    async (content, attachments = []) => {
      let activeConvId = conversationId;

      if (!activeConvId) {
        try {
          const conv = await createConversation();
          activeConvId = conv.id;
          setConversationId(activeConvId);
        } catch (err) {
          console.error("Failed to create conversation:", err);
          return;
        }
      }

      const userMsg = {
        role: "user",
        content,
        attachments,
        id: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Build history for context (include attachments so vision/file context carries forward)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments || [],
      }));

      setStreaming(true);
      setStreamText("");

      try {
        const body = await sendMessageStream(activeConvId, content, history, attachments);
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                fullText += parsed.token;
                setStreamText(fullText);
              }
              if (parsed.error) {
                fullText += `\n\n*Error: ${parsed.error}*`;
                setStreamText(fullText);
              }
            } catch {}
          }
        }

        if (fullText) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullText, id: Date.now() },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `*Error: ${err.message}*`,
            id: Date.now(),
          },
        ]);
      }

      setStreaming(false);
      setStreamText("");
      refreshSidebar();
    },
    [conversationId, messages, setConversationId, refreshSidebar]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">✨</p>
              <h2 className="text-xl font-semibold text-zinc-300 mb-2">Hi, I'm Lumi</h2>
              <p className="text-sm text-zinc-500">How can I help you today?</p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              attachments={msg.attachments}
            />
          ))}

          {streaming && streamText && <MessageBubble role="assistant" content={streamText} />}
          {streaming && !streamText && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>
      </div>

      <MessageInput onSend={handleSend} disabled={streaming} />
    </div>
  );
}
