import styles from './MockApiError.module.css';

/**
 * Shown instead of the app when the in-browser mock API cannot start (for example when the
 * browser blocks service workers). Without it every request would fail with no explanation.
 */
export function MockApiError() {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>This demo can't start in this browser</h1>
      <p role="alert">
        The loan simulator answers its requests with a small in-browser service (a service worker),
        and your browser didn't allow it. Private browsing, blocked site data or an unsupported
        browser can cause this. Try a normal window in a current Chrome, Edge, Firefox or Safari,
        then reload.
      </p>
    </main>
  );
}
