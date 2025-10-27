import { supabase } from './supabase'
import type { Comment } from '../types'

interface CreateCommentParams {
    pdf_id: string
    x: number
    y: number
    page: number
    text: string
    author_name?: string
}

type CommentListener = (comments: Comment[]) => void

class CommentsService {
    private listeners: Map<string, Set<CommentListener>> = new Map()

    /**
     * Create a new comment
     */
    async createComment(params: CreateCommentParams): Promise<Comment> {
        const { data, error } = await supabase
            .from('comments')
            .insert({
                pdf_id: params.pdf_id,
                x: params.x,
                y: params.y,
                page: params.page,
                text: params.text,
                author_name: params.author_name || 'Anonymous'
            })
            .select()
            .single()

        if (error) {
            throw new Error(`Failed to create comment: ${error.message}`)
        }

        return data as Comment
    }

    /**
     * Get all comments for a PDF
     */
    async getCommentsByPDFId(pdfId: string): Promise<Comment[]> {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('pdf_id', pdfId)
            .order('created_at', { ascending: true })

        if (error) {
            throw new Error(`Failed to fetch comments: ${error.message}`)
        }

        return data as Comment[]
    }

    /**
     * Subscribe to real-time comment updates for a PDF
     */
    subscribeToComments(
        pdfId: string,
        listener: CommentListener
    ): () => void {
        // Add listener
        if (!this.listeners.has(pdfId)) {
            this.listeners.set(pdfId, new Set())
        }
        this.listeners.get(pdfId)!.add(listener)

        // Set up real-time subscription
        const channel = supabase
            .channel(`comments:${pdfId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'comments',
                    filter: `pdf_id=eq.${pdfId}`
                },
                async (payload) => {
                    // Fetch updated comments and notify all listeners
                    const comments = await this.getCommentsByPDFId(pdfId)
                    this.notifyListeners(pdfId, comments)
                }
            )
            .subscribe()

        // Return unsubscribe function
        return () => {
            this.listeners.get(pdfId)?.delete(listener)
            if (this.listeners.get(pdfId)?.size === 0) {
                this.listeners.delete(pdfId)
                supabase.removeChannel(channel)
            }
        }
    }

    /**
     * Notify all listeners for a PDF
     */
    private notifyListeners(pdfId: string, comments: Comment[]) {
        const listeners = this.listeners.get(pdfId)
        if (listeners) {
            listeners.forEach(listener => listener(comments))
        }
    }

    /**
     * Delete a comment (only for authenticated users who own the PDF)
     */
    async deleteComment(commentId: string): Promise<void> {
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId)

        if (error) {
            throw new Error(`Failed to delete comment: ${error.message}`)
        }
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const seconds = Math.floor(diff / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)

        if (seconds < 60) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`

        return date.toLocaleDateString()
    }
}

// Export singleton instance
export const commentsService = new CommentsService()
