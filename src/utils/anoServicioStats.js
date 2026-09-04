// anoServicioStats.js
// Lógica compartida para traer los datos mensuales del año de servicio
// (usada tanto por el gráfico en pantalla como por el PDF del S-1)

import { db } from '../lib/supabase'
import { getMesesAnoServicio, getMesNombre, getMesVencido, getAnoServicioVencido } from './dateUtils'

// Mismo criterio de elegibilidad que usa VistaInformeS1
export const debiaInformarEnMesEspecifico = (publicador, mes, ano) => {
  if (publicador.tipo_servicio === 'Inactivo') return false
  if (publicador.fecha_mudanza) return false

  const fechaBase = publicador.informar_desde || publicador.en_congregacion_desde || publicador.activo_desde
  if (!fechaBase) return true

  const [yb, mb] = fechaBase.split('-').map(Number)
  const fechaInicioNum = yb * 12 + (mb - 1)
  const mesNum = ano * 12 + (mes - 1)

  return mesNum >= fechaInicioNum
}

// Trae y agrega los datos mes a mes del año de servicio en curso,
// calculado a partir del último mes VENCIDO (no de "hoy"), para que
// agosto siga en su año hasta que termine, en vez de saltar apenas
// empieza septiembre.
export const obtenerDatosAnoServicio = async (publicadores) => {
  const mesVencido = getMesVencido()
  const anoServicio = getAnoServicioVencido()   // ← reemplaza el bloque armado a mano

  const todosMeses = getMesesAnoServicio(anoServicio)
  const limiteNum = mesVencido.ano * 12 + (mesVencido.mes - 1)
  const meses = todosMeses.filter(m => (m.ano * 12 + (m.mes - 1)) <= limiteNum)

  const resultados = await Promise.all(
    meses.map(async ({ mes, ano }) => {
      const [informes, asistencia] = await Promise.all([
        db.getInformesByMesAno(mes, ano),
        db.getDatosMensuales(mes, ano)
      ])

      const activos = publicadores.filter(p => debiaInformarEnMesEspecifico(p, mes, ano)).length

      const horasAux = informes
        .filter(i => i.precursor_auxiliar)
        .reduce((sum, i) => sum + (i.horas || 0), 0)

      const cantidadAux = informes.filter(i => i.precursor_auxiliar).length
      const cursosTotales = informes.reduce((sum, i) => sum + (i.cursos || 0), 0)
      const noParticiparon = informes.filter(i => !i.participo).length

      // Usamos tipo_servicio_mes (guardado en cada informe) en vez del
      // tipo_servicio actual, para reflejar correctamente la historia
      const horasReg = informes
        .filter(i => i.tipo_servicio_mes === 'Precursor Regular' || i.tipo_servicio_mes === 'Precursor Especial')
        .reduce((sum, i) => sum + (i.horas || 0), 0)

      return {
        mesLabel: `${getMesNombre(mes).slice(0, 3)} '${String(ano).slice(2)}`,
        mes,
        ano,
        activos,
        asistenciaFinSemana: asistencia?.asistencia_fin_semana ?? null,
        asistenciaEntreSemana: asistencia?.asistencia_entre_semana ?? null,
        cantidadAux,   
        horasAux,
        horasReg,
        cursosTotales,
        noParticiparon 
      }
    })
  )

  return { meses: resultados, anoServicioLabel: anoServicio.label }
}