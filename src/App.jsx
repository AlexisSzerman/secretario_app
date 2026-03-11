// App.jsx - CON AUTENTICACIÓN
// Copiar a: src/App.jsx (REEMPLAZAR)

import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { db } from './lib/supabase'
import Dashboard from './components/Dashboard'
import Publicadores from './components/Publicadores'
import Informes from './components/Informes'
import VistaRecordatorios from './components/VistaRecordatorios'
import Navigation from './components/Navigation'
import Login from './components/Login'
import { LogOut } from 'lucide-react'

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [currentView, setCurrentView] = useState('dashboard')
  const [publicadores, setPublicadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      loadPublicadores()
    }
  }, [user])

  const loadPublicadores = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await db.getAllPublicadores()
      setPublicadores(data || [])
    } catch (err) {
      console.error('Error cargando publicadores:', err)
      setError('Error al cargar los datos. Verifica tu conexión a Supabase.')
    } finally {
      setLoading(false)
    }
  }

  // Loading autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  // Si no está autenticado, mostrar login
  if (!user) {
    return <Login />
  }

  // Loading datos
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-6 max-w-md">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2 text-center">Error de Conexión</h2>
          <p className="text-slate-600 mb-4 text-center">{error}</p>
          <button 
            onClick={loadPublicadores}
            className="btn-primary w-full"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // App principal
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Secretario Congregacional
            </h1>
            
            {/* Botón de Logout */}
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <Dashboard publicadores={publicadores} />
        )}
        
        {currentView === 'publicadores' && (
          <Publicadores 
            publicadores={publicadores}
            onReload={loadPublicadores}
          />
        )}
        
        {currentView === 'informes' && (
          <Informes 
            publicadores={publicadores}
            onReload={loadPublicadores}
          />
        )}
        
        {currentView === 'recordatorios' && (
          <VistaRecordatorios />
        )}
      </main>

      {/* Navigation */}
      <Navigation 
        currentView={currentView}
        onViewChange={setCurrentView}
      />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
