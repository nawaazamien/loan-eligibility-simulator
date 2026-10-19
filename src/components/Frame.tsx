import { cx } from '../styles/cx';
import styles from './Frame.module.css';

const CORNERS = [styles.tl, styles.tr, styles.bl, styles.br];

/**
 * The Industry design system's "blueprint" frame: a square hairline border (the `frame`
 * class in Frame.module.css) with four decorative "+" registration marks just outside the
 * corners (this component). No fill, no shadow. The reference applies it to the form panel,
 * the estimate panel and the primary button, so it is a class plus a corner component
 * rather than a wrapper element. The parent must be positioned.
 */
export function FrameCorners() {
  return (
    <>
      {CORNERS.map((corner, index) => (
        <span key={index} aria-hidden="true" className={cx(styles.corner, corner)} />
      ))}
    </>
  );
}
