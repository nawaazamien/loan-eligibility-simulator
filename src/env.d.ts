/** Build-time settings. Both are optional; the defaults run the app on its in-browser mock API. */
interface ImportMetaEnv {
  /** Base URL of a real loan API. When set, the mock is not started (docs/API.md). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
