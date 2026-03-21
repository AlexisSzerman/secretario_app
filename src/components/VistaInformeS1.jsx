import { useState, useEffect } from 'react'
import { FileText, Copy, CheckCircle, Download, Users, AlertCircle, Star } from 'lucide-react'
import { getMesNombre } from '../utils/dateUtils'
import { db } from '../lib/supabase'
import jsPDF from 'jspdf'

export default function VistaInformeS1({ publicadores, informes, mesActual }) {
  const [asistenciaFinSemana, setAsistenciaFinSemana] = useState('')
  const [asistenciaEntreSemana, setAsistenciaEntreSemana] = useState('')
  const [copiado, setCopiado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  
  // Listas dinámicas
  const [publicadoresAlerta, setPublicadoresAlerta] = useState([])

  // Cargar asistencia al montar
  useEffect(() => {
    loadAsistencia()
  }, [mesActual])

  const loadAsistencia = async () => {
    try {
      const datos = await db.getDatosMensuales(mesActual.mes, mesActual.ano)
      if (datos) {
        setAsistenciaFinSemana(datos.asistencia_fin_semana || '')
        setAsistenciaEntreSemana(datos.asistencia_entre_semana || '')
      }
    } catch (error) {
      console.error('Error cargando asistencia:', error)
    }
  }

  const guardarAsistencia = async () => {
    setGuardando(true)
    try {
      await db.saveDatosMensuales({
        mes: mesActual.mes,
        ano: mesActual.ano,
        asistencia_fin_semana: parseFloat(asistenciaFinSemana) || null,
        asistencia_entre_semana: parseFloat(asistenciaEntreSemana) || null
      })
      alert('Asistencia guardada correctamente')
    } catch (error) {
      console.error('Error guardando asistencia:', error)
      alert('Error al guardar asistencia')
    } finally {
      setGuardando(false)
    }
  }

  // FUNCIÓN HELPER: Verifica si debía informar en este mes
  const debiaInformarEnMes = (publicador) => {
    if (publicador.tipo_servicio === 'Inactivo') return false
    
    const fechaBase = publicador.en_congregacion_desde || publicador.activo_desde
    const fechaMes = new Date(mesActual.ano, mesActual.mes - 1, 1)
    
    // Verificar fecha de inicio
    if (fechaBase) {
      const fechaInicio = new Date(fechaBase)
      if (fechaMes < fechaInicio) return false
    }
    
    // NUEVO: Verificar fecha de mudanza
    if (publicador.fecha_mudanza) {
      const fechaSalida = new Date(publicador.fecha_mudanza)
      // Si el mes es posterior a la mudanza, no debía informar
      if (fechaMes > fechaSalida) return false
    }
    
    return true
  }

  // FUNCIÓN HELPER: Obtener informes del mes anterior
  const getInformesMesAnterior = async (publicadorId) => {
    let mes = mesActual.mes - 1
    let ano = mesActual.ano
    
    if (mes <= 0) {
      mes += 12
      ano -= 1
    }
    
    try {
      const informesMes = await db.getInformesByMesAno(mes, ano)
      return informesMes.find(inf => inf.publicador_id === publicadorId)
    } catch (error) {
      console.error('Error obteniendo informes anteriores:', error)
      return null
    }
  }

  const publicadoresActivos = publicadores.filter(p => 
    p.tipo_servicio !== 'Inactivo' &&
    (!p.fecha_mudanza || new Date(p.fecha_mudanza) >= new Date(mesActual.ano, mesActual.mes - 1, 1))
  )
  const publicadoresDeberian = publicadores.filter(p => debiaInformarEnMes(p))

  // Separar informes por tipo
  const informesPublicadores = informes.filter(inf => {
    const pub = publicadores.find(p => p.id === inf.publicador_id)
    return (
      pub &&
      pub.tipo_servicio === 'Publicador' &&
      !inf.precursor_auxiliar
    )
  })

  const informesPrecAux = informes.filter(inf => inf.precursor_auxiliar)

  const informesPrecReg = informes.filter(inf => {
    const pub = publicadores.find(p => p.id === inf.publicador_id)
    return (
      pub &&
      (pub.tipo_servicio === 'Precursor Regular' ||
       pub.tipo_servicio === 'Precursor Especial')
    )
  })

  // Estadísticas para S-1
  const stats = {
    totalPublicadoresActivos: publicadoresActivos.length,
    
    publicadores: {
      informes: informesPublicadores.length,
      cursos: informesPublicadores.reduce((sum, i) => sum + (i.cursos || 0), 0)
    },
    
    precursoresAuxiliares: {
      informes: informesPrecAux.length,
      horas: informesPrecAux.reduce((sum, i) => sum + (i.horas || 0), 0),
      cursos: informesPrecAux.reduce((sum, i) => sum + (i.cursos || 0), 0)
    },
    
    precursoresRegulares: {
      informes: informesPrecReg.length,
      horas: informesPrecReg.reduce((sum, i) => sum + (i.horas || 0), 0),
      cursos: informesPrecReg.reduce((sum, i) => sum + (i.cursos || 0), 0)
    }
  }

  // === LISTAS ADICIONALES ===

  // 1. Precursores auxiliares (con nombres)
  const precursoresAuxiliaresLista = informesPrecAux.map(inf => {
    const pub = publicadores.find(p => p.id === inf.publicador_id)
    return pub
  }).filter(Boolean)

  // 2. Nuevos publicadores (en_congregacion_desde = mes actual)
  const nuevosPublicadores = publicadores.filter(pub => {
    if (!pub.en_congregacion_desde) return false
    const fecha = new Date(pub.en_congregacion_desde)
    return fecha.getMonth() + 1 === mesActual.mes && fecha.getFullYear() === mesActual.ano
  })

  // NUEVO: Publicadores mudados (fecha_mudanza = mes actual)
  const publicadoresMudados = publicadores.filter(pub => {
    if (!pub.fecha_mudanza) return false
    const fecha = new Date(pub.fecha_mudanza)
    return fecha.getMonth() + 1 === mesActual.mes && fecha.getFullYear() === mesActual.ano
  })

  // 3. NO PARTICIPARON (informaron pero no participaron)
  const noParticiparon = informes
    .filter(inf => !inf.participo)
    .map(inf => publicadores.find(p => p.id === inf.publicador_id))
    .filter(Boolean)

  // 4. Irregulares próximo mes (2 meses sin informar consecutivos)
  useEffect(() => {
    calcularAlerta()
  }, [publicadores, informes, mesActual])

  const calcularAlerta = async () => {
    const alerta = []

    for (const pub of publicadoresDeberian) {
      // Solo evaluar si no informó este mes
      const informoEsteMes = informes.find(i => i.publicador_id === pub.id)
      if (informoEsteMes) continue

      // Obtener mes anterior
      const informeMesAnterior = await getInformesMesAnterior(pub.id)
      
      // Si tampoco informó el mes anterior = 2 meses sin informar
      if (!informeMesAnterior) {
        alerta.push(pub)
      }
    }

    setPublicadoresAlerta(alerta)
  }

  // === COPIAR AL PORTAPAPELES ===
  const copiarAlPortapapeles = (texto, id) => {
    navigator.clipboard.writeText(texto.toString())
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  // === EXPORTAR PDF ===
  const exportarPDF = () => {
    const doc = new jsPDF()
    const mesNombre = getMesNombre(mesActual.mes).toUpperCase() + ' ' + mesActual.ano
    
    // Título
    doc.setFontSize(16)
    doc.text('INFORME S-1', 105, 15, { align: 'center' })
    doc.setFontSize(12)
    doc.text(mesNombre, 105, 22, { align: 'center' })

    let y = 35

    // Asistencia
    if (asistenciaFinSemana || asistenciaEntreSemana) {
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      doc.text('ASISTENCIA PROMEDIO', 15, y)
      y += 7
      doc.setFont(undefined, 'normal')
      if (asistenciaFinSemana) {
        doc.text(`Fin de semana: ${asistenciaFinSemana}`, 15, y)
        y += 5
      }
      if (asistenciaEntreSemana) {
        doc.text(`Entre semana: ${asistenciaEntreSemana}`, 15, y)
        y += 5
      }
      y += 5
    }

    // Cifras S-1
    doc.setFont(undefined, 'bold')
    doc.text('PUBLICADORES', 15, y)
    y += 7
    doc.setFont(undefined, 'normal')
    doc.text(`Total activos: ${stats.totalPublicadoresActivos}`, 15, y)
    y += 5
    doc.text(`Informes: ${stats.publicadores.informes}`, 15, y)
    y += 5
    doc.text(`Cursos: ${stats.publicadores.cursos}`, 15, y)
    y += 10

    doc.setFont(undefined, 'bold')
    doc.text('PRECURSORES AUXILIARES', 15, y)
    y += 7
    doc.setFont(undefined, 'normal')
    doc.text(`Informes: ${stats.precursoresAuxiliares.informes}`, 15, y)
    y += 5
    doc.text(`Horas: ${stats.precursoresAuxiliares.horas}`, 15, y)
    y += 5
    doc.text(`Cursos: ${stats.precursoresAuxiliares.cursos}`, 15, y)
    y += 10

    doc.setFont(undefined, 'bold')
    doc.text('PRECURSORES REGULARES', 15, y)
    y += 7
    doc.setFont(undefined, 'normal')
    doc.text(`Informes: ${stats.precursoresRegulares.informes}`, 15, y)
    y += 5
    doc.text(`Horas: ${stats.precursoresRegulares.horas}`, 15, y)
    y += 5
    doc.text(`Cursos: ${stats.precursoresRegulares.cursos}`, 15, y)
    y += 15

    // Listas
    if (precursoresAuxiliaresLista.length > 0) {
      doc.setFont(undefined, 'bold')
      doc.text('PRECURSORES AUXILIARES:', 15, y)
      y += 6
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      precursoresAuxiliaresLista.forEach(pub => {
        if (y < 280) {
          doc.text(`• ${pub.apellido}, ${pub.nombre}`, 15, y)
          y += 5
        }
      })
      y += 5
      doc.setFontSize(10)
    }

    if (nuevosPublicadores.length > 0 && y < 250) {
      doc.setFont(undefined, 'bold')
      doc.text('NUEVOS PUBLICADORES:', 15, y)
      y += 6
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      nuevosPublicadores.forEach(pub => {
        if (y < 280) {
          doc.text(`• ${pub.apellido}, ${pub.nombre}`, 15, y)
          y += 5
        }
      })
      y += 5
      doc.setFontSize(10)
    }

    // NUEVO: Publicadores mudados
    if (publicadoresMudados.length > 0) {
      // Si no hay espacio suficiente, agregar nueva página
      if (y > 250) {
        doc.addPage()
        y = 20
      }
      doc.setFont(undefined, 'bold')
      doc.text('MUDADOS:', 15, y)
      y += 6
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      publicadoresMudados.forEach(pub => {
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        doc.text(`• ${pub.apellido}, ${pub.nombre}`, 15, y)
        y += 5
      })
      y += 5
      doc.setFontSize(10)
    }

    if (noParticiparon.length > 0) {
      // Si no hay espacio suficiente, agregar nueva página
      if (y > 250) {
        doc.addPage()
        y = 20
      }
      doc.setFont(undefined, 'bold')
      doc.text('NO PARTICIPARON:', 15, y)
      y += 6
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      noParticiparon.forEach(pub => {
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        doc.text(`• ${pub.apellido}, ${pub.nombre}`, 15, y)
        y += 5
      })
      y += 5
      doc.setFontSize(10)
    }

    if (publicadoresAlerta.length > 0 && y < 220) {
      if (y > 200) {
        doc.addPage()
        y = 20
      }
      doc.setFont(undefined, 'bold')
      doc.text('IRREGULARES PROXIMO MES (2 meses sin informar):', 15, y)
      y += 6
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      publicadoresAlerta.forEach(pub => {
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        doc.text(`• ${pub.apellido}, ${pub.nombre}`, 15, y)
        y += 5
      })
    }

    doc.save(`S1-${mesNombre.replace(' ', '-')}.pdf`)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Informe S-1 - {getMesNombre(mesActual.mes)} {mesActual.ano}
              </h2>
              <p className="text-sm text-slate-700">
                PREDICACIÓN Y ASISTENCIA A LAS REUNIONES
              </p>
            </div>
          </div>
          <button
            onClick={exportarPDF}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={20} />
            Exportar PDF
          </button>
        </div>
        <p className="text-sm text-blue-700">
          📋 Cifras listas para copiar a JW.org Hub • Click en cada número para copiar
        </p>
      </div>

      {/* Asistencia promedio */}
      <div className="card p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Asistencia Promedio</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reuniones Fin de Semana
            </label>
            <input
              type="number"
              step="0.1"
              value={asistenciaFinSemana}
              onChange={(e) => setAsistenciaFinSemana(e.target.value)}
              placeholder="Ej: 95.5"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reuniones Entre Semana
            </label>
            <input
              type="number"
              step="0.1"
              value={asistenciaEntreSemana}
              onChange={(e) => setAsistenciaEntreSemana(e.target.value)}
              placeholder="Ej: 87.3"
              className="input"
            />
          </div>
        </div>
        <button
          onClick={guardarAsistencia}
          disabled={guardando}
          className="btn-primary mt-4"
        >
          {guardando ? 'Guardando...' : 'Guardar Asistencia'}
        </button>
      </div>

      {/* Total publicadores activos */}
      <div className="card p-6">
        <div className="text-sm text-slate-600 mb-2">Todos los publicadores activos</div>
        <div className="flex items-center gap-3">
          <div 
            onClick={() => copiarAlPortapapeles(stats.totalPublicadoresActivos, 'total')}
            className="text-5xl font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
          >
            {stats.totalPublicadoresActivos}
          </div>
          <button
            onClick={() => copiarAlPortapapeles(stats.totalPublicadoresActivos, 'total')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {copiado === 'total' ? (
              <CheckCircle className="text-green-600" size={20} />
            ) : (
              <Copy className="text-slate-400" size={20} />
            )}
          </button>
        </div>
      </div>

      {/* Publicadores */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          Publicadores
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-slate-600 mb-2">Cantidad de informes</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.publicadores.informes, 'pub-informes')}
                className="text-4xl font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {stats.publicadores.informes}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.publicadores.informes, 'pub-informes')}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                {copiado === 'pub-informes' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-slate-400" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-2">Cursos bíblicos</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.publicadores.cursos, 'pub-cursos')}
                className="text-4xl font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {stats.publicadores.cursos}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.publicadores.cursos, 'pub-cursos')}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                {copiado === 'pub-cursos' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-slate-400" size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Precursores auxiliares */}
      <div className="card p-6 bg-yellow-50 border-yellow-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Precursores auxiliares</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-yellow-700 mb-2">Cantidad de informes</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.informes, 'aux-informes')}
                className="text-4xl font-bold text-yellow-900 cursor-pointer hover:text-yellow-600 transition-colors"
              >
                {stats.precursoresAuxiliares.informes}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.informes, 'aux-informes')}
                className="p-2 hover:bg-yellow-100 rounded-lg"
              >
                {copiado === 'aux-informes' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-yellow-600" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-yellow-700 mb-2">Horas</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.horas, 'aux-horas')}
                className="text-4xl font-bold text-yellow-900 cursor-pointer hover:text-yellow-600 transition-colors"
              >
                {stats.precursoresAuxiliares.horas}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.horas, 'aux-horas')}
                className="p-2 hover:bg-yellow-100 rounded-lg"
              >
                {copiado === 'aux-horas' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-yellow-600" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-yellow-700 mb-2">Cursos bíblicos</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.cursos, 'aux-cursos')}
                className="text-4xl font-bold text-yellow-900 cursor-pointer hover:text-yellow-600 transition-colors"
              >
                {stats.precursoresAuxiliares.cursos}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresAuxiliares.cursos, 'aux-cursos')}
                className="p-2 hover:bg-yellow-100 rounded-lg"
              >
                {copiado === 'aux-cursos' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-yellow-600" size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Precursores regulares */}
      <div className="card p-6 bg-amber-50 border-amber-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Precursores regulares</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-amber-700 mb-2">Cantidad de informes</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.informes, 'reg-informes')}
                className="text-4xl font-bold text-amber-900 cursor-pointer hover:text-amber-600 transition-colors"
              >
                {stats.precursoresRegulares.informes}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.informes, 'reg-informes')}
                className="p-2 hover:bg-amber-100 rounded-lg"
              >
                {copiado === 'reg-informes' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-amber-600" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-amber-700 mb-2">Horas</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.horas, 'reg-horas')}
                className="text-4xl font-bold text-amber-900 cursor-pointer hover:text-amber-600 transition-colors"
              >
                {stats.precursoresRegulares.horas}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.horas, 'reg-horas')}
                className="p-2 hover:bg-amber-100 rounded-lg"
              >
                {copiado === 'reg-horas' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-amber-600" size={18} />
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-amber-700 mb-2">Cursos bíblicos</div>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.cursos, 'reg-cursos')}
                className="text-4xl font-bold text-amber-900 cursor-pointer hover:text-amber-600 transition-colors"
              >
                {stats.precursoresRegulares.cursos}
              </div>
              <button
                onClick={() => copiarAlPortapapeles(stats.precursoresRegulares.cursos, 'reg-cursos')}
                className="p-2 hover:bg-amber-100 rounded-lg"
              >
                {copiado === 'reg-cursos' ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <Copy className="text-amber-600" size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === LISTAS ADICIONALES === */}

      {/* Precursores Auxiliares del mes (con nombres) */}
      {precursoresAuxiliaresLista.length > 0 && (
        <div className="card p-6 bg-yellow-50 border-yellow-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="text-yellow-600" size={20} />
            Precursores Auxiliares del Mes ({precursoresAuxiliaresLista.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {precursoresAuxiliaresLista.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nuevos Publicadores */}
      {nuevosPublicadores.length > 0 && (
        <div className="card p-6 bg-green-50 border-green-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="text-green-600" size={20} />
            Nuevos Publicadores ({nuevosPublicadores.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {nuevosPublicadores.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NUEVO: Publicadores Mudados */}
      {publicadoresMudados.length > 0 && (
        <div className="card p-6 bg-orange-50 border-orange-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Mudados ({publicadoresMudados.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {publicadoresMudados.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NO PARTICIPARON */}
      {noParticiparon.length > 0 && (
        <div className="card p-6 bg-slate-50 border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="text-slate-600" size={20} />
            No Participaron ({noParticiparon.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {noParticiparon.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Irregulares próximo mes (2 meses sin informar) */}
      {publicadoresAlerta.length > 0 && (
        <div className="card p-6 bg-red-50 border-red-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            Irregulares Próximo Mes ({publicadoresAlerta.length})
          </h4>
          <p className="text-sm text-red-700 mb-3">
            2 meses sin informar - serán irregulares si no informan el próximo mes
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {publicadoresAlerta.map(pub => (
              <div key={pub.id} className="text-sm text-slate-700">
                • {pub.apellido}, {pub.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Click en cualquier número para copiarlo al portapapeles. 
          Luego pégalo directamente en JW.org Hub.
        </p>
      </div>
    </div>
  )
}