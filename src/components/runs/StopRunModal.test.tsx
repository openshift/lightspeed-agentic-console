// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

import { fireEvent, renderWithProviders, screen } from '../../test-render';
import { StopRunModal } from './StopRunModal';

const renderModal = (overrides: Partial<Parameters<typeof StopRunModal>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <StopRunModal
      isExecuting={false}
      isLoading={false}
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      runName="run-1"
      {...overrides}
    />,
  );
  return { onConfirm, onClose };
};

describe('StopRunModal', () => {
  test('warns about partial cluster changes and manual inspection during execution', () => {
    renderModal({ isExecuting: true });

    expect(screen.getByText('Stop run-1?')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Stopping this run cannot be undone. Partial cluster changes may already exist, so inspect the cluster manually after it stops.',
      ),
    ).toBeInTheDocument();
  });

  test('confirms the irreversible stop action and displays inline errors', () => {
    const { onConfirm } = renderModal({ error: 'API denied the stop request' });

    expect(screen.getByText('API denied the stop request')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('explains that prior cluster changes remain when not executing', () => {
    renderModal();

    expect(
      screen.getByText(
        'Stopping this run cannot be undone. Any changes already made to your cluster will remain.',
      ),
    ).toBeInTheDocument();
  });
});
