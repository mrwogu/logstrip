// Copy buttons on the landing page. A button with `data-copy="text"` copies that
// text and shows "copied" for two seconds. Without JavaScript the command is
// still on the page to select by hand.

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

/** Copies text and returns the label to show on the button. */
export async function copyText(text: string, clipboard: ClipboardLike | undefined): Promise<string> {
  try {
    if (!clipboard) throw new Error('clipboard unavailable');
    await clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'copy failed';
  }
}

export function initCopyButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
    const label = button.textContent;
    button.addEventListener('click', async () => {
      button.textContent = await copyText(button.dataset.copy ?? '', navigator.clipboard);
      setTimeout(() => (button.textContent = label), 2000);
    });
  });
}
