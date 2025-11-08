import { supabase } from './supabase'
import type { AuthUser, AuthState } from '../types'
import type { User } from '@supabase/supabase-js'

type AuthStateListener = (state: AuthState) => void

class AuthService {
    private listeners: Set<AuthStateListener>

    private state: AuthState

    constructor() {
        this.listeners = new Set()
        this.state = {
            user: null,
            session: null,
            loading: true,
            error: null
        }
        this.initialize()
    }

    private async initialize() {
        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
            this.setState({ loading: false, error: error.message })
            return
        }

        if (session) {
            this.setState({
                user: this.transformUser(session.user),
                session,
                loading: false,
                error: null
            })
        } else {
            this.setState({ loading: false })
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
            this.setState({
                user: session ? this.transformUser(session.user) : null,
                session,
                loading: false,
                error: null
            })
        })
    }

    private transformUser(user: User): AuthUser {
        return {
            id: user.id,
            email: user.email,
            username: user.user_metadata?.user_name || user.user_metadata?.name,
            avatar_url: user.user_metadata?.avatar_url
        }
    }

    private setState(partial: Partial<AuthState>) {
        this.state = { ...this.state, ...partial }
        this.notifyListeners()
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.state))
    }

    // Subscribe to auth state changes
    subscribe(listener: AuthStateListener): () => void {
        this.listeners.add(listener)
        listener(this.state) // Call immediately with current state
        return () => this.listeners.delete(listener)
    }

    // Get current state
    getState(): AuthState {
        return this.state
    }

    // Sign in with GitHub
    async signInWithGitHub() {
        this.setState({ loading: true, error: null })

        const base = window.location.origin + import.meta.env.BASE_URL
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: `${base}upload.html`
            }
        })

        if (error) {
            this.setState({ loading: false, error: error.message })
            throw error
        }
    }

    // Sign out
    async signOut() {
        this.setState({ loading: true, error: null })

        const { error } = await supabase.auth.signOut()

        if (error) {
            this.setState({ loading: false, error: error.message })
            throw error
        }

        this.setState({
            user: null,
            session: null,
            loading: false,
            error: null
        })
    }

    // Check if user is authenticated
    isAuthenticated(): boolean {
        return !!this.state.session
    }

    // Get current user
    getCurrentUser(): AuthUser | null {
        return this.state.user
    }
}

// Export singleton instance
export const authService = new AuthService()
