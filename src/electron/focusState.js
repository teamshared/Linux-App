class FocusState {
  constructor() {
    this.isFocusActive = false;
  }

  setActive(active) {
    this.isFocusActive = active;
  }

  isActive() {
    return this.isFocusActive;
  }
}

// Export a singleton instance
export const focusState = new FocusState();