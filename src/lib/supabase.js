// supabase.js - VERSIÓN CORREGIDA
// Copiar a: src/lib/supabase.js (REEMPLAZAR)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno de Supabase. ' +
    'Crea un archivo .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funciones helper para la base de datos
export const db = {
  // ============ PUBLICADORES ============
  
  async getAllPublicadores() {
    const { data, error } = await supabase
      .from('publicadores')
      .select('*')
      .order('apellido', { ascending: true })
    
    if (error) throw error
    return data
  },

  async getPublicador(id) {
    const { data, error } = await supabase
      .from('publicadores')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async addPublicador(publicador) {
    const { data, error } = await supabase
      .from('publicadores')
      .insert([publicador])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updatePublicador(id, updates) {
    const { data, error } = await supabase
      .from('publicadores')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async deletePublicador(id) {
    const { error } = await supabase
      .from('publicadores')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // ============ INFORMES ============
  
  async getInformesByMesAno(mes, ano) {
    const { data, error } = await supabase
      .from('informes')
      .select(`
        *,
        publicadores (
          nombre,
          apellido,
          grupo,
          tipo_servicio
        )
      `)
      .eq('mes', mes)
      .eq('ano', ano)
    
    if (error) throw error
    return data
  },

  async getInformesByPublicador(publicadorId) {
    const { data, error } = await supabase
      .from('informes')
      .select('*')
      .eq('publicador_id', publicadorId)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
    
    if (error) throw error
    return data
  },

  async addInforme(informe) {
    const { data, error } = await supabase
      .from('informes')
      .insert([informe])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateInforme(id, updates) {
    const { data, error } = await supabase
      .from('informes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getInformeByPublicadorMesAno(publicadorId, mes, ano) {
    const { data, error } = await supabase
      .from('informes')
      .select('*')
      .eq('publicador_id', publicadorId)
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle()
    
    if (error) throw error
    return data
  },

  async deleteInforme(id) {
    const { error } = await supabase
      .from('informes')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // ============ ESTADÍSTICAS ============
  
  async getEstadisticasMes(mes, ano) {
    const { data, error } = await supabase
      .from('vista_estadisticas_mes')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle()
    
    if (error) throw error
    return data
  },

  // ============ FUNCIONES AUXILIARES ============

  async getInformesRango(mesInicio, anoInicio, mesFin, anoFin) {
    // Para obtener múltiples meses de informes (útil para año de servicio)
    const informes = []
    
    let mesActual = mesInicio
    let anoActual = anoInicio
    
    while (anoActual < anoFin || (anoActual === anoFin && mesActual <= mesFin)) {
      const data = await this.getInformesByMesAno(mesActual, anoActual)
      informes.push(...data)
      
      mesActual++
      if (mesActual > 12) {
        mesActual = 1
        anoActual++
      }
    }
    
    return informes
  },

  // ============ DATOS MENSUALES (Asistencia) ============
  
  async saveDatosMensuales(datos) {
    const { data, error } = await supabase
      .from('datos_mensuales')
      .upsert(
        {
          mes: datos.mes,
          ano: datos.ano,
          asistencia_fin_semana: datos.asistencia_fin_semana,
          asistencia_entre_semana: datos.asistencia_entre_semana
        },
        { 
          onConflict: 'mes,ano',
          ignoreDuplicates: false 
        }
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getDatosMensuales(mes, ano) {
    const { data, error } = await supabase
      .from('datos_mensuales')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No existe registro, retornar null
        return null
      }
      throw error
    }
    
    return data
  },

  async getAllRecordatorios() {
  const { data, error } = await supabase
    .from('recordatorios')
    .select('*')
    .order('fecha_fin', { ascending: true, nullsLast: true })
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
},

async getRecordatoriosActivos() {
  const { data, error } = await supabase
    .from('recordatorios')
    .select('*')
    .eq('completada', false)
    .order('fecha_fin', { ascending: true, nullsLast: true })
  
  if (error) throw error
  return data
},

async getRecordatoriosDashboard() {
  const { data, error } = await supabase
    .from('recordatorios')
    .select('*')
    .eq('completada', false)
    .eq('mostrar_en_dashboard', true)
    .order('fecha_fin', { ascending: true, nullsLast: true })
    .order('orden', { ascending: true })
    .limit(5)
  
  if (error) throw error
  return data
},

async addRecordatorio(recordatorio) {
  const { data, error } = await supabase
    .from('recordatorios')
    .insert([recordatorio])
    .select()
    .single()
  
  if (error) throw error
  return data
},

async updateRecordatorio(id, updates) {
  const { data, error } = await supabase
    .from('recordatorios')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
},

async deleteRecordatorio(id) {
  const { error } = await supabase
    .from('recordatorios')
    .delete()
    .eq('id', id)
  
  if (error) throw error
},

async marcarCompletada(id) {
  const { data, error } = await supabase
    .from('recordatorios')
    .update({ completada: true })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
},

async toggleDashboard(id, mostrar) {
  const { data, error } = await supabase
    .from('recordatorios')
    .update({ mostrar_en_dashboard: mostrar })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
},
}

