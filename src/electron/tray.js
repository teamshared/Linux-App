// State management
const trayState = {
    habitsCompleted: false,
    focusSessionActive: false,
    // subscriptionActive: false
};

function updateUI() {
    const resumeBtn = document.getElementById('resume-habits');
    const focusBtn = document.getElementById('focus-session');
    const subBtn = document.getElementById('subscription');

    // Resume Habits Button - hide when completed
    resumeBtn.style.display = trayState.habitsCompleted ? 'none' : 'block';

    // Focus Session Button - change text and color
    if (trayState.focusSessionActive) {
        focusBtn.textContent = 'Stop Focus Session';
        focusBtn.className = 'tray-button active';
    } else {
        focusBtn.textContent = 'Start Focus Session';
        focusBtn.className = 'tray-button primary';
    }


}

// Button event handlers
function resumeHabits() {
    window.api?.resumeHabits?.();
    // Update state when habits are completed
    trayState.habitsCompleted = true;
    updateUI();
}

function openPreferences() {
    window.api?.showPreferences?.();
}

function openTodoList() {
    window.api?.openTodoList?.();
}

function toggleFocusSession() {
    trayState.focusSessionActive = !trayState.focusSessionActive;
    window.api?.toggleFocusSession?.(trayState.focusSessionActive);
    updateUI();
}

function quit() {
    window.api.showQuitDialog();
}

function upgrade() {
    window.api?.showUpgrade?.();
}

// Event listeners
function setupEventListeners() {
    document.getElementById('resume-habits').addEventListener('click', resumeHabits);
    document.getElementById('focus-session').addEventListener('click', toggleFocusSession);
    document.getElementById('subscription').addEventListener('click', upgrade);
}

// Initialize when DOM is loaded
function init() {
    setupEventListeners();
    updateUI();
    
    // Listen for state updates from main process
    if (window.api?.onStateUpdate) {
        window.api.onStateUpdate((newState) => {
            Object.assign(trayState, newState);
            updateUI();
        });
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);