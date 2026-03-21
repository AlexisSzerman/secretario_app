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

 const crearPDF_S21 = async (publicador, anoServicio, mesesAno, informesPorMes) => {
  const doc = new jsPDF()

  // ======================
  // CARGAR TEMPLATE (FONDO)
  // ======================
  const img = new Image()
  img.src = '/s21-template.png'

  await new Promise((resolve) => {
    img.onload = resolve
  })


  doc.addImage(img, 'PNG', 0, 0, 210, 297)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  // ======================
  // DATOS PERSONALES
  // ======================

  // Nombre
  if (publicador) {
    doc.text(`${publicador.apellido}, ${publicador.nombre}`, 42, 26.5)
  }

  // Fecha nacimiento
  if (publicador.fecha_nacimiento) {
    const fecha = new Date(publicador.fecha_nacimiento)
    doc.text(fecha.toLocaleDateString('es-AR'), 60, 33.5)
  }

  // Sexo
  if (publicador.sexo === 'Hombre') {
    doc.text('X', 107.5, 33.5)
  }
  if (publicador.sexo === 'Mujer') {
    doc.text('X', 137.5, 33.5)
  }

  // Bautismo
  if (publicador.fecha_bautismo) {
    const fecha = new Date(publicador.fecha_bautismo)
    doc.text(fecha.toLocaleDateString('es-AR'), 60, 40.5)
  }

  // Esperanza
  if (!publicador.esperanza || publicador.esperanza === 'Otras ovejas') {
    doc.text('X', 107.5, 40.5)
  }
  if (publicador.esperanza === 'Ungido') {
    doc.text('X', 147.5, 40.5)
  }

  // ======================
  // PRIVILEGIOS
  // ======================

  if (publicador.responsabilidad === 'Anciano') {
    doc.text('X', 17.5, 50.5) 
  }

  if (publicador.responsabilidad === 'Siervo Ministerial') {
    doc.text('X', 47.5, 50.5)
  }

  if (publicador.tipo_servicio === 'Precursor Regular') {
    doc.text('X', 97.5, 50.5)
  }

  if (publicador.tipo_servicio === 'Precursor Especial') {
    doc.text('X', 147.5, 50.5)
  }

  if (publicador.tipo_servicio === 'Misionero') {
    doc.text('X', 17.5, 57.5)
  }

  // ======================
  // TABLA
  // ======================

  const mesesOrden = [
    'Septiembre','Octubre','Noviembre','Diciembre',
    'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto'
  ]

  const col = {
  part: 71.5,
  cursos: 100,
  aux: 130,
  horas: 155
}

let y = 96

  const esPrecursor =
    publicador.tipo_servicio === 'Precursor Regular' ||
    publicador.tipo_servicio === 'Precursor Especial' ||
    publicador.tipo_servicio === 'Misionero'

  let totalHoras = 0
  let totalCursos = 0

 mesesOrden.forEach((mesNombre) => {
  const mesInfo = mesesAno.find(m => getMesNombre(m.mes) === mesNombre)
  const informe = mesInfo ? informesPorMes[mesInfo.mes] : null

  // Participación
  if (informe?.participo) {
    doc.text('X', col.part, y)
  }

  // Cursos
  if (informe?.cursos) {
    doc.text(String(informe.cursos), col.cursos, y, { align: 'center' })
  }

  // Auxiliar
  if (informe?.precursor_auxiliar) {
    doc.text('X', col.aux, y)
  }

  // Horas
  if (informe?.horas) {
    doc.text(String(informe.horas), col.horas, y, { align: 'center' })
  }

  y += 7.2 // 🔥 este decimal es CLAVE para que cierre perfecto
})

  // ======================
  // TOTALES
  // ======================

  doc.text('Total', 20, y + 4.5)

  if (totalCursos > 0) {
   doc.text(String(totalCursos), col.cursos, y + 4.5, { align: 'center' })
  }

  if (totalHoras > 0) {
    doc.text(String(totalHoras), col.horas, y + 4.5, { align: 'center' })
  }

  // ======================
  // DESCARGA
  // ======================

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
