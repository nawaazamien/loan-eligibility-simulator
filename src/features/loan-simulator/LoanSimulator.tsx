import { useReducer } from 'react';

import { formReducer, initialFormState } from './formState';
import { LoanForm } from './LoanForm';
import styles from './LoanSimulator.module.css';
import { ResultsPanel } from './ResultsPanel';

/**
 * The simulator: the design's 7/5 grid with the form on the left and the estimate on the
 * right, stacked below 760px. It owns the form state so the estimate can use it in Phase 2.
 */
export function LoanSimulator() {
  const [state, dispatch] = useReducer(formReducer, initialFormState);

  return (
    <div className={styles.layout}>
      <LoanForm state={state} dispatch={dispatch} />
      <ResultsPanel />
    </div>
  );
}
