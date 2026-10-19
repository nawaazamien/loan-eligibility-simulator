import styles from './SiteFooter.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        Tally is a demonstration project built for a front-end engineering assessment. It isn't
        affiliated with any bank or lender, doesn't store your information and doesn't perform
        credit checks.
      </p>
    </footer>
  );
}
