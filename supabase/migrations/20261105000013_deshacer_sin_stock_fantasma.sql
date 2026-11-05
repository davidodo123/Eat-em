-- Deshacer una comida no debe crear comida de la nada. El stock no baja de 0, pero el movimiento
-- guardaba el delta pedido: con 0 g en casa, "Hecha" (-250) dejaba 0 y "Deshacer" (+250) dejaba 250.
-- Ahora el movimiento guarda lo que salio de verdad y, si no salio nada, no se registra.
CREATE OR REPLACE FUNCTION public.tg_ajustar_movimiento() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE hay NUMERIC;
BEGIN
  IF NEW.delta < 0 THEN
    SELECT cantidad INTO hay FROM inventario
    WHERE grupo_id = NEW.grupo_id AND ingrediente_id = NEW.ingrediente_id FOR UPDATE;
    NEW.delta := greatest(NEW.delta, -coalesce(hay, 0));
    IF NEW.delta = 0 THEN RETURN NULL; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS inventario_movimientos_ajustar ON inventario_movimientos;
CREATE TRIGGER inventario_movimientos_ajustar
  BEFORE INSERT ON inventario_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.tg_ajustar_movimiento();
