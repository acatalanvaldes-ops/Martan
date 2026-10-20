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
    const ocultos = productos.filter((p) => !p.activo).length;
    // Si el producto aún tiene el precio marcador (3), el campo de precio parte vacío.
    const precioInicial = (p) => (p.precio > 3 ? p.precio : '');
    let categoriaActual = null;
    contenido.innerHTML = `
      <div class="aviso" style="margin-bottom:12px">
        <strong>Cómo cargar precios:</strong> escribe el <strong>costo neto</strong> (sin IVA) y el <strong>% de margen</strong>:
        el <strong>precio final con IVA</strong> se calcula solo (redondeado a $10). También puedes escribir el precio final y el margen se calcula al revés.
        Después ingresa el stock, marca <strong>Visible</strong> y presiona <strong>Guardar</strong>.
        ${ocultos ? `<br>${ocultos} producto(s) oculto(s) en la tienda.` : ''}
      </div>
      <div class="tabla-envoltura"><table class="tabla-precios">
        <thead><tr>
          <th>Foto</th>
          <th>Producto</th>
          <th>Costo neto<br><small>sin IVA</small></th>
          <th>Margen<br><small>% sobre costo</small></th>
          <th>Precio neto</th>
          <th>IVA<br><small>19%</small></th>
          <th>Precio final<br><small>con IVA</small></th>
          <th>Ganancia<br><small>por unidad</small></th>
          <th>Stock</th>
          <th>Visible</th>
          <th></th>
        </tr></thead>
        <tbody>${productos.map((p) => {
          const cabecera = p.categoria !== categoriaActual
            ? `<tr class="fila-categoria"><td colspan="11">${esc(p.categoria)}</td></tr>` : '';
          categoriaActual = p.categoria;
          return `${cabecera}
          <tr data-fila="${p.id}">
            <td data-foto-celda="${p.id}">${celdaFoto(p)}</td>
            <td data-nombre style="${p.activo ? '' : 'opacity:.6'}"><strong>${esc(p.nombre)}</strong>${p.destacado ? ' ★' : ''}<br><small>${esc(p.formato)}</small></td>
            <td><div class="campo-pesos"><span>$</span><input type="number" min="0" step="1" inputmode="numeric" value="${p.costo ?? ''}" data-campo="costo" placeholder="0" aria-label="Costo neto de ${esc(p.nombre)}"></div></td>
            <td><div class="campo-pct"><input type="number" step="0.1" inputmode="decimal" value="${p.margen ?? ''}" data-campo="margen" placeholder="0" aria-label="Margen de ${esc(p.nombre)}"><span>%</span></div></td>
            <td data-calc="neto" class="calc">—</td>
            <td data-calc="iva" class="calc">—</td>
            <td><div class="campo-pesos campo-pesos--final"><span>$</span><input type="number" min="0" step="10" inputmode="numeric" value="${precioInicial(p)}" data-campo="precio" placeholder="0" aria-label="Precio final de ${esc(p.nombre)}"></div></td>
            <td data-calc="ganancia" class="calc">—</td>
            <td><input class="campo-stock" type="number" min="0" step="1" inputmode="numeric" value="${p.stock}" data-campo="stock" aria-label="Stock de ${esc(p.nombre)}"></td>
            <td style="text-align:center"><input type="checkbox" data-campo="activo" ${p.activo ? 'checked' : ''} aria-label="${esc(p.nombre)} visible en la tienda"></td>
            <td style="white-space:nowrap">
              <button class="btn btn--azul btn--chico" data-guardar="${p.id}" disabled>Guardar</button>
              <button class="btn btn--claro btn--chico" data-editar="${p.id}">Editar</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`;
    contenido.querySelectorAll('[data-fila]').forEach((fila) => calcular(fila));
  }

  // ---------- Fotos ----------
  function celdaFoto(p) {
    if (!p.imagen_url) {
      return `<button type="button" class="foto-admin foto-admin--vacia" data-subir-foto="${p.id}" title="Subir foto de ${esc(p.nombre)}">+ Foto</button>`;
    }
    return `
      <button type="button" class="foto-admin" data-subir-foto="${p.id}" title="Cambiar foto de ${esc(p.nombre)}">
        <img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy">
      </button>
      <button type="button" class="foto-admin__quitar" data-quitar-foto="${p.id}">Quitar</button>`;
  }

  const selectorFoto = document.createElement('input');
  selectorFoto.type = 'file';
  selectorFoto.accept = 'image/*'; // en el celular permite usar la cámara
  selectorFoto.hidden = true;
  document.body.appendChild(selectorFoto);
  let fotoPara = null;

  // Achica la foto en el navegador (máx. 800 px, JPEG): sube rápido aunque venga pesada del celular.
  function prepararFoto(archivo) {
    return new Promise((resolver, rechazar) => {
      if (!archivo.type.startsWith('image/')) { rechazar(new Error('El archivo no es una imagen.')); return; }
      const lector = new FileReader();
      lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => rechazar(new Error('Formato de imagen no soportado. Usa JPG o PNG.'));
        img.onload = () => {
          const escala = Math.min(1, 800 / Math.max(img.width, img.height));
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.round(img.width * escala);
          lienzo.height = Math.round(img.height * escala);
          const ctx = lienzo.getContext('2d');
          ctx.fillStyle = '#fff'; // fondo blanco para PNG con transparencia
          ctx.fillRect(0, 0, lienzo.width, lienzo.height);
          ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
          resolver(lienzo.toDataURL('image/jpeg', 0.85));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  async function guardarFoto(id, imagen) {
    const p = productos.find((x) => x.id === id);
    const celda = contenido.querySelector(`[data-foto-celda="${id}"]`);
    celda.innerHTML = `<div class="foto-admin foto-admin--vacia">${imagen ? 'Subiendo…' : 'Quitando…'}</div>`;
    try {
      const guardado = await pedir('foto', { method: 'POST', body: { id, imagen } });
      p.imagen_url = guardado.imagen_url;
      window.Tienda.toast(imagen ? 'Foto guardada' : 'Foto quitada');
    } catch (err) {
      window.Tienda.toast(err.message);
    }
    celda.innerHTML = celdaFoto(p);
  }

  contenido.addEventListener('click', (e) => {
    const subir = e.target.closest('[data-subir-foto]');
    if (subir) { fotoPara = Number(subir.dataset.subirFoto); selectorFoto.value = ''; selectorFoto.click(); return; }
    const quitar = e.target.closest('[data-quitar-foto]');
    if (quitar && confirm('¿Quitar la foto de este producto?')) guardarFoto(Number(quitar.dataset.quitarFoto), null);
  });

  selectorFoto.addEventListener('change', async () => {
    const archivo = selectorFoto.files[0];
    if (!archivo || !fotoPara) return;
    try {
      guardarFoto(fotoPara, await prepararFoto(archivo));
    } catch (err) {
      window.Tienda.toast(err.message);
    }
  });

  // ---------- Cálculo de precios ----------
  const IVA = 0.19;
  const aNumero = (input) => {
    const v = String(input.value).replace(',', '.').trim();
    return v === '' ? null : Number(v);
  };
  const redondear10 = (n) => Math.round(n / 10) * 10;

  // origen: campo que cambió ('costo' | 'margen' | 'precio'), o nada para solo mostrar el desglose.
  function calcular(fila, origen) {
    const campo = (c) => fila.querySelector(`[data-campo="${c}"]`);
    const costo = aNumero(campo('costo'));
    const margen = aNumero(campo('margen'));

    if ((origen === 'costo' || origen === 'margen') && costo > 0 && margen !== null) {
      campo('precio').value = redondear10(costo * (1 + margen / 100) * (1 + IVA));
    }
    const precio = aNumero(campo('precio'));
    if (origen === 'precio' && costo > 0 && precio > 0) {
      campo('margen').value = ((precio / (1 + IVA) / costo - 1) * 100).toFixed(1);
    }

    const celda = (c) => fila.querySelector(`[data-calc="${c}"]`);
    if (precio > 0) {
      const neto = Math.round(precio / (1 + IVA));
      celda('neto').textContent = clp(neto);
      celda('iva').textContent = clp(precio - neto);
      if (costo > 0) {
        const ganancia = neto - costo;
        celda('ganancia').textContent = clp(ganancia);
        celda('ganancia').className = `calc ${ganancia < 0 ? 'calc--negativo' : 'calc--positivo'}`;
      } else {
        celda('ganancia').textContent = '—';
        celda('ganancia').className = 'calc';
      }
    } else {
      ['neto', 'iva', 'ganancia'].forEach((c) => { celda(c).textContent = '—'; celda(c).className = 'calc'; });
    }
  }

  // Edición rápida: recalcula y habilita "Guardar" en la fila al cambiar cualquier campo.
  contenido.addEventListener('input', (e) => {
    const fila = e.target.closest('[data-fila]');
    const c = e.target.dataset.campo;
    if (!fila || !c) return;
    if (['costo', 'margen', 'precio'].includes(c)) calcular(fila, c);
    fila.querySelector('[data-guardar]').disabled = false;
  });

  // Enter en cualquier campo de la fila = Guardar.
  contenido.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.dataset.campo) return;
    const b = e.target.closest('[data-fila]')?.querySelector('[data-guardar]');
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  });

  contenido.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-guardar]');
    if (!b) return;
    const fila = b.closest('[data-fila]');
    const p = productos.find((x) => x.id === Number(b.dataset.guardar));
    const valor = (c) => fila.querySelector(`[data-campo="${c}"]`);
    const precio = aNumero(valor('precio'));
    const datos = {
      ...p,
      costo: valor('costo').value,
      margen: valor('margen').value,
      precio: precio > 3 ? precio : p.precio, // sin precio real se mantiene el marcador (producto oculto)
      stock: valor('stock').value || 0,
      activo: valor('activo').checked,
    };
    if (datos.activo && !(precio > 3)) {
      window.Tienda.toast('Escribe el precio (o el costo y el margen) antes de mostrar el producto');
      valor(aNumero(valor('costo')) ? 'margen' : 'costo').focus();
      return;
    }
    if (datos.activo && Number(datos.precio) <= 3) {
      window.Tienda.toast('Escribe el precio real antes de mostrar el producto');
      valor('precio').focus();
      return;
    }
    b.disabled = true;
    b.textContent = 'Guardando…';
    try {
      const guardado = await pedir('producto', { method: 'POST', body: datos });
      Object.assign(p, guardado);
      b.textContent = 'Guardado ✓';
      fila.querySelector('[data-nombre]').style.opacity = p.activo ? '' : '.6';
      setTimeout(() => { b.textContent = 'Guardar'; }, 1500);
    } catch (err) {
      b.disabled = false;
      b.textContent = 'Guardar';
      window.Tienda.toast(err.message);
    }
  });

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
