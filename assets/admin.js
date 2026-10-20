/* Martan · panel de administración (pedidos y productos). */
(function () {
  'use strict';
  const { api, clp, esc } = window.Tienda;

  const ESTADOS = {
    pendiente_pago: 'Pendiente de pago', pagado: 'Pagado', rechazado: 'Rechazado', en_preparacion: 'En preparación',
    en_camino: 'En camino', listo_retiro: 'Listo para retiro', entregado: 'Entregado', cancelado: 'Cancelado',
  };
  const CLAVE_SESION = 'martan_admin';

  const login = document.querySelector('[data-login]');
  const panel = document.querySelector('[data-panel]');
  const contenido = document.querySelector('[data-contenido]');
  const filtro = document.querySelector('[data-filtro-estado]');
  const botonNuevo = document.querySelector('[data-nuevo]');
  const salir = document.querySelector('[data-salir]');
  const dialogo = document.querySelector('[data-dialogo]');
  const formProducto = document.querySelector('[data-form-producto]');

  let clave = '';
  try { clave = sessionStorage.getItem(CLAVE_SESION) || ''; } catch { /* sin almacenamiento */ }
  let tab = 'pedidos';
  let productos = [];
  let editando = null;

  filtro.innerHTML += Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  const pedir = (accion, opciones = {}) =>
    api(`/api/admin?accion=${accion}${opciones.qs || ''}`, { ...opciones, headers: { 'x-admin-clave': clave } });

  const fecha = (s) => new Date(s).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });

  // ---------- Sesión ----------
  function mostrarPanel(visible) {
    login.classList.toggle('oculto', visible);
    panel.classList.toggle('oculto', !visible);
    salir.classList.toggle('oculto', !visible);
  }

  login.addEventListener('submit', async (e) => {
    e.preventDefault();
    clave = login.clave.value;
    const msg = document.querySelector('[data-login-msg]');
    msg.innerHTML = '';
    try {
      await cargar();
      try { sessionStorage.setItem(CLAVE_SESION, clave); } catch { /* sin almacenamiento */ }
      mostrarPanel(true);
    } catch (err) {
      msg.innerHTML = `<div class="aviso aviso--error">${esc(err.message)}</div>`;
    }
  });

  salir.addEventListener('click', () => {
    clave = '';
    try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento */ }
    mostrarPanel(false);
    login.reset();
  });

  // ---------- Pestañas ----------
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    filtro.classList.toggle('oculto', tab !== 'pedidos');
    botonNuevo.classList.toggle('oculto', tab !== 'productos');
    cargar().catch(mostrarError);
  }));
  filtro.addEventListener('change', () => cargar().catch(mostrarError));
  document.querySelector('[data-recargar]').addEventListener('click', () => cargar().catch(mostrarError));

  function mostrarError(err) {
    if (err.status === 401) { salir.click(); return; }
    contenido.innerHTML = `<div class="aviso aviso--error">${esc(err.message)}</div>`;
  }

  async function cargar() {
    contenido.innerHTML = '<div class="vacio">Cargando…</div>';
    if (tab === 'pedidos') {
      const qs = filtro.value ? `&estado=${filtro.value}` : '';
      renderPedidos(await pedir('pedidos', { qs }));
    } else {
      productos = await pedir('productos');
      renderProductos();
    }
  }

  // ---------- Pedidos ----------
  function renderPedidos(pedidos) {
    if (!pedidos.length) { contenido.innerHTML = '<div class="vacio">No hay pedidos.</div>'; return; }
    const pagados = pedidos.filter((p) => !['pendiente_pago', 'rechazado', 'cancelado'].includes(p.estado));
    const ventas = pagados.reduce((s, p) => s + p.total, 0);
    contenido.innerHTML = `
      <p style="color:var(--texto-suave);margin:0 0 12px">${pedidos.length} pedidos mostrados · ${pagados.length} pagados · ventas ${clp(ventas)}</p>
      <div class="tabla-envoltura"><table>
        <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Entrega</th><th>Productos</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>${pedidos.map((p) => `
          <tr>
            <td><strong>${p.numero}</strong></td>
            <td>${fecha(p.creado_en)}</td>
            <td>${esc(p.cliente_nombre)}<br><a href="mailto:${esc(p.cliente_email)}">${esc(p.cliente_email)}</a><br><a href="tel:${esc(p.cliente_telefono)}">${esc(p.cliente_telefono)}</a>${p.cliente_rut ? `<br>${esc(p.cliente_rut)}` : ''}</td>
            <td>${p.entrega === 'despacho'
              ? `Despacho · ${esc(p.comuna)}<br>${esc(p.direccion)}${p.referencia ? `<br><small>${esc(p.referencia)}</small>` : ''}`
              : `Retiro · ${esc(p.puntos_retiro?.nombre || '')}`}
              ${p.notas ? `<br><small><strong>Nota:</strong> ${esc(p.notas)}</small>` : ''}</td>
            <td><ul class="detalle-items">${p.pedido_items.map((i) => `<li>${i.cantidad} × ${esc(i.nombre)}</li>`).join('')}</ul></td>
            <td><strong>${clp(p.total)}</strong>${p.costo_despacho ? `<br><small>envío ${clp(p.costo_despacho)}</small>` : ''}</td>
            <td>
              <span class="estado-pill" data-e="${p.estado}">${ESTADOS[p.estado]}</span><br>
              <select data-cambiar="${p.id}" aria-label="Cambiar estado del pedido ${p.numero}" style="margin-top:6px">
                ${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${k === p.estado ? 'selected' : ''}>${v}</option>`).join('')}
              </select>
              ${p.mp_pago_id ? `<br><small>MP #${esc(p.mp_pago_id)}</small>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  contenido.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-cambiar]');
    if (!sel) return;
    const estado = sel.value;
    if (['pagado'].includes(estado) && !confirm('Marcar como pagado a mano NO descuenta stock ni verifica el pago en Mercado Pago. ¿Continuar?')) {
      cargar(); return;
    }
    sel.disabled = true;
    try {
      await pedir('estado', { method: 'POST', body: { id: sel.dataset.cambiar, estado } });
      window.Tienda.toast('Estado actualizado');
      cargar();
    } catch (err) {
      mostrarError(err);
    }
  });

  // ---------- Productos ----------
  function renderProductos() {
    document.getElementById('lista-categorias').innerHTML =
      [...new Set(productos.map((p) => p.categoria))].map((c) => `<option value="${esc(c)}">`).join('');
    if (!productos.length) { contenido.innerHTML = '<div class="vacio">Aún no hay productos.</div>'; return; }
    contenido.innerHTML = `
      <div class="tabla-envoltura"><table>
        <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Visible</th><th></th></tr></thead>
        <tbody>${productos.map((p) => `
          <tr style="${p.activo ? '' : 'opacity:.55'}">
            <td><strong>${esc(p.nombre)}</strong>${p.destacado ? ' ★' : ''}<br><small>${esc(p.formato)}</small></td>
            <td>${esc(p.categoria)}</td>
            <td>${clp(p.precio)}${p.precio_anterior ? `<br><small><s>${clp(p.precio_anterior)}</s></small>` : ''}</td>
            <td><strong style="color:${p.stock === 0 ? 'var(--rojo)' : p.stock <= 5 ? 'var(--ambar)' : 'inherit'}">${p.stock}</strong></td>
            <td>${p.activo ? 'Sí' : 'No'}</td>
            <td><button class="btn btn--claro btn--chico" data-editar="${p.id}">Editar</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  function abrirProducto(p) {
    editando = p;
    formProducto.reset();
    document.querySelector('[data-dialogo-titulo]').textContent = p ? `Editar: ${p.nombre}` : 'Nuevo producto';
    document.querySelector('[data-dialogo-msg]').innerHTML = '';
    const f = formProducto.elements;
    const v = p || { activo: true, destacado: false, orden: 0, stock: 0 };
    ['nombre', 'categoria', 'formato', 'precio', 'precio_anterior', 'stock', 'orden', 'imagen_url', 'descripcion']
      .forEach((k) => { f[k].value = v[k] ?? ''; });
    f.activo.checked = Boolean(v.activo);
    f.destacado.checked = Boolean(v.destacado);
    dialogo.showModal();
  }

  contenido.addEventListener('click', (e) => {
    const b = e.target.closest('[data-editar]');
    if (b) abrirProducto(productos.find((p) => p.id === Number(b.dataset.editar)));
  });
  botonNuevo.addEventListener('click', () => abrirProducto(null));

  formProducto.addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'guardar') return; // "Cancelar" cierra el diálogo
    e.preventDefault();
    const f = formProducto.elements;
    const datos = {
      id: editando?.id,
      nombre: f.nombre.value, categoria: f.categoria.value, formato: f.formato.value,
      precio: f.precio.value, precio_anterior: f.precio_anterior.value, stock: f.stock.value, orden: f.orden.value || 0,
      imagen_url: f.imagen_url.value, descripcion: f.descripcion.value,
      activo: f.activo.checked, destacado: f.destacado.checked,
      slug: editando?.slug,
    };
    try {
      await pedir('producto', { method: 'POST', body: datos });
      dialogo.close();
      window.Tienda.toast('Producto guardado');
      cargar();
    } catch (err) {
      document.querySelector('[data-dialogo-msg]').innerHTML = `<div class="aviso aviso--error">${esc(err.message)}</div>`;
    }
  });

  // ---------- Inicio ----------
  if (clave) {
    cargar().then(() => mostrarPanel(true)).catch(() => mostrarPanel(false));
  }
})();
