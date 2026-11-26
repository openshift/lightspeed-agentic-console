// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { EscalationView } from '../../../models/agenticrun-views';
import { EscalationSummary } from './EscalationSummary';
import { renderWithProviders, screen } from '../../../test-render';

const render = (escalation: EscalationView) =>
  renderWithProviders(<EscalationSummary escalation={escalation} />);

describe('EscalationSummary', () => {
  test('renders nothing when there is no summary, content, or sandbox', () => {
    const { container } = render({ failureReason: 'agent crashed' });
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the heading and summary text', () => {
    render({ summary: 'Needs a human' });
    expect(screen.getByText('Escalation summary')).toBeInTheDocument();
    expect(screen.getByText('AI-generated')).toBeInTheDocument();
    expect(screen.getByText('Needs a human')).toBeInTheDocument();
  });

  test('renders content when it differs from the summary', () => {
    render({ content: 'Detailed context', summary: 'Needs a human' });
    expect(screen.getByText('Detailed context')).toBeInTheDocument();
  });

  test('does not duplicate content that equals the summary', () => {
    render({ content: 'Needs a human', summary: 'Needs a human' });
    expect(screen.getAllByText('Needs a human')).toHaveLength(1);
  });

  test('renders the log viewer when an escalation sandbox is present', () => {
    render({ escalationSandbox: { namespace: 'ns', podName: 'pod' }, summary: 'Needs a human' });
    expect(screen.getByText('View Escalation logs')).toBeInTheDocument();
  });

  test('warns when the escalation result may be incomplete', () => {
    render({ mayBeIncomplete: { reason: 'StepLimitReached' }, summary: 'Needs a human' });
    expect(screen.getByText('Escalation result may be incomplete')).toBeInTheDocument();
  });

  test('does not warn when the escalation result is complete', () => {
    render({ summary: 'Needs a human' });
    expect(screen.queryByText('Escalation result may be incomplete')).not.toBeInTheDocument();
  });
});
