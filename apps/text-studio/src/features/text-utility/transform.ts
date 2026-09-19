export type TextTransformMode =
  | "uppercase"
  | "lowercase"
  | "titlecase"
  | "normalize-whitespace";

export interface TextInspectionMetrics {
  characterCount: number;
  wordCount: number;
  lineCount: number;
  byteLength: number;
}

export const MAX_INPUT_CHARS = 100_000;

export function inspectText(text: string): TextInspectionMetrics {
  const normalized = text.normalize("NFC");
  const characterCount = Array.from(normalized).length;
  const wordCount = normalized.trim().length === 0 ? 0 : normalized.trim().split(/\s+/).length;
  const lineCount = normalized.length === 0 ? 0 : normalized.split(/\r\n|\r|\n/).length;
  const byteLength = new TextEncoder().encode(normalized).length;

  return {
    characterCount,
    wordCount,
    lineCount,
    byteLength,
  };
}

export function applyTransform(text: string, mode: TextTransformMode): string {
  const normalized = text.normalize("NFC");

  switch (mode) {
    case "uppercase":
      return normalized.toUpperCase();

    case "lowercase":
      return normalized.toLowerCase();

    case "titlecase":
      return normalized.replace(
        /\b[a-zA-Z\u00C0-\u024F]+/g,
        (match) => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase(),
      );

    case "normalize-whitespace":
      return normalized
        .split(/\r\n|\r|\n/)
        .map((line) => line.trim().replace(/[ \t]+/g, " "))
        .join("\n")
        .trim();

    default:
      return normalized;
  }
}
