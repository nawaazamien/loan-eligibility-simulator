import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { LoanSimulator } from '../features/loan-simulator/LoanSimulator';
import styles from './App.module.css';

export function App() {
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
        <LoanSimulator />
      </main>
      <SiteFooter />
    </>
  );
}
