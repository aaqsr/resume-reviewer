import { authService } from '../lib/auth'
import { pdfService } from '../lib/pdf'
import type { PDF } from '../types'

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
const uploadProgressEl = document.getElementById('upload-progress') as HTMLDivElement
const progressFillEl = document.getElementById('progress-fill') as HTMLDivElement
const progressTextEl = document.getElementById('progress-text') as HTMLParagraphElement
const successSectionEl = document.getElementById('success-section') as HTMLDivElement
const shareLinkEl = document.getElementById('share-link') as HTMLInputElement
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement
const uploadAnotherBtn = document.getElementById('upload-another') as HTMLButtonElement
const errorEl = document.getElementById('error') as HTMLDivElement
const existingResumeEl = document.getElementById('existing-resume') as HTMLDivElement
const existingFilenameEl = document.getElementById('existing-filename') as HTMLParagraphElement
const existingShareLinkEl = document.getElementById('existing-share-link') as HTMLInputElement
const existingCopyBtn = document.getElementById('existing-copy-btn') as HTMLButtonElement
const viewResumeBtn = document.getElementById('view-resume-btn') as HTMLButtonElement
const deleteResumeBtn = document.getElementById('delete-resume-btn') as HTMLButtonElement
const replaceResumeBtn = document.getElementById('replace-resume-btn') as HTMLButtonElement

let selectedFile: File | null = null
let existingPDF: PDF | null = null

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

function resetUploadForm() {
    selectedFile = null
    fileInput.value = ''
    fileInfoEl.classList.add('hidden')
    uploadProgressEl.classList.add('hidden')
    successSectionEl.classList.add('hidden')
    uploadArea.classList.remove('hidden')
    showError(null)
}

function showExistingResume(pdf: PDF) {
    existingPDF = pdf
    existingFilenameEl.textContent = pdf.filename
    const shareLink = pdfService.getShareableLink(pdf.share_token)
    existingShareLinkEl.value = shareLink

    existingResumeEl.classList.remove('hidden')
    uploadArea.classList.add('hidden')
    fileInfoEl.classList.add('hidden')
}

function hideExistingResume() {
    existingResumeEl.classList.add('hidden')
    uploadArea.classList.remove('hidden')
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

// Handle upload
async function performUpload() {
    if (!selectedFile) return

    const user = authService.getCurrentUser()
    if (!user) {
        showError('You must be logged in to upload')
        return
    }

    try {
        showError(null)
        uploadBtn.disabled = true

        // If replacing, delete the old one first
        if (existingPDF) {
            await pdfService.deletePDF(existingPDF.id, existingPDF.file_path)
        }

        // Hide file info and show progress
        fileInfoEl.classList.add('hidden')
        uploadProgressEl.classList.remove('hidden')

        // Upload the file
        const pdf = await pdfService.uploadPDF(
            selectedFile,
            user.id,
            (progress) => {
                const percentage = Math.round(progress.percentage)
                progressFillEl.style.width = `${percentage}%`
                progressTextEl.textContent = `Uploading... ${percentage}%`
            }
        )

        // Show success with shareable link
        const shareLink = pdfService.getShareableLink(pdf.share_token)
        shareLinkEl.value = shareLink

        uploadProgressEl.classList.add('hidden')
        successSectionEl.classList.remove('hidden')

        existingPDF = pdf

    } catch (error) {
        console.error('Upload error:', error)
        showError(error instanceof Error ? error.message : 'Failed to upload resume')
        uploadProgressEl.classList.add('hidden')
        fileInfoEl.classList.remove('hidden')
    } finally {
        uploadBtn.disabled = false
    }
}

uploadBtn.addEventListener('click', performUpload)

// Copy share link (success section)
copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(shareLinkEl.value)
        const originalText = copyBtn.textContent
        copyBtn.textContent = 'Copied!'
        setTimeout(() => {
            copyBtn.textContent = originalText
        }, 2000)
    } catch (error) {
        showError('Failed to copy link')
    }
})

// Copy share link (existing resume)
existingCopyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(existingShareLinkEl.value)
        const originalText = existingCopyBtn.textContent
        existingCopyBtn.textContent = 'Copied!'
        setTimeout(() => {
            existingCopyBtn.textContent = originalText
        }, 2000)
    } catch (error) {
        showError('Failed to copy link')
    }
})

// View resume button
viewResumeBtn.addEventListener('click', () => {
    if (existingPDF) {
        const shareLink = pdfService.getShareableLink(existingPDF.share_token)
        window.open(shareLink, '_blank')
    }
})

// Delete resume button
deleteResumeBtn.addEventListener('click', async () => {
    if (!existingPDF) return

    if (!confirm('Are you sure you want to delete this resume? This will also delete all comments.')) {
        return
    }

    try {
        deleteResumeBtn.disabled = true
        deleteResumeBtn.textContent = 'Deleting...'

        await pdfService.deletePDF(existingPDF.id, existingPDF.file_path)

        existingPDF = null
        hideExistingResume()
        resetUploadForm()

    } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to delete resume')
    } finally {
        deleteResumeBtn.disabled = false
        deleteResumeBtn.textContent = 'Delete'
    }
})

// Replace resume button
replaceResumeBtn.addEventListener('click', () => {
    hideExistingResume()
    resetUploadForm()
})

// Upload another
uploadAnotherBtn.addEventListener('click', () => {
    if (existingPDF) {
        showExistingResume(existingPDF)
    } else {
        resetUploadForm()
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

// Check for existing resume
async function checkExistingResume(userId: string) {
    try {
        const pdfs = await pdfService.getUserPDFs(userId)
        if (pdfs.length > 0) {
            // Show the most recent resume
            showExistingResume(pdfs[0])
        }
    } catch (error) {
        console.error('Failed to check existing resume:', error)
        // Don't block the UI if checking fails
        // Just show the upload area
    }
}

// Auth state management
authService.subscribe(async (state) => {
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

    // Check for existing resume (don't await to avoid blocking)
    checkExistingResume(state.user.id).catch(err => {
        console.error('Error checking existing resume:', err)
    })
})
