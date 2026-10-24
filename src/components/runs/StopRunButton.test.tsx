// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

import { fireEvent, renderWithProviders, screen } from '../../test-render';
import { StopRunButton } from './StopRunButton';

describe('StopRunButton', () => {
  test('renders a compact Stop action for an active run', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <StopRunButton
        canStop
        canStopLoading={false}
        isCompact
        onClick={onClick}
        phase="Executing"
      />,
    );

    const button = screen.getByRole('button', { name: 'Stop' });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('disables a denied stop action without showing a loading state', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <StopRunButton canStop={false} canStopLoading={false} onClick={onClick} phase="Analyzing" />,
    );

    const button = screen.getByRole('button', { name: 'Stop run' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('disables the action while access is loading without a spinner', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <StopRunButton canStop={false} canStopLoading onClick={onClick} phase="Verifying" />,
    );

    const button = screen.getByRole('button', { name: 'Stop run' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test.each([
    'Pending',
    'Proposed',
    'Completed',
    'Failed',
    'Denied',
    'Escalated',
    'EmergencyStopped',
  ] as const)('is hidden for the %s phase', (phase) => {
    renderWithProviders(
      <StopRunButton canStop canStopLoading={false} onClick={vi.fn()} phase={phase} />,
    );
    expect(screen.queryByRole('button', { name: 'Stop run' })).not.toBeInTheDocument();
  });

  test('is hidden once stop is pending', () => {
    renderWithProviders(
      <StopRunButton
        canStop
        canStopLoading={false}
        onClick={vi.fn()}
        phase="Executing"
        stopPending
      />,
    );

    expect(screen.queryByRole('button', { name: 'Stop run' })).not.toBeInTheDocument();
  });
});
