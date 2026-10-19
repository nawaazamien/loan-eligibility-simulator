import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../styles/cx';
import styles from './Frame.module.css';

type FrameProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section';
  children: ReactNode;
};

const CORNERS = [styles.tl, styles.tr, styles.bl, styles.br];

/**
 * The Industry design system's "blueprint" frame: a square hairline border with four
 * decorative "+" registration marks just outside the corners. No fill, no shadow.
 */
export function Frame({ as: Tag = 'div', className, children, ...rest }: FrameProps) {
  return (
    <Tag className={cx(styles.frame, className)} {...rest}>
      {CORNERS.map((corner, index) => (
        <span key={index} aria-hidden="true" className={cx(styles.corner, corner)} />
      ))}
      {children}
    </Tag>
  );
}
