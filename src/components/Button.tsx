import type { ComponentPropsWithRef } from 'react';

import { cx } from '../styles/cx';
import styles from './Button.module.css';

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant: 'primary' | 'secondary' | 'ghost';
  /**
   * Keeps focus where it is when the button is pressed with a pointer. Leaving a field can
   * add or remove an inline error, which moves this button between mousedown and mouseup,
   * and the browser then drops the click. The field keeps focus until the click has run;
   * the action decides where focus goes next. Keyboard use is unaffected.
   */
  keepFocusOnPress?: boolean;
};

/** The design's three button styles. Defaults to type="button" so it never submits by accident. */
export function Button({
  variant,
  className,
  type = 'button',
  keepFocusOnPress = false,
  onMouseDown,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], className)}
      onMouseDown={(event) => {
        if (keepFocusOnPress) event.preventDefault();
        onMouseDown?.(event);
      }}
      {...rest}
    />
  );
}
