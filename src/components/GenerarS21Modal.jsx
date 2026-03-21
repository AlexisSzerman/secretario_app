import { useState } from 'react'
import { X, Download, FileText, User } from 'lucide-react'
import { db } from '../lib/supabase'
import { getMesNombre, getAnoServicioActual, getMesesAnoServicio } from '../utils/dateUtils'
import jsPDF from 'jspdf'

export default function GenerarS21Modal({ publicadores, onClose }) {
  const [publicadorSeleccionado, setPublicadorSeleccionado] = useState('')
  const [anoServicioSeleccionado, setAnoServicioSeleccionado] = useState('')
  const [generando, setGenerando] = useState(false)

  const anoActual = getAnoServicioActual()
  const anosDisponibles = [
    anoActual,
    { nombre: `${parseInt(anoActual.nombre) - 1}`, label: `${parseInt(anoActual.nombre.split('-')[0]) - 1}-${parseInt(anoActual.nombre.split('-')[1]) - 1}` },
    { nombre: `${parseInt(anoActual.nombre) - 2}`, label: `${parseInt(anoActual.nombre.split('-')[0]) - 2}-${parseInt(anoActual.nombre.split('-')[1]) - 2}` }
  ]

  const publicadoresActivos = publicadores.filter(p => 
    p.tipo_servicio !== 'Inactivo' && !p.fecha_mudanza
  ).sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`))

  const generarPDF = async () => {
    if (!publicadorSeleccionado || !anoServicioSeleccionado) {
      alert('Selecciona un publicador y año de servicio')
      return
    }

    setGenerando(true)
    try {
      const publicador = publicadores.find(p => p.id === publicadorSeleccionado)
      const anoServicio = anosDisponibles.find(a => a.nombre === anoServicioSeleccionado)
      
      const mesesAno = getMesesAnoServicio(anoServicio)
      
      const informesPromises = mesesAno.map(m => 
        db.getInformesByMesAno(m.mes, m.ano)
      )
      const todosLosInformes = await Promise.all(informesPromises)
      
      const informesPorMes = {}
      mesesAno.forEach((mesInfo, idx) => {
        const informeDelPublicador = todosLosInformes[idx].find(inf => inf.publicador_id === publicador.id)
        informesPorMes[mesInfo.mes] = informeDelPublicador
      })

      crearPDF_S21(publicador, anoServicio, mesesAno, informesPorMes)
      
      setTimeout(() => {
        onClose()
      }, 500)
      
    } catch (error) {
      console.error('Error generando S-21:', error)
      alert('Error al generar PDF')
    } finally {
      setGenerando(false)
    }
  }

  const crearPDF_S21 = (publicador, anoServicio, mesesAno, informesPorMes) => {
    const doc = new jsPDF()
    
    // === TÍTULO ===
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text('REGISTRO DE PUBLICADOR DE LA CONGREGACIÓN', 105, 20, { align: 'center' })
    
    // === NOMBRE ===
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text('Nombre:', 15, 35)
    
    // Línea para el nombre
    doc.line(32, 35, 190, 35)
    
    // Nombre del publicador sobre la línea
    if (publicador) {
      doc.setFont(undefined, 'bold')
      doc.text(`${publicador.apellido}, ${publicador.nombre}`, 33, 34.5)
    }
    
    // === FECHA DE NACIMIENTO ===
    doc.setFont(undefined, 'normal')
    doc.text('Fecha de nacimiento:', 15, 45)
    
    // Línea para la fecha
    doc.line(55, 45, 100, 45)
    
    // Fecha si existe
    if (publicador.fecha_nacimiento) {
      doc.setFont(undefined, 'bold')
      const fecha = new Date(publicador.fecha_nacimiento)
      doc.text(fecha.toLocaleDateString('es-AR'), 56, 44.5)
    }
    
    // Checkboxes Hombre/Mujer
    doc.setFont(undefined, 'normal')
    
    // Checkbox Hombre
    doc.rect(110, 42.5, 4, 4)
    if (publicador.sexo === 'Hombre') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 111.5, 45.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Hombre', 116, 45.5)
    
    // Checkbox Mujer  
    doc.rect(140, 42.5, 4, 4)
    if (publicador.sexo === 'Mujer') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 141.5, 45.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Mujer', 146, 45.5)
    
    // === FECHA DE BAUTISMO ===
    doc.text('Fecha de bautismo:', 15, 55)
    
    // Línea para la fecha
    doc.line(55, 55, 100, 55)
    
    // Fecha si existe
    if (publicador.fecha_bautismo) {
      doc.setFont(undefined, 'bold')
      const fecha = new Date(publicador.fecha_bautismo)
      doc.text(fecha.toLocaleDateString('es-AR'), 56, 54.5)
    }
    
    // Checkboxes Otras ovejas/Ungido
    doc.setFont(undefined, 'normal')
    
    // Checkbox Otras ovejas
    doc.rect(110, 52.5, 4, 4)
    if (!publicador.esperanza || publicador.esperanza === 'Otras ovejas') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 111.5, 55.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Otras ovejas', 116, 55.5)
    
    // Checkbox Ungido
    doc.rect(150, 52.5, 4, 4)
    if (publicador.esperanza === 'Ungido') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 151.5, 55.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Ungido', 156, 55.5)
    
    // === PRIVILEGIOS/SERVICIOS ===
    doc.setFontSize(9)
    let y = 67
    
    // Fila 1: Anciano, Siervo ministerial, Precursor regular, Precursor especial
    // Anciano
    doc.rect(15, y - 3, 3.5, 3.5)
    if (publicador.responsabilidad === 'Anciano') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 16, y - 0.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Anciano', 20, y)
    
    // Siervo ministerial
    doc.rect(45, y - 3, 3.5, 3.5)
    if (publicador.responsabilidad === 'Siervo Ministerial') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 46, y - 0.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Siervo ministerial', 50, y)
    
    // Precursor regular
    doc.rect(95, y - 3, 3.5, 3.5)
    if (publicador.tipo_servicio === 'Precursor Regular') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 96, y - 0.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Precursor regular', 100, y)
    
    // Precursor especial
    doc.rect(145, y - 3, 3.5, 3.5)
    if (publicador.tipo_servicio === 'Precursor Especial') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 146, y - 0.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Precursor especial', 150, y)
    
    // Fila 2: Misionero
    y += 8
    doc.rect(15, y - 3, 3.5, 3.5)
    if (publicador.tipo_servicio === 'Misionero') {
      doc.setFont(undefined, 'bold')
      doc.text('X', 16, y - 0.5)
      doc.setFont(undefined, 'normal')
    }
    doc.text('Misionero que sirve en el campo', 20, y)
    
    // === AÑO DE SERVICIO ===
    y += 12
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('Año de servicio', 15, y)
    doc.setFont(undefined, 'normal')
    
    // === TABLA ===
    y += 10
    doc.setFontSize(8)
    
    // Encabezados de columnas
    const colX = {
      mes: 20,
      participacion: 60,
      cursos: 100,
      auxiliar: 130,
      horas: 160,
      notas: 185
    }
    
    // Headers - Línea 1
    doc.setFont(undefined, 'bold')
    doc.text('Participación', colX.participacion, y)
    doc.text('Cursos', colX.cursos, y)
    doc.text('Precursor', colX.auxiliar, y)
    doc.text('Horas', colX.horas, y)
    doc.text('Notas', colX.notas, y)
    
    // Headers - Línea 2
    y += 4
    doc.text('en el', colX.participacion, y)
    doc.text('bíblicos', colX.cursos, y)
    doc.text('auxiliar', colX.auxiliar, y)
    
    // Headers - Línea 3
    y += 4
    doc.text('ministerio', colX.participacion, y)
    
    // Línea separadora bajo headers
    y += 2
    doc.line(15, y, 195, y)
    
    y += 6
    doc.setFont(undefined, 'normal')
    
    // === MESES ===
    const esPrecursor = publicador.tipo_servicio === 'Precursor Regular' || 
                        publicador.tipo_servicio === 'Precursor Especial' ||
                        publicador.tipo_servicio === 'Misionero'
    
    const mesesOrden = ['Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 
                        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto']
    
    let totalHoras = 0
    let totalCursos = 0
    
    mesesOrden.forEach((mesNombre, idx) => {
      const mesInfo = mesesAno.find(m => getMesNombre(m.mes) === mesNombre)
      const informe = mesInfo ? informesPorMes[mesInfo.mes] : null
      
      // Líneas horizontales entre meses
      if (idx > 0) {
        doc.setDrawColor(220, 220, 220)
        doc.line(15, y - 3, 195, y - 3)
        doc.setDrawColor(0, 0, 0)
      }
      
      // Nombre del mes
      doc.text(mesNombre, colX.mes, y)
      
      // Participación (checkbox visual)
      if (informe && informe.participo) {
        doc.rect(colX.participacion + 8, y - 3, 3, 3)
        doc.setFont(undefined, 'bold')
        doc.text('✓', colX.participacion + 9, y - 0.5)
        doc.setFont(undefined, 'normal')
      } else {
        doc.rect(colX.participacion + 8, y - 3, 3, 3)
      }
      
      // Cursos
      if (informe && informe.cursos > 0) {
        doc.text(informe.cursos.toString(), colX.cursos + 8, y)
        totalCursos += informe.cursos
      }
      
      // Precursor auxiliar (checkbox visual)
      if (informe && informe.precursor_auxiliar) {
        doc.rect(colX.auxiliar + 8, y - 3, 3, 3)
        doc.setFont(undefined, 'bold')
        doc.text('✓', colX.auxiliar + 9, y - 0.5)
        doc.setFont(undefined, 'normal')
      } else {
        doc.rect(colX.auxiliar + 8, y - 3, 3, 3)
      }
      
      // Horas (solo si es precursor o fue auxiliar)
      if (informe && (esPrecursor || informe.precursor_auxiliar)) {
        doc.text(informe.horas.toString(), colX.horas + 8, y)
        totalHoras += informe.horas
      }
      
      y += 8
    })
    
    // === TOTALES ===
    y += 2
    doc.line(15, y - 3, 195, y - 3)
    y += 5
    
    doc.setFont(undefined, 'bold')
    doc.text('Total', colX.mes, y)
    
    if (totalCursos > 0) {
      doc.text(totalCursos.toString(), colX.cursos + 8, y)
    }
    
    if (esPrecursor && totalHoras > 0) {
      doc.text(totalHoras.toString(), colX.horas + 8, y)
    }
    
    // === FOOTER ===
    doc.setFontSize(7)
    doc.setFont(undefined, 'normal')
    doc.text('S-21-S 11/23', 15, 285)
    
    // === DESCARGAR ===
    const nombreArchivo = `S-21_${publicador.apellido}_${publicador.nombre}_${anoServicio.nombre}.pdf`
    doc.save(nombreArchivo)
  }

  const publicadorInfo = publicadorSeleccionado ? 
    publicadores.find(p => p.id === publicadorSeleccionado) : null
  const faltanDatos = publicadorInfo && (!publicadorInfo.fecha_nacimiento || !publicadorInfo.sexo)

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={28} />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Generar Registro S-21
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Registro de Publicador de la Congregación
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Publicador
              </label>
              <select
                value={publicadorSeleccionado}
                onChange={(e) => setPublicadorSeleccionado(e.target.value)}
                className="custom-input"
              >
                <option value="">Seleccionar publicador...</option>
                {publicadoresActivos.map(pub => (
                  <option key={pub.id} value={pub.id}>
                    {pub.apellido}, {pub.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Año de Servicio
              </label>
              <select
                value={anoServicioSeleccionado}
                onChange={(e) => setAnoServicioSeleccionado(e.target.value)}
                className="custom-input"
              >
                <option value="">Seleccionar año...</option>
                {anosDisponibles.map(ano => (
                  <option key={ano.nombre} value={ano.nombre}>
                    {ano.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {faltanDatos && (
            <div className="card p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-2">
                <User className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-800">
                  <strong>Datos incompletos:</strong> Este publicador no tiene{' '}
                  {!publicadorInfo.fecha_nacimiento && 'fecha de nacimiento'}
                  {!publicadorInfo.fecha_nacimiento && !publicadorInfo.sexo && ' ni '}
                  {!publicadorInfo.sexo && 'sexo'} cargados.{' '}
                  <span className="font-medium">
                    Editá el publicador para completar estos datos.
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="card p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-800">
              💡 El PDF incluirá todos los meses del año de servicio con los informes registrados.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={generarPDF}
            disabled={!publicadorSeleccionado || !anoServicioSeleccionado || generando}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generando...
              </>
            ) : (
              <>
                <Download size={16} />
                Generar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
