import { useState } from 'react'
import { X, Download, FileText, User, Users, Archive } from 'lucide-react'
import { db } from '../lib/supabase'
import { getMesNombre, getAnoServicioActual, getMesesAnoServicio } from '../utils/dateUtils'
import jsPDF from 'jspdf'
import JSZip from 'jszip'

export default function GenerarS21Modal({ publicadores, onClose }) {
  const [modo, setModo] = useState('individual') // 'individual' o 'todos'
  const [publicadorSeleccionado, setPublicadorSeleccionado] = useState('')
  const [anoServicioSeleccionado, setAnoServicioSeleccionado] = useState('')
  const [generando, setGenerando] = useState(false)
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, etapa: '' })

const anoActual = getAnoServicioActual()

  const construirAnoServicio = (offset) => {
    const anoInicio = anoActual.inicio.ano - offset
    const anoFin = anoInicio + 1
    return {
      inicio: { mes: 9, ano: anoInicio },
      fin: { mes: 8, ano: anoFin },
      nombre: `${anoInicio}-${anoFin}`,
      label: `Septiembre ${anoInicio} - Agosto ${anoFin}`
    }
  }

  const anosDisponibles = [
    anoActual,
    construirAnoServicio(1),
    construirAnoServicio(2)
  ]

  const publicadoresActivos = publicadores.filter(p => 
    p.tipo_servicio !== 'Inactivo' && !p.fecha_mudanza
  ).sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`))

  // Carga la imagen de template UNA sola vez, y la convierte a JPEG
  // comprimido a una resolución adecuada para impresión (150dpi en A4).
  // El template original es un PNG sin pérdida a resolución completa, lo
  // que hace que cada PDF pese varios MB. Convertido a JPEG queda igual
  // de nítido para imprimir pero pesa una fracción de eso.
  const cargarTemplate = () => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.src = '/s21-template.png'
      img.onload = () => {
        try {
          // A4 a 150dpi ≈ 1240x1754px: nítido para imprimir, liviano en archivo
          const targetWidth = 1240
          const targetHeight = 1754
          const canvas = document.createElement('canvas')
          canvas.width = targetWidth
          canvas.height = targetHeight
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, targetWidth, targetHeight)
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.82)
          resolve(jpegDataUrl)
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = reject
    })
  }

  // Construye el PDF de un publicador y devuelve el objeto jsPDF (sin guardarlo)
  // "templateJpeg" es el data URL JPEG ya comprimido que devuelve cargarTemplate()
  const crearDocS21 = (publicador, anoServicio, mesesAno, informesPorMes, templateJpeg) => {
    const doc = new jsPDF({ compress: true })

    // ======================
    // TEMPLATE (FONDO)
    // ======================
    doc.addImage(templateJpeg, 'JPEG', 0, 0, 210, 297)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    // ======================
    // DATOS PERSONALES
    // ======================

    // Nombre
    if (publicador) {
      doc.text(`${publicador.apellido}, ${publicador.nombre}`, 25, 27)
    }

    // Fecha nacimiento
    if (publicador.fecha_nacimiento) {
      const fecha = new Date(publicador.fecha_nacimiento)
      doc.text(fecha.toLocaleDateString('es-AR'), 50, 33)
    }

    // Sexo
    if (publicador.sexo === 'Hombre') {
      doc.text('X', 136.5, 33)
    }
    if (publicador.sexo === 'Mujer') {
      doc.text('X', 172, 33)
    }

    // Bautismo
    if (publicador.fecha_bautismo) {
      const fecha = new Date(publicador.fecha_bautismo)
      doc.text(fecha.toLocaleDateString('es-AR'), 45, 38.5)
    }

    // Esperanza
    if (!publicador.esperanza || publicador.esperanza === 'Otras ovejas') {
      doc.text('X', 136.5, 38.5)
    }
    if (publicador.esperanza === 'Ungido') {
      doc.text('X', 172, 38.5)
    }

    // ======================
    // PRIVILEGIOS
    // ======================

    if (publicador.responsabilidad === 'Anciano') {
      doc.text('X', 7, 44.5) 
    }

    if (publicador.responsabilidad === 'Siervo Ministerial') {
      doc.text('X', 29, 44.5)
    }

    if (publicador.tipo_servicio === 'Precursor Regular') {
      doc.text('X', 72, 44.5)
    }

    if (publicador.tipo_servicio === 'Precursor Especial') {
      doc.text('X', 116, 44.5)
    }

    if (publicador.tipo_servicio === 'Misionero') {
      doc.text('X', 162, 44.5)
    }

    // ======================
    // TABLA
    // ======================

    const mesesOrden = [
      'Septiembre','Octubre','Noviembre','Diciembre',
      'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto'
    ]

    const col = {
      part: 47,
      cursos: 71.5,
      aux: 97,
      horas: 127,
      obs: 147 
    }

    let y = 74

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
        totalCursos += informe.cursos
      }

      // Auxiliar
      if (informe?.precursor_auxiliar) {
        doc.text('X', col.aux, y)
      }

      // Horas
      if (informe?.horas) {
        doc.text(String(informe.horas), col.horas, y, { align: 'center' })
        totalHoras += informe.horas
      }

      // Observaciones (nota del informe de este mes)
      if (informe?.notas && informe.notas.trim()) {
        doc.setFontSize(9)
        // Ancho acotado para que la nota no invada la columna siguiente ni se salga de la hoja
        const notaCorta = doc.splitTextToSize(informe.notas.trim(), 75)
        doc.text(notaCorta[0], col.obs, y)  // solo la primera línea, el renglón es angosto
        doc.setFontSize(7)
      }

      y += 7.2 
    })

    // ======================
    // TOTALES
    // ======================

if (totalHoras > 0) {
  doc.setFontSize(10)
  doc.text(String(totalHoras), col.horas, y - 1, { align: 'center' })
}

    return doc
  }

  // Trae los informes de todos los meses del año de servicio UNA sola vez
  // (en vez de una consulta por cada publicador) y arma un mapa
  // { mes: [informes de todos los publicadores ese mes] }
  const cargarInformesAnoServicio = async (mesesAno) => {
    const informesPromises = mesesAno.map(m => db.getInformesByMesAno(m.mes, m.ano))
    const resultados = await Promise.all(informesPromises)

    const porMes = {}
    mesesAno.forEach((mesInfo, idx) => {
      porMes[mesInfo.mes] = resultados[idx]
    })
    return porMes
  }

  const armarInformesPorMesDePublicador = (publicadorId, mesesAno, informesPorMesGlobal) => {
    const informesPorMes = {}
    mesesAno.forEach((mesInfo) => {
      const informesDelMes = informesPorMesGlobal[mesInfo.mes] || []
      informesPorMes[mesInfo.mes] = informesDelMes.find(inf => inf.publicador_id === publicadorId)
    })
    return informesPorMes
  }

  // ======================
  // GENERAR UN SOLO PDF
  // ======================
  const generarPDF = async () => {
    if (!publicadorSeleccionado || !anoServicioSeleccionado) {
      alert('Selecciona un publicador y año de servicio')
      return
    }

    setGenerando(true)
    setProgreso({ actual: 0, total: 1, etapa: 'Generando PDF...' })
    try {
      const publicador = publicadores.find(p => p.id === publicadorSeleccionado)
      const anoServicio = anosDisponibles.find(a => a.nombre === anoServicioSeleccionado)
      const mesesAno = getMesesAnoServicio(anoServicio)

      const [img, informesPorMesGlobal] = await Promise.all([
        cargarTemplate(),
        cargarInformesAnoServicio(mesesAno)
      ])

      const informesPorMes = armarInformesPorMesDePublicador(publicador.id, mesesAno, informesPorMesGlobal)
      const doc = crearDocS21(publicador, anoServicio, mesesAno, informesPorMes, img)

      const nombreArchivo = `S-21_${publicador.apellido}_${publicador.nombre}_${anoServicio.nombre}.pdf`
      doc.save(nombreArchivo)

      setProgreso({ actual: 1, total: 1, etapa: 'Listo' })
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

  // ======================
  // GENERAR TODOS (ZIP)
  // ======================
  const generarTodosPDF = async () => {
    if (!anoServicioSeleccionado) {
      alert('Selecciona un año de servicio')
      return
    }
    if (publicadoresActivos.length === 0) {
      alert('No hay publicadores activos para exportar')
      return
    }

    setGenerando(true)
    setProgreso({ actual: 0, total: publicadoresActivos.length, etapa: 'Cargando informes...' })

    try {
      const anoServicio = anosDisponibles.find(a => a.nombre === anoServicioSeleccionado)
      const mesesAno = getMesesAnoServicio(anoServicio)

      // Cargar el template y todos los informes del año UNA sola vez
      const [img, informesPorMesGlobal] = await Promise.all([
        cargarTemplate(),
        cargarInformesAnoServicio(mesesAno)
      ])

      const zip = new JSZip()
      const nombresUsados = new Set()

      setProgreso({ actual: 0, total: publicadoresActivos.length, etapa: 'Generando PDFs...' })

      for (let i = 0; i < publicadoresActivos.length; i++) {
        const publicador = publicadoresActivos[i]

        const informesPorMes = armarInformesPorMesDePublicador(publicador.id, mesesAno, informesPorMesGlobal)
        const doc = crearDocS21(publicador, anoServicio, mesesAno, informesPorMes, img)
        const blob = doc.output('blob')

        // Nombre de archivo seguro dentro del zip, evitando duplicados
        let nombreBase = `${publicador.apellido}_${publicador.nombre}`.replace(/[\/\\?%*:|"<>]/g, '-')
        let nombreArchivo = `S-21_${nombreBase}.pdf`
        let contador = 2
        while (nombresUsados.has(nombreArchivo)) {
          nombreArchivo = `S-21_${nombreBase}_${contador}.pdf`
          contador++
        }
        nombresUsados.add(nombreArchivo)

        zip.file(nombreArchivo, blob)

        setProgreso({ actual: i + 1, total: publicadoresActivos.length, etapa: 'Generando PDFs...' })

        // Deja "respirar" a la UI cada tanto para que la barra se actualice visualmente
        if (i % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      setProgreso({ actual: publicadoresActivos.length, total: publicadoresActivos.length, etapa: 'Comprimiendo ZIP...' })

      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        // Progreso de compresión (0-100), lo mostramos en la misma barra
        setProgreso(prev => ({ ...prev, etapa: `Comprimiendo ZIP... ${Math.round(metadata.percent)}%` }))
      })

      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `S-21_Todos_${anoServicio.nombre}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setProgreso({ actual: publicadoresActivos.length, total: publicadoresActivos.length, etapa: 'Listo' })
      setTimeout(() => {
        onClose()
      }, 500)

    } catch (error) {
      console.error('Error generando ZIP de S-21:', error)
      alert('Error al generar el ZIP')
    } finally {
      setGenerando(false)
    }
  }

  const handleGenerar = () => {
    if (modo === 'individual') {
      generarPDF()
    } else {
      generarTodosPDF()
    }
  }

  const publicadorInfo = publicadorSeleccionado ? 
    publicadores.find(p => p.id === publicadorSeleccionado) : null
  const faltanDatos = publicadorInfo && (!publicadorInfo.fecha_nacimiento || !publicadorInfo.sexo)

  const publicadoresConDatosIncompletos = publicadoresActivos.filter(
    p => !p.fecha_nacimiento || !p.sexo
  )

  const porcentajeProgreso = progreso.total > 0 
    ? Math.round((progreso.actual / progreso.total) * 100) 
    : 0

  const puedeGenerar = modo === 'individual'
    ? (publicadorSeleccionado && anoServicioSeleccionado && !generando)
    : (anoServicioSeleccionado && !generando)

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[100]">
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
            disabled={generando}
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Selector de modo */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo('individual')}
              disabled={generando}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all inline-flex items-center justify-center gap-2 border ${
                modo === 'individual'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <User size={16} />
              Un publicador
            </button>
            <button
              type="button"
              onClick={() => setModo('todos')}
              disabled={generando}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all inline-flex items-center justify-center gap-2 border ${
                modo === 'todos'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Users size={16} />
              Todos ({publicadoresActivos.length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modo === 'individual' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Publicador
                </label>
                <select
                  value={publicadorSeleccionado}
                  onChange={(e) => setPublicadorSeleccionado(e.target.value)}
                  className="custom-input"
                  disabled={generando}
                >
                  <option value="">Seleccionar publicador...</option>
                  {publicadoresActivos.map(pub => (
                    <option key={pub.id} value={pub.id}>
                      {pub.apellido}, {pub.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={modo === 'todos' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Año de Servicio
              </label>
              <select
                value={anoServicioSeleccionado}
                onChange={(e) => setAnoServicioSeleccionado(e.target.value)}
                className="custom-input"
                disabled={generando}
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

          {/* Aviso datos incompletos - modo individual */}
          {modo === 'individual' && faltanDatos && (
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

          {/* Aviso datos incompletos - modo todos */}
          {modo === 'todos' && publicadoresConDatosIncompletos.length > 0 && (
            <div className="card p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-2">
                <User className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-800">
                  <strong>{publicadoresConDatosIncompletos.length} publicador{publicadoresConDatosIncompletos.length > 1 ? 'es' : ''}</strong> sin 
                  fecha de nacimiento y/o sexo cargados. Sus PDFs se van a generar igual, 
                  pero con esos campos en blanco.
                </div>
              </div>
            </div>
          )}

          {modo === 'todos' && (
            <div className="card p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-2">
                <Archive className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-blue-800">
                  Se va a generar un archivo .zip con un PDF S-21 por cada uno de los{' '}
                  <strong>{publicadoresActivos.length} publicadores activos</strong>. 
                  Con muchos publicadores puede tardar uno o dos minutos.
                </p>
              </div>
            </div>
          )}

          {modo === 'individual' && (
            <div className="card p-4 bg-blue-50 border-blue-200">
              <p className="text-sm text-blue-800">
                💡 El PDF incluirá todos los meses del año de servicio con los informes registrados.
              </p>
            </div>
          )}

          {/* Barra de progreso */}
          {generando && (
            <div className="card p-4 bg-slate-50 border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">
                  {progreso.etapa}
                </span>
                <span className="text-sm text-slate-600">
                  {modo === 'todos' ? `${progreso.actual} / ${progreso.total}` : ''}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-200"
                  style={{ width: `${porcentajeProgreso}%` }}
                ></div>
              </div>
              <div className="text-right text-xs text-slate-500 mt-1">
                {porcentajeProgreso}%
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={generando}
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerar}
            disabled={!puedeGenerar}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generando...
              </>
            ) : (
              <>
                {modo === 'todos' ? <Archive size={16} /> : <Download size={16} />}
                {modo === 'todos' ? 'Generar ZIP' : 'Generar PDF'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}