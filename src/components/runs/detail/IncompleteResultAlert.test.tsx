// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { IncompleteResultAlert } from './IncompleteResultAlert';
import { renderWithProviders, screen } from '../../../test-render';

describe('IncompleteResultAlert', () => {
  test('explains the step limit when that is the reason', () => {
    renderWithProviders(
      <IncompleteResultAlert reason="StepLimitReached" title="Analysis result may be incomplete" />,
    );
    expect(screen.getByText('Analysis result may be incomplete')).toBeInTheDocument();
    expect(screen.getByText(/reached its step limit/)).toBeInTheDocument();
  });

  test.each(['SomeFutureReason', undefined])(
    'falls back to a generic explanation for reason %j',
    (reason) => {
      renderWithProviders(
        <IncompleteResultAlert reason={reason} title="Analysis result may be incomplete" />,
      );
      expect(
        screen.getByText('Review this result carefully before relying on it.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/step limit/)).not.toBeInTheDocument();
    },
  );
});
