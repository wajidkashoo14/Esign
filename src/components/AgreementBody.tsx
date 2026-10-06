import { Fragment } from "react";
import { parseDocument, type Inline } from "@/lib/markdown";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((r, i) => (r.bold ? <strong key={i}>{r.text}</strong> : <Fragment key={i}>{r.text}</Fragment>))}
    </>
  );
}

/** Renders agreement text (Markdown subset) as React elements; never injects HTML. */
export function AgreementBody({ text, className }: { text: string; className?: string }) {
  const blocks = parseDocument(text);
  return (
    <div className={`agreement ${className ?? ""}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const H = (`h${b.level}` as "h1" | "h2" | "h3");
            return <H key={i}><Inlines items={b.content} /></H>;
          }
          case "paragraph":
            return <p key={i}><Inlines items={b.content} /></p>;
          case "list": {
            const L = b.ordered ? "ol" : "ul";
            return (
              <L key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <span className="marker">{it.marker}</span>
                    <div><Inlines items={it.content} /></div>
                  </li>
                ))}
              </L>
            );
          }
          case "hr":
            return <hr key={i} />;
        }
      })}
    </div>
  );
}
