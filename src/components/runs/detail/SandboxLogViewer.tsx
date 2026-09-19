import {
  Alert,
  Button,
  Checkbox,
  ExpandableSection,
  Label,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { LogViewer, LogViewerSearch } from '@patternfly/react-log-viewer';
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type OtelPhase, useRetainedLogs } from '../../../hooks/useRetainedLogs';
import { useSandboxLogStream } from '../../../hooks/useSandboxLogStream';
import { SandboxView } from '../../../models/agenticrun-views';
import { useRunUid } from '../RunUidContext';
import './SandboxLogViewer.css';

interface SandboxLogViewerProps {
  phase?: OtelPhase;
  title: string;
  sandbox: SandboxView;
  sinceTime?: string;
  streaming?: boolean;
}

export const SandboxLogViewer: FC<SandboxLogViewerProps> = ({
  phase,
  title,
  sandbox,
  sinceTime,
  streaming = false,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const runUid = useRunUid();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [hideHealthChecks, setHideHealthChecks] = useState(true);
  const logViewerRef = useRef<{ scrollToItem?: (index: number) => void }>(null);

  const retained = useRetainedLogs(runUid, isExpanded && !streaming, phase);
  const useOtel = retained.available && !streaming && !!runUid;

  const podLogs = useSandboxLogStream(
    sandbox,
    isExpanded && !useOtel && !retained.loading,
    streaming,
    sinceTime,
    hideHealthChecks,
  );

  const lines = useOtel ? retained.lines : podLogs.lines;
  const loading = retained.loading || (useOtel ? false : podLogs.loading);
  const error = useOtel ? retained.error : podLogs.error;

  const prevLinesLengthRef = useRef(0);
  useEffect(() => {
    if (
      isFollowing &&
      lines.length > prevLinesLengthRef.current &&
      logViewerRef.current?.scrollToItem
    ) {
      logViewerRef.current.scrollToItem(lines.length - 1);
    }
    prevLinesLengthRef.current = lines.length;
  }, [lines.length, isFollowing]);

  const handleScroll = useCallback(
    ({
      scrollOffsetToBottom,
      scrollUpdateWasRequested,
    }: {
      scrollDirection: 'forward' | 'backward';
      scrollOffset: number;
      scrollOffsetToBottom: number;
      scrollUpdateWasRequested: boolean;
    }) => {
      if (!scrollUpdateWasRequested) {
        setIsFollowing(scrollOffsetToBottom < 1);
      }
    },
    [],
  );

  const logData = useMemo(() => lines.join('\n'), [lines]);

  const toolbar = (
    <Toolbar>
      <ToolbarContent>
        <ToolbarItem>
          <LogViewerSearch minSearchChars={2} placeholder={t('Search logs...')} />
        </ToolbarItem>
        {!useOtel && (
          <ToolbarItem alignSelf="center">
            <Checkbox
              id={`health-check-filter-${title}`}
              isChecked={hideHealthChecks}
              label={t('Hide health checks')}
              onChange={(_e, checked) => setHideHealthChecks(checked)}
            />
          </ToolbarItem>
        )}
      </ToolbarContent>
    </Toolbar>
  );

  const footer =
    !isFollowing && streaming ? (
      <Button onClick={() => setIsFollowing(true)} variant="link">
        {t('Resume auto-scroll')}
      </Button>
    ) : undefined;

  return (
    <ExpandableSection
      isExpanded={isExpanded}
      onToggle={(_e, expanded) => setIsExpanded(expanded)}
      toggleContent={
        <>
          {isExpanded ? t('Hide {{title}} logs', { title }) : t('View {{title}} logs', { title })}
          {streaming && (
            <>
              {' '}
              <Label color="blue" isCompact>
                {t('Live')}
              </Label>
            </>
          )}
        </>
      }
    >
      {error && <Alert isInline isPlain title={error} variant="warning" />}
      <div className="ols-plugin__sandbox-log-viewer">
        <LogViewer
          data={
            error
              ? t('Failed to load logs.')
              : loading && lines.length === 0
                ? t('Loading logs...')
                : logData || t('No logs available.')
          }
          footer={footer}
          hasLineNumbers
          height={400}
          innerRef={logViewerRef}
          isTextWrapped
          onScroll={handleScroll}
          toolbar={toolbar}
        />
      </div>
    </ExpandableSection>
  );
};
