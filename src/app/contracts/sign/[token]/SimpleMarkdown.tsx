// ═══════════════════════════════════════════════════════════════════════════
// SimpleMarkdown — minimal markdown renderer for contract bodies.
// Mirrors the affiliate-agreement page parser so we don't pull react-markdown
// for a few hundred bytes of legal text. Handles:
//   - # / ## / ### / #### headings
//   - Blank-line-separated paragraphs
//   - `- item` / `* item` bullet lists
//   - **bold** + *italic* inline emphasis
//   - HTML escaped defensively so any raw <…> in the body renders as text.
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(s: string): string {
  let out = escapeHtmlText(s);
  // **bold**
  out = out.replace(
    /\*\*([^*]+?)\*\*/g,
    '<strong style="color:#ffffff;font-weight:700;">$1</strong>'
  );
  // *italic* — careful not to eat the **bold** we already replaced
  out = out.replace(
    /(^|[^*])\*([^*\n]+?)\*(?!\*)/g,
    '$1<em style="color:#e5e5e5;">$2</em>'
  );
  return out;
}

interface Block {
  kind: "h" | "p" | "ul";
  html: string;
  level?: number;
}

export function SimpleMarkdown({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm italic text-stone-500">(No additional terms.)</p>;
  }

  const lines = source.split(/\r?\n/);
  const out: Block[] = [];
  let buffer: string[] = [];
  let bulletBuffer: string[] = [];

  function flushParagraph() {
    if (buffer.length) {
      out.push({ kind: "p", html: buffer.map(renderInline).join(" ") });
      buffer = [];
    }
  }
  function flushBullets() {
    if (bulletBuffer.length) {
      const items = bulletBuffer.map((b) => `<li>${renderInline(b)}</li>`).join("");
      out.push({ kind: "ul", html: items });
      bulletBuffer = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushBullets();
      continue;
    }
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushBullets();
      out.push({
        kind: "h",
        level: headingMatch[1].length,
        html: renderInline(headingMatch[2]),
      });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      bulletBuffer.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    flushBullets();
    buffer.push(line);
  }
  flushParagraph();
  flushBullets();

  return (
    <>
      {out.map((block, i) => {
        if (block.kind === "h") {
          const sizeClass =
            block.level === 1
              ? "text-xl font-black text-white mt-6 mb-3"
              : block.level === 2
                ? "text-lg font-bold text-white mt-5 mb-2"
                : block.level === 3
                  ? "text-base font-bold text-white mt-4 mb-2"
                  : "text-sm font-bold text-yellow-300 mt-4 mb-1.5 uppercase tracking-wide";
          return (
            <p
              key={i}
              className={sizeClass}
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        if (block.kind === "ul") {
          return (
            <ul
              key={i}
              className="my-2 ml-5 list-disc space-y-1 text-sm leading-relaxed text-stone-300"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        return (
          <p
            key={i}
            className="my-2 text-sm leading-relaxed text-stone-300"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        );
      })}
    </>
  );
}
