import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

/**
 * Renders a single message bubble.
 * - User messages: right-aligned, violet accent, with image/file attachments
 * - Assistant messages: left-aligned, dark with Markdown rendering
 */
export default function MessageBubble({ role, content, attachments = [] }) {
  const isUser = role === "user";
  const images = attachments.filter((a) => a.type === "image");
  const textFiles = attachments.filter((a) => a.type === "text");

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
      </div>
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
