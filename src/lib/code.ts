// Shared helpers for code collaboration (used on client and server)

export const MAX_CODE_BYTES = 200_000;

export const FILE_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,60}\.(java|py|js|ts|c|cpp|h|md|txt)$/;

const LANGUAGES: Record<string, string> = {
  java: "java",
  py: "python",
  js: "javascript",
  ts: "typescript",
  c: "c",
  cpp: "cpp",
  h: "cpp",
  md: "markdown",
  txt: "plaintext",
};

export const languageOf = (name: string) => LANGUAGES[name.split(".").pop() ?? ""] ?? "plaintext";

/** Starter content for new files: Java files get a runnable main method */
export function starterCode(name: string) {
  if (name.endsWith(".java")) {
    const cls = name.replace(/\.java$/, "");
    return `public class ${cls} {\n    public static void main(String[] args) {\n        System.out.println("Hello, ${cls}!");\n    }\n}\n`;
  }
  return "";
}
