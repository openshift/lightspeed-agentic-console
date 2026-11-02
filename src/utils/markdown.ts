import DOMPurify from 'dompurify';
import { Marked } from 'marked';

// Render task list checkboxes as text so form controls can stay off the allow list
const marked = new Marked({
  renderer: { checkbox: ({ checked }) => (checked ? '☑ ' : '☐ ') },
});

const purify = DOMPurify();

// An explicit allow list means attributes DOMPurify adds to its defaults in future releases (such
// as `command` and `popovertarget`) aren't picked up on upgrade
const purifyConfig = {
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOWED_ATTR: ['align', 'href', 'open', 'start', 'title'],
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'caption',
    'code',
    'dd',
    'del',
    'details',
    'div',
    'dl',
    'dt',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'ins',
    'kbd',
    'li',
    'mark',
    'ol',
    'p',
    'pre',
    's',
    'samp',
    'small',
    'strong',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
    'var',
  ],
};

purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const renderMarkdown = (text: string): string => {
  return purify.sanitize(marked.parse(text ?? '', { async: false }) as string, purifyConfig);
};

export const renderMarkdownInline = (text: string): string => {
  return purify.sanitize(marked.parseInline(text ?? '', { async: false }) as string, purifyConfig);
};
