import styles from './RangeSlider.module.css';

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Spoken value, for example "R50 000" or "36 months". */
  valueText: string;
  endLabels: readonly [string, string];
  onChange: (value: number) => void;
}

/** A native range input. The text field beside it is the precise, authoritative control. */
export function RangeSlider({
  label,
  min,
  max,
  step,
  value,
  valueText,
  endLabels,
  onChange,
}: RangeSliderProps) {
  return (
    <div className={styles.slider}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        aria-label={label}
        aria-valuetext={valueText}
        className={styles.range}
      />
      <div aria-hidden="true" className={styles.ends}>
        <span>{endLabels[0]}</span>
        <span>{endLabels[1]}</span>
      </div>
    </div>
  );
}
