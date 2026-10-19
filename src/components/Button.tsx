import type { ComponentPropsWithoutRef } from 'react';

import { cx } from '../styles/cx';
import styles from './Button.module.css';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant: 'primary' | 'secondary' | 'ghost';
};

/** The design's three button styles. Defaults to type="button" so it never submits by accident. */
export function Button({ variant, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(styles.button, styles[variant], className)} {...rest} />;
}
