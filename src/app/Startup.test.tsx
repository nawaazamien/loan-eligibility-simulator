import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';

import { Startup } from './Startup';

/** A start function the test settles by hand. */
function controlledStart() {
  const calls: { resolve: () => void; reject: () => void }[] = [];
  const start = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        calls.push({
          resolve,
          reject: () => {
            reject(new Error('blocked'));
          },
        });
      }),
  );
  return { start, calls };
}

const tree = (start: () => Promise<void>, timeoutMs = 1000) => (
  <Startup start={start} timeoutMs={timeoutMs}>
    <p>The app</p>
  </Startup>
);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Startup', () => {
  it('shows a status message while the mock API starts, then the app', async () => {
    const { start, calls } = controlledStart();
    render(tree(start));
    expect(screen.getByRole('status')).toHaveTextContent('Starting the demo…');
    expect(screen.queryByText('The app')).not.toBeInTheDocument();
    await act(async () => {
      calls[0]?.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('The app')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('explains a failed start and offers Try again, which recovers', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { start, calls } = controlledStart();
    render(tree(start));
    await act(async () => {
      calls[0]?.reject();
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "This demo can't start in this browser",
    );
    expect(screen.getByRole('alert')).toHaveTextContent("your browser didn't allow it");

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status')).toHaveTextContent('Starting the demo…');
    expect(start).toHaveBeenCalledTimes(2);
    await act(async () => {
      calls[1]?.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('The app')).toBeInTheDocument();
  });

  it('says so when the start takes too long, and a late finish still opens the app', async () => {
    const { start, calls } = controlledStart();
    render(tree(start, 1000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'The demo is taking too long to start',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('has not started yet');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    await act(async () => {
      calls[0]?.resolve(); // it finishes after the message appeared
      await Promise.resolve();
    });
    expect(screen.getByText('The app')).toBeInTheDocument();
  });

  it('Try again after a timeout waits on the attempt in flight instead of starting another', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // A start that is idempotent, like startMockApi: repeat calls share one attempt.
    let settle: () => void = () => undefined;
    const shared = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const start = vi.fn(() => {
      return shared;
    });
    render(tree(start, 1000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(screen.getByText('The app')).toBeInTheDocument();
  });

  it('ignores an earlier attempt that fails after a retry has begun', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { start, calls } = controlledStart();
    render(tree(start, 1000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => {
      calls[0]?.reject(); // the abandoned first attempt fails now
      await Promise.resolve();
    });
    // Still showing the retry's own progress, not a failure from the old attempt.
    expect(screen.getByRole('status')).toHaveTextContent('Starting the demo…');
  });
});
