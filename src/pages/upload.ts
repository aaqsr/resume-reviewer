import { authService } from '../lib/auth'

// DOM Elements
const authLoadingEl = document.getElementById('auth-loading') as HTMLDivElement
const uploadSectionEl = document.getElementById('upload-section') as HTMLDivElement
const userInfoEl = document.getElementById('user-info') as HTMLDivElement
const userAvatarEl = document.getElementById('user-avatar') as HTMLImageElement
const userNameEl = document.getElementById('user-name') as HTMLSpanElement
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement
const uploadArea = document.getElementById('upload-area') as HTMLDivElement
const fileInput = document.getElementById('file-input') as HTMLInputElement
const fileInfoEl = document.getElementById('file-info') as HTMLDivElement
const fileNameEl = document.getElementById('file-name') as HTMLParagraphElement
const fileSizeEl = document.getElementById('file-size') as HTMLParagraphElement
const uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement
const errorEl = document.getElementById('error') as HTMLDivElement

let selectedFile: File | null = null

// Show/hide elements
function showError(message: string | null) {
    if (message) {
        errorEl.textContent = message
        errorEl.classList.remove('hidden')
    } else {
        errorEl.classList.add('hidden')
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Handle file selection
function handleFileSelect(file: File) {
    // Validate file
    if (file.type !== 'application/pdf') {
        showError('Please select a PDF file')
        return
    }

    if (file.size > 5 * 1024 * 1024) {
        showError('File size must be less than 5MB')
        return
    }

    selectedFile = file
    fileNameEl.textContent = file.name
    fileSizeEl.textContent = formatFileSize(file.size)
    fileInfoEl.classList.remove('hidden')
    showError(null)
}

// Click to upload
uploadArea.addEventListener('click', () => {
    fileInput.click()
})

fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) handleFileSelect(file)
})

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault()
    uploadArea.classList.add('drag-over')
})

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over')
})

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault()
    uploadArea.classList.remove('drag-over')
    const file = e.dataTransfer?.files[0]
    if (file) handleFileSelect(file)
})

// Handle upload (stub for now)
uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return

    try {
        showError(null)
        uploadBtn.disabled = true
        uploadBtn.textContent = 'Uploading...'

        // TODO: Implement actual upload to Supabase
        console.log('Would upload:', selectedFile.name)

        // For now, just show success after a delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        alert('Upload functionality will be implemented in the next step!')

    } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to upload')
    } finally {
        uploadBtn.disabled = false
        uploadBtn.textContent = 'Upload Resume'
    }
})

// Handle logout
logoutBtn.addEventListener('click', async () => {
    try {
        await authService.signOut()
        window.location.href = '/'
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to sign out')
    }
})

// Auth state management
authService.subscribe((state) => {
    if (state.loading) {
        authLoadingEl.classList.remove('hidden')
        uploadSectionEl.classList.add('hidden')
        return
    }

    authLoadingEl.classList.add('hidden')

    if (!state.user) {
        // Not authenticated, redirect to login
        window.location.href = '/'
        return
    }

    // Show upload section
    uploadSectionEl.classList.remove('hidden')

    // Show user info
    if (state.user.avatar_url) {
        userAvatarEl.src = state.user.avatar_url
        userAvatarEl.alt = state.user.username || 'User'
    }
    userNameEl.textContent = state.user.username || state.user.email || 'User'
    userInfoEl.classList.remove('hidden')
    logoutBtn.classList.remove('hidden')
})
