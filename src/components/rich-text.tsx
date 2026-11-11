// Draws text with **bold**, __underline__ and *italic* (src/lib/rich-text.ts) as React
// elements. Works in server and client components.
import { Fragment } from "react";
import { parseRich, type RichNode } from "@/lib/rich-text";

function Nodes({ nodes }: { nodes: RichNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (typeof n === "string") return <Fragment key={i}>{n}</Fragment>;
        const inner = <Nodes nodes={n.children} />;
        if (n.mark === "bold") return <strong key={i} className="font-bold">{inner}</strong>;
        if (n.mark === "underline") return <u key={i} className="underline decoration-pink decoration-2 underline-offset-4">{inner}</u>;
        return <em key={i}>{inner}</em>;
      })}
    </>
  );
}

export function RichText({ text }: { text: string }) {
  return <Nodes nodes={parseRich(text)} />;
}
