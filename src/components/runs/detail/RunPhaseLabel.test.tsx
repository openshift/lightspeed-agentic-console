// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { RunPhaseLabel } from './RunPhaseLabel';
import { renderWithProviders, screen } from '../../../test-render';

describe('RunPhaseLabel', () => {
  test('renders the display label for a known phase', () => {
    renderWithProviders(<RunPhaseLabel phase="Completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  test('maps a multi-word phase to its display label', () => {
    renderWithProviders(<RunPhaseLabel phase="EmergencyStopped" />);
    expect(screen.getByText('Emergency stopped')).toBeInTheDocument();
  });

  test('renders an icon for a known phase', () => {
    const { container } = renderWithProviders(<RunPhaseLabel phase="Completed" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('applies the semantic colour class for a terminal phase', () => {
    const { container } = renderWithProviders(<RunPhaseLabel phase="Failed" />);
    expect(container.querySelector('.ols-plugin__run-phase-icon--danger')).toBeInTheDocument();
  });

  test('omits the colour class for a transient phase so it inherits currentColor', () => {
    const { container } = renderWithProviders(<RunPhaseLabel phase="Analyzing" />);
    expect(container.querySelector('[class*="run-phase-icon--"]')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('falls back to the raw phase without an icon for an unknown value', () => {
    const { container } = renderWithProviders(<RunPhaseLabel phase={'Surprise' as never} />);
    expect(screen.getByText('Surprise')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  test('displays Stopping instead of the derived phase label when stopping', () => {
    renderWithProviders(<RunPhaseLabel phase="Executing" stopping />);
    expect(screen.getByText('Stopping')).toBeInTheDocument();
    expect(screen.queryByText('Executing')).not.toBeInTheDocument();
  });
});
