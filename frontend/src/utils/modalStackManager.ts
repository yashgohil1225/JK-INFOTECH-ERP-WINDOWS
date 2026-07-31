// =============================================================
// JK INFOTECH ERP — Global Modal Stack Manager (LIFO Escape Handling)
// File : src/utils/modalStackManager.ts
// =============================================================

type CloseHandler = () => void;

interface StackItem {
  id: string;
  close: CloseHandler;
}

class ModalStackManagerClass {
  private stack: StackItem[] = [];

  /**
   * Registers an open modal onto the top of the LIFO stack.
   */
  register(id: string, close: CloseHandler) {
    this.unregister(id);
    this.stack.push({ id, close });
  }

  /**
   * Unregisters a closed modal from the stack.
   */
  unregister(id: string) {
    this.stack = this.stack.filter((item) => item.id !== id);
  }

  /**
   * Pops and closes the top-most (last opened) modal in reverse order.
   * Returns true if a modal was closed, false if the stack was empty.
   */
  popAndClose(): boolean {
    if (this.stack.length > 0) {
      const top = this.stack.pop();
      if (top && typeof top.close === "function") {
        try {
          top.close();
        } catch (err) {
          console.warn("ModalStackManager: Exception while closing top modal:", err);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Returns whether any modal is currently open.
   */
  hasOpenModals(): boolean {
    return this.stack.length > 0;
  }
}

export const ModalStackManager = new ModalStackManagerClass();
