import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const ttsSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

// Strip Markdown so the spoken output doesn't read out backticks, asterisks, etc.
function plainTextFromMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, " (code block) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~#>]/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

/**
 * Renders a single message bubble.
 * - User messages: right-aligned, violet accent, with image/file attachments
 * - Assistant messages: left-aligned, dark with Markdown rendering + actions
 */
export default function MessageBubble({
  id,
  role,
  content,
  attachments = [],
  feedback = null,
  onFeedback,
}) {
  const isUser = role === "user";
  const images = attachments.filter((a) => a.type === "image");
  const textFiles = attachments.filter((a) => a.type === "text");
  const showActions = !isUser && typeof id === "number" && content;

  return (
    <div className={`flex items-start gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          isUser ? "bg-zinc-600 text-zinc-200" : "bg-violet-600 text-white"
        }`}
      >
        {isUser ? "You" : "Lu"}
      </div>

      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Image attachments (above bubble) */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end">
            {images.map((img, i) => (
              <ImageThumb key={i} src={img.data} name={img.name} />
            ))}
          </div>
        )}

        {/* Text file chips (above bubble) */}
        {textFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end">
            {textFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 flex-shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-xs text-zinc-100 max-w-[200px] truncate">{f.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Text bubble — only render if there's text content */}
        {content && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? "bg-violet-600 text-white rounded-tr-sm"
                : "bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-tl-sm"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      if (!inline && match) {
                        return (
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ borderRadius: "8px", fontSize: "13px", margin: "8px 0" }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        );
                      }
                      return (
                        <code className="bg-zinc-700 px-1.5 py-0.5 rounded text-xs" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {showActions && (
          <MessageActions
            messageId={id}
            content={content}
            feedback={feedback}
            onFeedback={onFeedback}
          />
        )}
      </div>
    </div>
  );
}

function MessageActions({ messageId, content, feedback, onFeedback }) {
  const [speaking, setSpeaking] = useState(false);

  // Make sure speech stops if the message unmounts mid-utterance.
  useEffect(() => {
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, []);

  function toggleSpeak() {
    if (!ttsSupported) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel(); // stop any other bubble that might be speaking
    const utter = new SpeechSynthesisUtterance(plainTextFromMarkdown(content));
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utter);
  }

  const btn = "p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition";
  const active = "text-violet-400 bg-zinc-800";

  return (
    <div className="flex items-center gap-1 -mt-1 ml-1">
      <button
        type="button"
        onClick={() => onFeedback?.(messageId, feedback, "up")}
        title="Good response"
        className={`${btn} ${feedback === "up" ? active : ""}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={feedback === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.34-8.66a1.93 1.93 0 0 1 3.66 1.04Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onFeedback?.(messageId, feedback, "down")}
        title="Bad response"
        className={`${btn} ${feedback === "down" ? active : ""}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={feedback === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.34 8.66a1.93 1.93 0 0 1-3.66-1.04Z" />
        </svg>
      </button>
      {ttsSupported && (
        <button
          type="button"
          onClick={toggleSpeak}
          title={speaking ? "Stop" : "Read aloud"}
          className={`${btn} ${speaking ? active : ""}`}
        >
          {speaking ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

function ImageThumb({ src, name }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block rounded-xl overflow-hidden border border-zinc-700 hover:border-violet-500 transition"
        title={name}
      >
        <img src={src} alt={name} className="w-40 h-40 object-cover" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          <img src={src} alt={name} className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </>
  );
}
