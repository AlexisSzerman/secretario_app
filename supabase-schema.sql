-- CORRECCIÓN: Campo "en_congregacion_desde"
-- Reemplaza "activo_desde" con nombre más claro
-- Ejecutar en Supabase SQL Editor

-- 1. Renombrar columna si ya existe, o crear si no existe
DO $$ 
BEGIN
  -- Intentar renombrar si existe activo_desde
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'publicadores' AND column_name = 'activo_desde'
  ) THEN
    ALTER TABLE publicadores 
    RENAME COLUMN activo_desde TO en_congregacion_desde;
  ELSE
    -- Crear si no existe
    ALTER TABLE publicadores 
    ADD COLUMN IF NOT EXISTS en_congregacion_desde DATE;
  END IF;
END $$;

COMMENT ON COLUMN publicadores.en_congregacion_desde IS 'Fecha desde la cual está en esta congregación (mudanza o reactivación). Solo se evalúa "sin informar" desde esta fecha.';

-- 2. Inicializar para publicadores actuales que no tienen el campo
-- Los activos actuales: ponemos fecha de hace 2 años (para no perder historial)
UPDATE publicadores 
SET en_congregacion_desde = CURRENT_DATE - INTERVAL '2 years'
WHERE tipo_servicio != 'Inactivo' 
  AND en_congregacion_desde IS NULL;

-- 3. Función helper mejorada
CREATE OR REPLACE FUNCTION debe_informar_en_mes(
  p_en_congregacion_desde DATE,
  p_tipo_servicio TEXT,
  p_mes INT,
  p_ano INT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Si es inactivo, no debe informar
  IF p_tipo_servicio = 'Inactivo' THEN
    RETURN FALSE;
  END IF;
  
  -- Si no tiene fecha, asumimos que sí debe informar
  IF p_en_congregacion_desde IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar si el mes está después de en_congregacion_desde
  DECLARE
    fecha_mes DATE := make_date(p_ano, p_mes, 1);
  BEGIN
    RETURN fecha_mes >= p_en_congregacion_desde;
  END;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para saber si puede cargar informes históricos
-- (Para precursores regulares que vienen de otra congregación)
CREATE OR REPLACE FUNCTION puede_cargar_informe_historico(
  p_tipo_servicio TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Solo precursores regulares pueden cargar informes anteriores a su llegada
  -- (para completar promedio anual)
  RETURN p_tipo_servicio IN ('Precursor Regular', 'Precursor Especial');
END;
$$ LANGUAGE plpgsql;

-- Verificar
SELECT 'Campo en_congregacion_desde configurado' as resultado;
