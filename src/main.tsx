// Self-hosted Barlow (OFL-1.1). Latin subset only: it covers every glyph in the UI copy,
// including NBSP digit grouping, typographic quotes, en/em dashes and U+2212 minus.
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-600.css';
import './styles/tokens.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { Startup } from './app/Startup';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}
const root = createRoot(rootElement);

/**
 * With no VITE_API_BASE_URL the app runs against its in-browser mock API, which must be
 * started (and have taken control of the page) before anything can call it. With a real API
 * configured, the mock is not started or even downloaded.
 */
async function startApiMocking(): Promise<void> {
  if (import.meta.env.VITE_API_BASE_URL) return;
  const { startMockApi } = await import('./mock-api/browser');
  await startMockApi();
}

root.render(
  <StrictMode>
    <Startup start={startApiMocking}>
      <App />
    </Startup>
  </StrictMode>,
);
