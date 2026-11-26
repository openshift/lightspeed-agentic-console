// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

import { fireEvent, renderWithProviders, screen } from '../../test-render';
import { StopRunButton } from './StopRunButton';

describe('StopRunButton', () => {
  test('calls onClick when access is granted', () => {
    const onClick = vi.fn();
    renderWithProviders(<StopRunButton canStop canStopLoading={false} onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Stop run' });
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('disables a denied stop action with a denial tooltip', async () => {
    const onClick = vi.fn();
    renderWithProviders(<StopRunButton canStop={false} canStopLoading={false} onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Stop run' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('aria-busy', 'true');
    fireEvent.mouseEnter(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      "You don't have permission to stop runs.",
    );
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('disables the action while access is loading without a spinner or denial tooltip', async () => {
    const onClick = vi.fn();
    renderWithProviders(<StopRunButton canStop={false} canStopLoading onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Stop run' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('aria-busy', 'true');
    fireEvent.mouseEnter(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
