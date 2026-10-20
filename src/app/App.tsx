import { createApiClient, type ApiClient } from '../api/client';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { LoanSimulator } from '../features/loan-simulator/LoanSimulator';
import styles from './App.module.css';

/**
 * Where the app's API calls go. By default, the page's own origin, answered by the in-browser
 * mock (src/mock-api). Build with VITE_API_BASE_URL to point at a real API instead: nothing else
 * in the app changes (docs/API.md).
 */
const defaultClient = createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });

export function App({ client = defaultClient }: { client?: ApiClient }) {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Loan eligibility simulator</h1>
          <p className={styles.lead}>
            See an illustrative estimate of what a personal loan could cost each month, and whether
            it fits a simple demo affordability rule. This isn't a credit check, an approval or an
            offer.
          </p>
        </div>
        <LoanSimulator client={client} />
      </main>
      <SiteFooter />
    </>
  );
}
