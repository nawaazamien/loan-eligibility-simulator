import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.wordmark}>Tally</span>
        <span className={styles.tag}>Demo</span>
        <span className={styles.tagline}>Fictional estimates · Not a credit check</span>
      </div>
    </header>
  );
}
