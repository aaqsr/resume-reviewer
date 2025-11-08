import { supabase } from './supabase'
import type { PDF } from '../types'

interface UploadProgress {
    loaded: number
    total: number
    percentage: number
}

type ProgressCallback = (progress: UploadProgress) => void

class PDFService {
    /**
     * Upload a PDF file to Supabase storage and create a database record
     */
    async uploadPDF(
        file: File,
        userId: string,
        onProgress?: ProgressCallback
    ): Promise<PDF> {
        try {
            // Generate a unique file path: userId/timestamp-filename
            const timestamp = Date.now()
            const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const filePath = `${userId}/${timestamp}-${sanitizedFilename}`

            // Simulate progress for better UX (Supabase doesn't provide upload progress)
            if (onProgress) {
                const simulateProgress = () => {
                    let progress = 0
                    const interval = setInterval(() => {
                        progress += 10
                        if (progress >= 90) {
                            clearInterval(interval)
                        }
                        onProgress({
                            loaded: (file.size * progress) / 100,
                            total: file.size,
                            percentage: progress
                        })
                    }, 100)
                    return interval
                }
                var progressInterval = simulateProgress()
            }

            // Upload file to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('resumes')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            // TODO: fix this
            // if (progressInterval) {
            //     clearInterval(progressInterval)
            //     if (onProgress) {
            //         onProgress({ loaded: file.size, total: file.size, percentage: 100 })
            //     }
            // }

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`)
            }

            // Create database record
            const { data: pdfData, error: dbError } = await supabase
                .from('pdfs')
                .insert({
                    user_id: userId,
                    filename: file.name,
                    file_path: uploadData.path
                })
                .select()
                .single()

            if (dbError) {
                // Clean up uploaded file if database insert fails
                await supabase.storage.from('resumes').remove([filePath])
                throw new Error(`Database error: ${dbError.message}`)
            }

            return pdfData as PDF
        } catch (error) {
            console.error('Upload error:', error)
            throw error
        }
    }

    /**
     * Get all PDFs for the current user
     */
    async getUserPDFs(userId: string): Promise<PDF[]> {
        const { data, error } = await supabase
            .from('pdfs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (error) {
            throw new Error(`Failed to fetch PDFs: ${error.message}`)
        }

        return data as PDF[]
    }

    /**
     * Get a PDF by its share token (for anonymous access)
     */
    async getPDFByShareToken(shareToken: string): Promise<PDF | null> {
        const { data, error } = await supabase
            .from('pdfs')
            .select('*')
            .eq('share_token', shareToken)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // Not found
                return null
            }
            throw new Error(`Failed to fetch PDF: ${error.message}`)
        }

        return data as PDF
    }

    /**
     * Get the public URL for a PDF file
     */
    getPDFUrl(filePath: string): string {
        const { data } = supabase.storage
            .from('resumes')
            .getPublicUrl(filePath)

        return data.publicUrl
    }

    /**
     * Generate a shareable link for a PDF
     */
    getShareableLink(shareToken: string): string {
        return `${window.location.origin}/review.html?token=${shareToken}`
    }

    /**
     * Delete a PDF and its storage file
     */
    async deletePDF(pdfId: string, filePath: string): Promise<void> {
        // Delete from database first (this will cascade delete comments due to foreign key)
        const { error: dbError } = await supabase
            .from('pdfs')
            .delete()
            .eq('id', pdfId)

        if (dbError) {
            throw new Error(`Failed to delete PDF from database: ${dbError.message}`)
        }

        // Delete from storage
        const { error: storageError } = await supabase.storage
            .from('resumes')
            .remove([filePath])

        if (storageError) {
            console.error('Failed to delete file from storage:', storageError)
            // Don't throw here since database deletion succeeded
            // The orphaned file in storage is less critical
        }
    }
}

// Export singleton instance
export const pdfService = new PDFService()

// Also export for upload.ts integration
export type { UploadProgress, ProgressCallback }
