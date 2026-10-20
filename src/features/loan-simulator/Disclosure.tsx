import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cx } from '../../styles/cx';
import styles from './Disclosure.module.css';

interface DisclosureProps {
  title: string;
  children: ReactNode;
}

/**
 * A button with aria-expanded controlling a region that is hidden while collapsed. Collapsed by
 * default: supporting detail stays out of the way of the primary result.
 */
export function Disclosure({ title, children }: DisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
        }}
        className={styles.toggle}
      >
        <span>{title}</span>
        <ChevronDown
          aria-hidden="true"
          size={18}
          strokeWidth={1.5}
          className={cx(styles.chevron, open && styles.open)}
        />
      </button>
      <div id={panelId} hidden={!open} className={styles.panel}>
        {children}
      </div>
    </div>
  );
}
