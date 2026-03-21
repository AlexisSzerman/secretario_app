// Informes.jsx - CON VISTA INFORME S-1
// Copiar a: src/components/Informes.jsx (REEMPLAZAR)

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Upload, Edit, PieChart, Star, Calendar, Lock, CheckCircle, Info, FileText } from 'lucide-react'
import { getMesVencido, getMesNombre, esMesVencido } from '../utils/dateUtils'
import { db } from '../lib/supabase'
import VistaCapturaInformes from './VistaCapturaInformes'
import VistaEstadisticas from './VistaEstadisticas'
import VistaPrecursores from './VistaPrecursores'
import VistaAnoServicio from './VistaAnoServicio'
import ImportInformesModal from './ImportInformesModal'
import VistaInformeS1 from './VistaInformeS1'

export default function Informes({ publicadores, onReload }) {
  const mesVencidoActual = getMesVencido()
  const [mesActual, setMesActual] = useState(mesVencidoActual)
  const [informes, setInformes] = useState([])
  const [loading, setLoading] = useState(true)
  const [vistaActual, setVistaActual] = useState('captura')
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    loadInformes()
  }, [mesActual])

  const loadInformes = async () => {
    setLoading(true)
    try {
      const data = await db.getInformesByMesAno(mesActual.mes, mesActual.ano)
      setInformes(data || [])
    } catch (error) {
      console.error('Error cargando informes:', error)
    } finally {
      setLoading(false)
    }
  }

  const cambiarMes = (direccion) => {
    setMesActual(prev => {
      let nuevoMes = prev.mes + direccion
      let nuevoAno = prev.ano
      
      if (nuevoMes > 12) {
        nuevoMes = 1
        nuevoAno++
      } else if (nuevoMes < 1) {
        nuevoMes = 12
        nuevoAno--
      }
      
      return { mes: nuevoMes, ano: nuevoAno }
    })
  }

  const publicadoresActivos = publicadores.filter(p => {
    // Excluir inactivos
    if (p.tipo_servicio === 'Inactivo') return false
    
    // Excluir mudados (si la fecha de mudanza es anterior al mes actual)
    if (p.fecha_mudanza) {
      const fechaSalida = new Date(p.fecha_mudanza)
      const fechaMesActual = new Date(mesActual.ano, mesActual.mes - 1, 1)
      if (fechaSalida < fechaMesActual) return false
    }
    
    return true
  })
  const esDisponible = esMesVencido(mesActual.mes, mesActual.ano)
  const esMesFuturo = !esDisponible
  const porcentaje = publicadoresActivos.length > 0
    ? Math.round((informes.length / publicadoresActivos.length) * 100)
    : 0

  if (publicadores.length === 0 || publicadoresActivos.length === 0) {
    return (
      <div className="card p-12 text-center animate-fade-in">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-slate-100 rounded-full">
            <AlertCircle className="text-slate-600" size={48} />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Sin Publicadores Activos</h2>
        <p className="text-slate-600 mb-6">Primero debes importar publicadores activos</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header con selector de mes y vista */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => cambiarMes(-1)}
              className="btn-secondary p-2"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="text-center">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  {getMesNombre(mesActual.mes)} {mesActual.ano}
                </h2>
                {esMesFuturo && (
                  <span className="badge badge-red text-xs">
                    <Lock size={14} />
                    No disponible
                  </span>
                )}
                {esDisponible && mesActual.mes === mesVencidoActual.mes && mesActual.ano === mesVencidoActual.ano && (
                  <span className="badge badge-green text-xs">
                    <CheckCircle size={14} />
                    Mes actual
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-1">
                {informes.length} de {publicadoresActivos.length} informes • {porcentaje}%
              </p>
            </div>
            
            <button 
              onClick={() => cambiarMes(1)}
              className="btn-secondary p-2"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Botones de vista */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setVistaActual('captura')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 ${
                vistaActual === 'captura'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Edit size={16} />
              Captura
            </button>
            <button
              onClick={() => setVistaActual('estadisticas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 ${
                vistaActual === 'estadisticas'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <PieChart size={16} />
              Estadísticas
            </button>
            <button
              onClick={() => setVistaActual('precursores')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 ${
                vistaActual === 'precursores'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Star size={16} />
              Precursores
            </button>
            <button
              onClick={() => setVistaActual('anoservicio')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 ${
                vistaActual === 'anoservicio'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar size={16} />
              Año Servicio
            </button>
            {/* NUEVO: Vista Informe S-1 */}
            <button
              onClick={() => setVistaActual('informes1')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 ${
                vistaActual === 'informes1'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <FileText size={16} />
              Informe S-1
            </button>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-4">
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div 
              className="bg-slate-900 h-3 rounded-full transition-all duration-500"
              style={{ width: `${porcentaje}%` }}
            ></div>
          </div>
        </div>

        {/* Alerta de mes futuro */}
        {esMesFuturo && vistaActual === 'captura' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <Info size={16} />
              <span>
                Los informes de <strong>{getMesNombre(mesActual.mes)} {mesActual.ano}</strong> estarán disponibles 
                a partir del <strong>1 de {getMesNombre(mesActual.mes === 12 ? 1 : mesActual.mes + 1)}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Botón de importar */}
        {vistaActual === 'captura' && esDisponible && (
          <div className="mt-4 flex gap-2">
            <button 
              onClick={() => setShowImportModal(true)}
              className="btn-secondary"
            >
              <Upload size={16} />
              Importar Excel del Mes
            </button>
          </div>
        )}
      </div>

      {/* Vistas */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando informes...</p>
        </div>
      ) : (
        <>
          {vistaActual === 'captura' && (
            <VistaCapturaInformes 
              publicadores={publicadores}
              informes={informes}
              mesActual={mesActual}
              onReload={loadInformes}
              esDisponible={esDisponible}
            />
          )}
          
          {vistaActual === 'estadisticas' && (
            <VistaEstadisticas 
              publicadores={publicadores}
              informes={informes}
              mesActual={mesActual}
            />
          )}
          
          {vistaActual === 'precursores' && (
            <VistaPrecursores 
              publicadores={publicadores}
              informes={informes}
              mesActual={mesActual}
            />
          )}
          
          {vistaActual === 'anoservicio' && (
            <VistaAnoServicio 
              publicadores={publicadores}
            />
          )}

          {/* NUEVO: Vista Informe S-1 */}
          {vistaActual === 'informes1' && (
            <VistaInformeS1
              publicadores={publicadores}
              informes={informes}
              mesActual={mesActual}
            />
          )}
        </>
      )}

      {/* Modal de importación */}
      {showImportModal && (
        <ImportInformesModal
          onClose={() => setShowImportModal(false)}
          publicadores={publicadores}
          mesActual={mesActual}
          onImport={() => {
            setShowImportModal(false)
            loadInformes()
          }}
        />
      )}
    </div>
  )
}
