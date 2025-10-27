import { pdfService } from '../lib/pdf'
import { commentsService } from '../lib/comments'
import type { PDF, Comment } from '../types'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker - use the bundled worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// DOM Elements
const loadingEl = document.getElementById('loading') as HTMLDivElement
const errorEl = document.getElementById('error') as HTMLDivElement
const reviewContentEl = document.getElementById('review-content') as HTMLDivElement
const addCommentBtn = document.getElementById('add-comment-btn') as HTMLButtonElement
const commentsListEl = document.getElementById('comments-list') as HTMLDivElement
const commentCountEl = document.getElementById('comment-count') as HTMLSpanElement
const prevPageBtn = document.getElementById('prev-page') as HTMLButtonElement
const nextPageBtn = document.getElementById('next-page') as HTMLButtonElement
const pageInfoEl = document.getElementById('page-info') as HTMLSpanElement
const zoomInBtn = document.getElementById('zoom-in') as HTMLButtonElement
const zoomOutBtn = document.getElementById('zoom-out') as HTMLButtonElement
const zoomLevelEl = document.getElementById('zoom-level') as HTMLSpanElement
const pdfCanvasEl = document.getElementById('pdf-canvas') as HTMLCanvasElement
const pdfContainerEl = document.getElementById('pdf-container') as HTMLDivElement
const pinLayerEl = document.getElementById('pin-layer') as HTMLDivElement
const commentModalEl = document.getElementById('comment-modal') as HTMLDivElement
const modalCloseBtn = document.getElementById('modal-close') as HTMLButtonElement
const commentFormEl = document.getElementById('comment-form') as HTMLDivElement
const authorNameInput = document.getElementById('author-name') as HTMLInputElement
const commentTextArea = document.getElementById('comment-text') as HTMLTextAreaElement
const charCountEl = document.getElementById('char-count') as HTMLSpanElement
const cancelCommentBtn = document.getElementById('cancel-comment') as HTMLButtonElement
const submitCommentBtn = document.getElementById('submit-comment') as HTMLButtonElement

// State
let currentPDF: PDF | null = null
let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null
let currentPage = 1
let totalPages = 1
let currentZoom = 1.0
let comments: Comment[] = []
let isPlacingPin = false
let tempPinPosition: { x: number; y: number; page: number } | null = null
let activeCommentId: string | null = null

// Show/hide elements
function showError(message: string) {
    errorEl.textContent = message
    errorEl.classList.remove('hidden')
    loadingEl.classList.add('hidden')
}

function hideError() {
    errorEl.classList.add('hidden')
}

// Initialize - get share token from URL
async function initialize() {
    const urlParams = new URLSearchParams(window.location.search)
    const shareToken = urlParams.get('token')

    if (!shareToken) {
        showError('Invalid or missing share token')
        return
    }

    try {
        // Fetch PDF by share token
        currentPDF = await pdfService.getPDFByShareToken(shareToken)

        if (!currentPDF) {
            showError('Resume not found. The link may be invalid or expired.')
            return
        }

        // Load PDF document
        await loadPDF()

        // Load comments
        await loadComments()

        // Subscribe to real-time comments
        commentsService.subscribeToComments(currentPDF.id, (updatedComments) => {
            comments = updatedComments
            renderComments()
        })

        // Show content
        loadingEl.classList.add('hidden')
        reviewContentEl.classList.remove('hidden')
        addCommentBtn.disabled = false

    } catch (error) {
        console.error('Initialization error:', error)
        showError(error instanceof Error ? error.message : 'Failed to load resume')
    }
}

// Load PDF document
async function loadPDF() {
    if (!currentPDF) return

    const pdfUrl = pdfService.getPDFUrl(currentPDF.file_path)

    const loadingTask = pdfjsLib.getDocument(pdfUrl)
    pdfDocument = await loadingTask.promise
    totalPages = pdfDocument.numPages

    await renderPage(currentPage)
    updatePageInfo()
}

// Render PDF page
async function renderPage(pageNum: number) {
    if (!pdfDocument) return

    const page = await pdfDocument.getPage(pageNum)
    const viewport = page.getViewport({ scale: currentZoom * 1.5 })

    const canvas = pdfCanvasEl
    const context = canvas.getContext('2d')!

    canvas.width = viewport.width
    canvas.height = viewport.height

    // Update pin layer size and position
    pinLayerEl.style.width = `${viewport.width}px`
    pinLayerEl.style.height = `${viewport.height}px`

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    }

    await page.render(renderContext).promise

    // Re-render pins for current page
    renderPins()
}

