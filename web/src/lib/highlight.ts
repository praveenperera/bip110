import { createHighlighter } from "shiki";

/** Languages supported by response code blocks */
export type HighlightLanguage = "python" | "text";

/** Renderable syntax token with dual-theme inline styles */
export interface HighlightToken {
  content: string;
  style: string;
}

const highlighter = await createHighlighter({
  langs: ["python"],
  themes: ["github-light", "github-dark"],
});

const serializeStyle = (
  htmlStyle?: Record<string, string | number>,
): string => {
  if (!htmlStyle) return "";

  return Object.entries(htmlStyle)
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
};

/** Highlights source text into lines while preserving plain-text blocks */
export function highlightTokens(
  code: string,
  language: HighlightLanguage,
): HighlightToken[][] {
  if (language === "text") {
    return code.split("\n").map((line) => [{ content: line, style: "" }]);
  }

  return highlighter
    .codeToTokens(code, {
      lang: language,
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    })
    .tokens.map((line) =>
      line.map((token) => ({
        content: token.content,
        style: serializeStyle(token.htmlStyle),
      })),
    );
}
