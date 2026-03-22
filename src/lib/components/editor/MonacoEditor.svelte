<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as monaco from "monaco-editor";
  import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
  import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
  import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
  import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
  import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";

  let { content = "", language = "plaintext", onchange }: {
    content?: string;
    language?: string;
    onchange?: (value: string) => void;
  } = $props();

  let container: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor;
  let initialized = false;

  self.MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === "typescript" || label === "javascript") return new tsWorker();
      if (label === "json") return new jsonWorker();
      if (label === "css" || label === "scss" || label === "less") return new cssWorker();
      if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
      return new editorWorker();
    },
  };

  function configureTypeScript() {
    if (initialized) return;
    initialized = true;

    // TypeScript compiler options — enable JSX, modern JS, strict mode
    const tsDefaults = monaco.languages.typescript.typescriptDefaults;
    const jsDefaults = monaco.languages.typescript.javascriptDefaults;

    const sharedOptions: monaco.languages.typescript.CompilerOptions = {
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      allowJs: true,
      checkJs: false,
      strict: false, // don't show errors for quick editing
      noEmit: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: false,
      resolveJsonModule: true,
      isolatedModules: true,
      skipLibCheck: true,
      allowNonTsExtensions: true,
    };

    tsDefaults.setCompilerOptions(sharedOptions);
    jsDefaults.setCompilerOptions(sharedOptions);

    // Enable JSX in .tsx and .jsx files
    tsDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    jsDefaults.setDiagnosticsOptions({
      noSemanticValidation: true, // less noisy for JS
      noSyntaxValidation: false,
    });

    // Add React type declarations for JSX autocomplete
    const reactTypes = `
declare namespace React {
  type ReactNode = string | number | boolean | null | undefined | React.ReactElement | React.ReactNode[];
  interface ReactElement<P = any> { type: any; props: P; key: string | null; }
  type FC<P = {}> = (props: P) => ReactNode;
  type CSSProperties = Record<string, string | number>;
  type ChangeEvent<T = HTMLInputElement> = { target: T; currentTarget: T; };
  type MouseEvent<T = HTMLElement> = { target: T; currentTarget: T; preventDefault(): void; stopPropagation(): void; clientX: number; clientY: number; };
  type KeyboardEvent<T = HTMLElement> = { target: T; key: string; code: string; preventDefault(): void; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; };
  type FormEvent<T = HTMLFormElement> = { target: T; preventDefault(): void; };
  function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  function useMemo<T>(factory: () => T, deps: any[]): T;
  function useRef<T>(initial: T): { current: T };
  function useContext<T>(context: React.Context<T>): T;
  function useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, (action: A) => void];
  function createContext<T>(defaultValue: T): React.Context<T>;
  interface Context<T> { Provider: FC<{ value: T; children?: ReactNode }>; Consumer: FC<{ children: (value: T) => ReactNode }>; }
  function memo<P>(component: FC<P>): FC<P>;
  function forwardRef<T, P>(render: (props: P, ref: React.Ref<T>) => ReactNode): FC<P & { ref?: React.Ref<T> }>;
  type Ref<T> = { current: T | null } | ((instance: T | null) => void);
  function Fragment(props: { children?: ReactNode }): ReactNode;
}
declare function require(module: string): any;
declare const module: { exports: any };
declare const process: { env: Record<string, string | undefined> };
declare const console: { log(...args: any[]): void; error(...args: any[]): void; warn(...args: any[]): void; info(...args: any[]): void; };
declare function fetch(url: string, init?: any): Promise<any>;
declare function setTimeout(fn: () => void, ms: number): number;
declare function setInterval(fn: () => void, ms: number): number;
declare function clearTimeout(id: number): void;
declare function clearInterval(id: number): void;

// DOM types
declare const document: {
  getElementById(id: string): HTMLElement | null;
  querySelector(selector: string): HTMLElement | null;
  querySelectorAll(selector: string): NodeListOf<HTMLElement>;
  createElement(tag: string): HTMLElement;
  body: HTMLElement;
};
declare const window: {
  addEventListener(event: string, handler: (e: any) => void): void;
  removeEventListener(event: string, handler: (e: any) => void): void;
  location: { href: string; pathname: string; search: string; hash: string; };
  localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; };
  innerWidth: number;
  innerHeight: number;
};

// Common Node.js
declare const __dirname: string;
declare const __filename: string;
declare function require(id: string): any;
`;

    tsDefaults.addExtraLib(reactTypes, "file:///node_modules/@types/react/index.d.ts");
    jsDefaults.addExtraLib(reactTypes, "file:///node_modules/@types/react/index.d.ts");

    // CSS custom data for better autocomplete
    monaco.languages.css.cssDefaults.setOptions({
      validate: true,
      lint: {
        compatibleVendorPrefixes: "warning",
        duplicateProperties: "warning",
        emptyRules: "warning",
      },
    });
  }

  onMount(() => {
    configureTypeScript();

    monaco.editor.defineTheme("darce-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5c6370", fontStyle: "italic" },
        { token: "keyword", foreground: "c678dd" },
        { token: "keyword.control", foreground: "c678dd" },
        { token: "string", foreground: "98c379" },
        { token: "string.key.json", foreground: "e06c75" },
        { token: "string.value.json", foreground: "98c379" },
        { token: "number", foreground: "d19a66" },
        { token: "type", foreground: "e5c07b" },
        { token: "type.identifier", foreground: "e5c07b" },
        { token: "variable", foreground: "e06c75" },
        { token: "variable.predefined", foreground: "e06c75" },
        { token: "constant", foreground: "d19a66" },
        { token: "tag", foreground: "e06c75" },
        { token: "attribute.name", foreground: "d19a66" },
        { token: "attribute.value", foreground: "98c379" },
        { token: "attribute.value.html", foreground: "98c379" },
        { token: "meta.tag", foreground: "e06c75" },
        { token: "delimiter", foreground: "abb2bf" },
        { token: "delimiter.html", foreground: "abb2bf" },
        { token: "operator", foreground: "56b6c2" },
        { token: "regexp", foreground: "98c379" },
      ],
      colors: {
        "editor.background": "#09090b",
        "editor.foreground": "#abb2bf",
        "editorLineNumber.foreground": "#3f3f46",
        "editorLineNumber.activeForeground": "#71717a",
        "editor.selectionBackground": "#3e4451",
        "editor.lineHighlightBackground": "#18181b50",
        "editorCursor.foreground": "#c8a555",
        "editorIndentGuide.background": "#27272a40",
        "editorIndentGuide.activeBackground": "#3f3f4680",
        "editor.wordHighlightBackground": "#27272a60",
        "editorBracketMatch.background": "#27272a80",
        "editorBracketMatch.border": "#52525b",
        "editorSuggestWidget.background": "#18181b",
        "editorSuggestWidget.border": "#27272a",
        "editorSuggestWidget.selectedBackground": "#27272a",
        "editorSuggestWidget.highlightForeground": "#c8a555",
        "editorWidget.background": "#18181b",
        "editorWidget.border": "#27272a",
        "editorHoverWidget.background": "#18181b",
        "editorHoverWidget.border": "#27272a",
        "input.background": "#18181b",
        "input.border": "#27272a",
        "list.hoverBackground": "#27272a60",
        "list.activeSelectionBackground": "#27272a",
      },
    });

    editor = monaco.editor.create(container, {
      value: content,
      language,
      theme: "darce-dark",
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 21,
      letterSpacing: 0.3,
      minimap: { enabled: true, scale: 1, renderCharacters: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: "on",
      cursorBlinking: "smooth",
      cursorWidth: 2,
      renderWhitespace: "selection",
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: true },
      padding: { top: 16, bottom: 16 },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
      automaticLayout: true,
      fontLigatures: true,
      renderLineHighlight: "line",
      matchBrackets: "always",
      // Autocomplete settings
      quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnCommitCharacter: true,
      wordBasedSuggestions: "allDocuments",
      parameterHints: { enabled: true },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showValues: true,
        showConstants: true,
        showInterfaces: true,
        showColors: true,
        preview: true,
        insertMode: "replace",
      },
      // Auto-closing and formatting
      autoClosingBrackets: "always",
      autoClosingQuotes: "always",
      autoSurround: "languageDefined",
      formatOnPaste: true,
      formatOnType: true,
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
    });

    editor.onDidChangeModelContent(() => {
      onchange?.(editor.getValue());
    });
  });

  onDestroy(() => {
    editor?.dispose();
  });

  $effect(() => {
    if (editor && content !== editor.getValue()) {
      editor.setValue(content);
    }
  });

  $effect(() => {
    if (editor) {
      const model = editor.getModel();
      if (model && language) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
  });
</script>

<div bind:this={container} class="w-full h-full"></div>
