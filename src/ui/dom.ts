/** Parses one HTML snippet with a single root element. */
export function html<T extends HTMLElement = HTMLElement>(markup: string): T {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as T;
}

export type Show = (el: Element, value: string, prop?: 'textContent' | 'title') => void;

/** Sets a property only when it changed, so per-frame refreshes stay cheap. */
export function createShow(): Show {
  const shown = new WeakMap<Element, Map<string, string>>();
  return (el, value, prop = 'textContent') => {
    let props = shown.get(el);
    if (!props) shown.set(el, (props = new Map()));
    if (props.get(prop) === value) return;
    props.set(prop, value);
    (el as HTMLElement)[prop] = value;
  };
}

/** Sets `hidden` / `disabled` only when it changed (no DOM churn per frame). */
export function setFlag(el: Element, prop: 'hidden' | 'disabled', value: boolean): void {
  const target = el as HTMLElement & { disabled?: boolean };
  if (target[prop] !== value) target[prop] = value;
}

export function setClass(el: Element, name: string, on: boolean): void {
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}
