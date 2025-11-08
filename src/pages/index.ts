import { authService } from '../lib/auth'

// DOM Elements
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement
const loadingEl = document.getElementById('loading') as HTMLDivElement
const errorEl = document.getElementById('error') as HTMLDivElement

// Show/hide elements
function showLoading(show: boolean) {
    loadingEl.classList.toggle('hidden', !show)
    loginBtn.classList.toggle('hidden', show)
}

function showError(message: string | null) {
    if (message) {
        errorEl.textContent = message
        errorEl.classList.remove('hidden')
    } else {
        errorEl.classList.add('hidden')
    }
}

// Handle login
loginBtn.addEventListener('click', async () => {
    try {
        showLoading(true)
        showError(null)
        await authService.signInWithGitHub()
        // OAuth will redirect, so we stay in loading state
    } catch (error) {
        showLoading(false)
        showError(error instanceof Error ? error.message : 'Failed to sign in')
    }
})

// Check if already authenticated (redirect from OAuth)
authService.subscribe((state) => {
    if (!state.loading && state.user) {
        // Already authenticated, redirect to upload page
        window.location.href = './upload.html'
    }

    if (state.error) {
        showLoading(false)
        showError(state.error)
    }
})
