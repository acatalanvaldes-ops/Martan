# Martan · Tienda de congelados

Tienda online con catálogo, carro de compras, checkout con despacho o retiro, pago con **Mercado Pago** y panel de administración.

- **Frontend:** HTML, CSS y JavaScript sin compilación (`index.html`, `checkout.html`, `pedido.html`, `admin.html`, `assets/`).
- **Backend:** funciones serverless de Vercel en `api/` (Node 24, sin dependencias).
- **Base de datos:** Supabase (Postgres). El esquema está en `supabase/schema.sql`.

## Flujo de compra

1. El cliente arma el carro (se guarda en su navegador).
2. `POST /api/checkout` vuelve a calcular precios, stock, despacho y monto mínimo **en el servidor**, crea el pedido (`pendiente_pago`) y una preferencia de Mercado Pago.
3. El cliente paga en Mercado Pago y vuelve a `/pedido?id=…`.
4. Mercado Pago avisa a `/api/webhook-mp`. La función consulta el pago a la API de MP y, si está aprobado, llama a `marcar_pedido_pagado`, que marca el pedido como pagado y descuenta stock una sola vez.
5. Desde `/admin` se gestionan los estados: en preparación → en camino / listo para retiro → entregado.

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en <https://supabase.com> (región São Paulo, la más cercana a Chile).
2. Abre **SQL Editor → New query**, pega todo `supabase/schema.sql` y ejecútalo. Se crean las tablas con productos, comunas y punto de retiro de ejemplo.
3. En **Project Settings → API** copia:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (o la *secret key* `sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY`

> La clave secreta solo va en Vercel y nunca en el navegador. Las tablas tienen RLS activado sin políticas, así que la clave pública no puede leer nada.

### 2. Mercado Pago
1. Entra a <https://www.mercadopago.cl/developers/panel> → **Crear aplicación** (Checkout Pro).
2. En **Credenciales de prueba** copia el **Access Token** → `MP_ACCESS_TOKEN`.
3. En **Webhooks**, configura la URL `https://TU-DOMINIO/api/webhook-mp` con el evento **Pagos** y copia la **clave secreta** → `MP_WEBHOOK_SECRET`.
4. Para probar, crea **cuentas de prueba** (vendedor y comprador) y usa las [tarjetas de prueba](https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).
5. Cuando todo funcione, reemplaza el token por el **Access Token de producción**.

### 3. Variables de entorno en Vercel
En **Project → Settings → Environment Variables**:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de Supabase |
| `MP_ACCESS_TOKEN` | Access Token de Mercado Pago (primero el de prueba) |
| `MP_WEBHOOK_SECRET` | Clave secreta de los webhooks de MP |
| `ADMIN_PASSWORD` | Clave del panel `/admin` (mínimo 10 caracteres; usa una larga) |
| `SITE_URL` | *(opcional)* dominio final, ej. `https://martan.cl` |

Después de agregarlas, vuelve a desplegar (**Deployments → Redeploy**).

### 4. Protección de despliegues
Vercel Authentication debe aplicar **solo a las previews**. Si protege producción, Mercado Pago no puede llamar al webhook y los clientes no pueden ver la tienda.

## Administración
- `/admin`: pedidos (con filtro por estado y cambio de estado) y productos (crear, editar, stock, precio, oferta, visibilidad).
- Las comunas de despacho, los puntos de retiro y la configuración (monto mínimo, despacho gratis, WhatsApp, correo) se editan en Supabase → **Table Editor** (`zonas_despacho`, `puntos_retiro`, `configuracion`).
- Imágenes de productos: sube la foto a Supabase Storage (bucket público) o a cualquier sitio con `https://` y pega la URL en el producto.

## Pendientes sugeridos
- Correos automáticos de confirmación (por ejemplo, con Resend).
- Boleta electrónica (integración con el SII o con un proveedor de facturación).
- Completar los textos legales (`terminos.html`, `privacidad.html`) con los datos de la empresa.
- Fotos reales, logo y dominio propio.
