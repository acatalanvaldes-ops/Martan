-- ============================================================
-- Martan · Correo oficial de contacto: administracion@martan.cl
-- Reemplaza el correo de ejemplo que se cargó al crear la base.
-- ============================================================

update configuracion
   set email_contacto = 'administracion@martan.cl'
 where id = 1 and (email_contacto is null or email_contacto = 'contacto@martan.cl');
