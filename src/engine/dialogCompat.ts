let supportsDisplayTransition: boolean | undefined;

export function canTransitionDisplay(): boolean {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

export function supportsTopLayerExit(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
    canTransitionDisplay()
  );
}

export async function closeTopLayer(
  dialog: HTMLDialogElement | null,
  returnValue?: string
): Promise<void> {
  if (!dialog || !dialog.open) return;

  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 600)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }

  if (dialog.open) {
    dialog.close(returnValue);
  }
}

function isOutsideDialog(e: PointerEvent, dialog: HTMLDialogElement): boolean {
  const r = dialog.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

export function bindModernDialog(
  dialog: HTMLDialogElement,
  onClosed: (returnValue: string) => void
): () => void {
  const handleCancel = (event: Event) => {
    event.preventDefault();
    void closeTopLayer(dialog);
  };

  const handleClose = () => {
    const val = dialog.returnValue;
    dialog.returnValue = '';
    onClosed(val);
  };

  dialog.addEventListener('cancel', handleCancel);
  dialog.addEventListener('close', handleClose);

  let cleanupPointer: (() => void) | undefined;

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutsideDialog(e, dialog);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutsideDialog(e, dialog)) {
        void closeTopLayer(dialog);
      }
      pressedOutside = false;
    };
    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    cleanupPointer = () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }

  return () => {
    dialog.removeEventListener('cancel', handleCancel);
    dialog.removeEventListener('close', handleClose);
    cleanupPointer?.();
  };
}
