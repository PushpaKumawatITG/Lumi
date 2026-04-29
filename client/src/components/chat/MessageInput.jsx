import { useState, useRef } from "react";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_TEXT_SIZE = 1 * 1024 * 1024;  // 1MB
const TEXT_EXTENSIONS = [
  "txt", "md", "markdown", "csv", "json", "log", "yaml", "yml",
  "py", "js", "jsx", "ts", "tsx", "html", "css", "scss",
  "java", "c", "cpp", "h", "go", "rs", "rb", "php", "sh", "sql",
  "xml", "ini", "toml", "env",
];

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /**
   * Paste handler — intercepts image data from the clipboard
   * (screenshots, copied images from browsers, etc.) and adds them
   * as attachments. Plain text paste works as normal.
   */
  async function handlePaste(e) {
    if (disabled) return;

    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const newAttachments = [];

    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;

      const file = item.getAsFile();
      if (!file) continue;

      if (file.size > MAX_IMAGE_SIZE) {
        setError(`Pasted image is too large (max 4MB)`);
        continue;
      }

      try {
        const data = await readAsDataURL(file);
        // Clipboard images have generic names — give them a friendly one
        const ext = file.type.split("/")[1] || "png";
        const name = file.name && file.name !== "image.png"
          ? file.name
          : `pasted-${Date.now()}.${ext}`;
        newAttachments.push({ type: "image", name, data, size: file.size });
      } catch (err) {
        setError("Failed to read pasted image");
      }
    }

    if (newAttachments.length > 0) {
      e.preventDefault(); // stop the image from being pasted as text/binary garbage
      setAttachments((prev) => [...prev, ...newAttachments]);
      setError("");
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;

    onSend(trimmed, attachments);
    setText("");
    setAttachments([]);
    setError("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleInput(e) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  async function handleFiles(e) {
    setError("");
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting same file

    const newAttachments = [];

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isText = !isImage && (TEXT_EXTENSIONS.includes(ext) || file.type.startsWith("text/"));

      if (!isImage && !isText) {
        setError(`Unsupported file type: ${file.name}`);
        continue;
      }

      if (isImage && file.size > MAX_IMAGE_SIZE) {
        setError(`Image "${file.name}" is too large (max 4MB)`);
        continue;
      }
      if (isText && file.size > MAX_TEXT_SIZE) {
        setError(`File "${file.name}" is too large (max 1MB)`);
        continue;
      }

      try {
        if (isImage) {
          const data = await readAsDataURL(file);
          newAttachments.push({ type: "image", name: file.name, data, size: file.size });
        } else {
          const content = await readAsText(file);
          newAttachments.push({ type: "text", name: file.name, content, size: file.size });
        }
      } catch (err) {
        setError(`Failed to read ${file.name}`);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att, i) => (
              <AttachmentPreview key={i} att={att} onRemove={() => removeAttachment(i)} />
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="text-xs text-red-400 mb-2 px-2">{error}</div>
        )}

        <div className="flex items-end gap-2 bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition">
          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Attach files or images"
            className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFiles}
            className="hidden"
            accept="image/*,.txt,.md,.csv,.json,.log,.yaml,.yml,.py,.js,.jsx,.ts,.tsx,.html,.css,.scss,.java,.c,.cpp,.h,.go,.rs,.rb,.php,.sh,.sql,.xml,.ini,.toml,.env"
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            placeholder="Message Lumi... (paste images directly!)"
            rows={1}
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 resize-none outline-none text-sm leading-relaxed max-h-[200px] py-1.5"
          />

          <button
            onClick={handleSend}
            disabled={(!text.trim() && attachments.length === 0) || disabled}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white transition flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-zinc-600 text-center mt-2">
          Lumi can make mistakes. Press Shift+Enter for a new line.
        </p>
      </div>
    </div>
  );
}

function AttachmentPreview({ att, onRemove }) {
  if (att.type === "image") {
    return (
      <div className="relative group">
        <img
          src={att.data}
          alt={att.name}
          className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
        />
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-900 border border-zinc-600 rounded-full flex items-center justify-center text-zinc-300 hover:text-red-400 transition"
          title="Remove"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }
  // Text file chip
  return (
    <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-2 py-2 max-w-[240px]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 flex-shrink-0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="text-xs text-zinc-200 truncate flex-1">{att.name}</span>
      <button
        onClick={onRemove}
        className="text-zinc-500 hover:text-red-400 transition flex-shrink-0"
        title="Remove"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
