import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 🔥 evita marcar loading varias veces
  const initialLoadDone = useRef(false)

  useEffect(() => {
    // 1. Obtener sesión inicial (UNA sola vez)
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      setUser(session?.user ?? null)
      setLoading(false)
      initialLoadDone.current = true
    }

    initSession()

    // 2. Escuchar cambios de auth
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null

      console.log('Auth event:', event)

      // 🔥 SOLO actualizar si realmente cambió el usuario
      setUser(prevUser => {
        if (prevUser?.id === newUser?.id) return prevUser
        return newUser
      })

      // 🔥 NO volver a activar loading después del primer load
      if (!initialLoadDone.current) {
        setLoading(false)
        initialLoadDone.current = true
      }
    })

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('Error en login:', error)
      return { data: null, error }
    }

    return { data, error: null }
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      console.error('Error en registro:', error)
      return { data: null, error }
    }

    return { data, error: null }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Error en logout:', error)
      return
    }

    setUser(null)
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}