// Update page info and button states
function updatePageInfo() {
    pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`
    prevPageBtn.disabled = currentPage === 1
    nextPageBtn.disabled = currentPage === totalPages
}

// Load comments from database
async function loadComments() {
    if (!currentPDF) return
    comments = await commentsService.getCommentsByPDFId(currentPDF.id)
    renderComments()
}

// Render comments in sidebar
function renderComments() {
    commentCountEl.textContent = comments.length.toString()

    if (comments.length === 0) {
        commentsListEl.innerHTML = '<p class="no-comments">No comments yet. Be the first to leave feedback!</p>'
        return
    }

    commentsListEl.innerHTML = comments
        .map((comment, index) => `
      <div class="comment-item ${comment.id === activeCommentId ? 'active' : ''}" data-comment-id="${comment.id}" data-page="${comment.page}">
        <div class="comment-header">
          <span class="comment-author">${comment.author_name || 'Anonymous'}</span>
          <span class="comment-page">Page ${comment.page}</span>
        </div>
        <p class="comment-text">${escapeHtml(comment.text)}</p>
        <p class="comment-time">${commentsService.formatTimestamp(comment.created_at)}</p>
      </div>
    `)
        .join('')

    // Add click handlers to jump to comment
    document.querySelectorAll('.comment-item').forEach(el => {
        el.addEventListener('click', () => {
            const commentId = el.getAttribute('data-comment-id')!
            const page = parseInt(el.getAttribute('data-page')!)
            jumpToComment(commentId, page)
        })
    })
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// Render pins on PDF
function renderPins() {
    const pageComments = comments.filter(c => c.page === currentPage)

    pinLayerEl.innerHTML = pageComments
        .map((comment, index) => {
            const pinNumber = comments.findIndex(c => c.id === comment.id) + 1
            return `
        <div 
          class="pin ${comment.id === activeCommentId ? 'active' : ''}" 
          data-comment-id="${comment.id}"
          data-number="${pinNumber}"
          style="left: ${comment.x}px; top: ${comment.y}px;">
        </div>
      `
        })
        .join('')

    // Add click handlers to pins
    document.querySelectorAll('.pin').forEach(el => {
        el.addEventListener('click', () => {
            const commentId = el.getAttribute('data-comment-id')!
            highlightComment(commentId)
        })
    })
}

// Jump to comment and highlight
function jumpToComment(commentId: string, page: number) {
    if (page !== currentPage) {
        currentPage = page
        renderPage(currentPage).then(() => {
            updatePageInfo()
            highlightComment(commentId)
        })
    } else {
        highlightComment(commentId)
    }
}

// Highlight a comment
function highlightComment(commentId: string) {
    activeCommentId = commentId
    renderComments()
    renderPins()
}

// Page navigation
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--
        renderPage(currentPage)
        updatePageInfo()
    }
})

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++
        renderPage(currentPage)
        updatePageInfo()
    }
})

// Zoom controls
zoomInBtn.addEventListener('click', () => {
    if (currentZoom < 2.0) {
        currentZoom += 0.25
        zoomLevelEl.textContent = `${Math.round(currentZoom * 100)}%`
        renderPage(currentPage)
    }
})

zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > 0.5) {
        currentZoom -= 0.25
        zoomLevelEl.textContent = `${Math.round(currentZoom * 100)}%`
        renderPage(currentPage)
    }
})

// Add comment button
addCommentBtn.addEventListener('click', () => {
    openCommentModal()
})

// Modal controls
function openCommentModal() {
    commentModalEl.classList.remove('hidden')
    commentFormEl.classList.add('hidden')
    isPlacingPin = true
    pdfContainerEl.classList.add('placing-pin')
    tempPinPosition = null
}

function closeCommentModal() {
    commentModalEl.classList.add('hidden')
    isPlacingPin = false
    pdfContainerEl.classList.remove('placing-pin')
    tempPinPosition = null
    authorNameInput.value = ''
    commentTextArea.value = ''
    charCountEl.textContent = '0'

    // Remove temporary pin if exists
    const tempPin = document.querySelector('.pin.placing')
    if (tempPin) tempPin.remove()
}

modalCloseBtn.addEventListener('click', closeCommentModal)

// Close modal when clicking outside
commentModalEl.addEventListener('click', (e) => {
    if (e.target === commentModalEl) {
        closeCommentModal()
    }
})

// Place pin on PDF click
pdfCanvasEl.addEventListener('click', (e) => {
    if (!isPlacingPin) return

    const rect = pdfCanvasEl.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    tempPinPosition = { x, y, page: currentPage }

    // Show temporary pin
    const tempPin = document.createElement('div')
    tempPin.className = 'pin placing'
    tempPin.style.left = `${x}px`
    tempPin.style.top = `${y}px`
    tempPin.setAttribute('data-number', '📍')
    pinLayerEl.appendChild(tempPin)

    // Show comment form
    commentFormEl.classList.remove('hidden')
    commentTextArea.focus()

    // Stop placing pin mode but keep modal open
    isPlacingPin = false
    pdfContainerEl.classList.remove('placing-pin')
})

// Character count
commentTextArea.addEventListener('input', () => {
    const length = commentTextArea.value.length
    charCountEl.textContent = length.toString()
})

// Cancel comment
cancelCommentBtn.addEventListener('click', () => {
    closeCommentModal()
})

// Submit comment
submitCommentBtn.addEventListener('click', async () => {
    if (!tempPinPosition || !currentPDF) return

    const text = commentTextArea.value.trim()
    if (!text) {
        alert('Please enter a comment')
        return
    }

    try {
        submitCommentBtn.disabled = true
        submitCommentBtn.textContent = 'Submitting...'

        await commentsService.createComment({
            pdf_id: currentPDF.id,
            x: tempPinPosition.x,
            y: tempPinPosition.y,
            page: tempPinPosition.page,
            text: text,
            author_name: authorNameInput.value.trim() || undefined
        })

        // Reload comments
        await loadComments()

        closeCommentModal()

    } catch (error) {
        console.error('Failed to submit comment:', error)
        alert(error instanceof Error ? error.message : 'Failed to submit comment')
    } finally {
        submitCommentBtn.disabled = false
        submitCommentBtn.textContent = 'Submit Comment'
    }
})

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape' && !commentModalEl.classList.contains('hidden')) {
        closeCommentModal()
    }

    // Arrow keys for navigation (when modal is closed)
    if (commentModalEl.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft' && currentPage > 1) {
            prevPageBtn.click()
        } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
            nextPageBtn.click()
        }
    }
})

// Initialize on page load
initialize()
