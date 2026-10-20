import { setupServer } from 'msw/node';

import { handlers } from '../mock-api/handlers';

/**
 * The same mocked endpoints the app uses in the browser, intercepting real HTTP requests made
 * by the real API client. Tests override single endpoints with `server.use(...)`.
 */
export const server = setupServer(...handlers);
