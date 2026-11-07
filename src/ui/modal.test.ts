import { describe, expect, it } from 'vitest';
import { dialogHtml, MODAL_STYLES } from './modal';

// Node environment (no DOM / layout): check the markup order and the CSS text.
// The visual check (no overlap at desktop and phone widths) is in the PR.

const popover = dialogHtml({
  kind: 'popover',
  id: 'x',
  title: 'Sound',
  closeLabel: 'Close',
  body: '<div class="row">first row</div>',
});

describe('dialogHtml popover', () => {
  it('has a title header before the rows', () => {
    const title = popover.indexOf('<h2 id="x-title">Sound</h2>');
    expect(title).toBeGreaterThan(-1);
    expect(title).toBeLessThan(popover.indexOf('class="row"'));
  });
});

describe('popover header styles', () => {
  const rule = /\.popover \.panel h2 \{([^}]*)\}/.exec(MODAL_STYLES)?.[1] ?? '';

  it('reserves the [X] zone with a header min-height', () => {
    // [X] is 34 px at top 8 px; the panel pads 14 px, so the header must reach 28 px.
    const min = /min-height:\s*(\d+)px/.exec(rule);
    expect(min).not.toBeNull();
    expect(Number(min![1])).toBeGreaterThanOrEqual(28);
  });

  it('keeps the 44 px phone [X] clear via the title line height', () => {
    // 4 px + 44 px close button, minus 14 px panel padding = 34 px <= 44 px line.
    expect(MODAL_STYLES).toMatch(/\.panel h2 \{ margin-right: 52px; line-height: 44px; \}/);
  });
});
