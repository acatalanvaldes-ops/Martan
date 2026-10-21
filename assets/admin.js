/* Martan · panel de administración (pedidos y productos). */
(function () {
  'use strict';
  const { api, clp, esc } = window.Tienda;

  const ESTADOS = {
    pendiente_pago: 'Pendiente de pago', pagado: 'Pagado', rechazado: 'Rechazado', en_preparacion: 'En preparación',
    en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado',
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
    } else if (tab === 'mensajes') {
      renderMensajes(await pedir('mensajes'));
    } else {
      productos = await pedir('productos');
      renderProductos();
    }
  }

  // ---------- Mensajes del formulario de contacto ----------
  const TIPOS_MENSAJE = { sugerencia: 'Sugerencia', reclamo: 'Reclamo', cotizacion: 'Cotización', factura: 'Solicitud de factura' };
  const ESTADOS_MENSAJE = { nuevo: 'Nuevo', en_proceso: 'En proceso', cerrado: 'Cerrado' };

  function renderMensajes(mensajes) {
    if (!mensajes.length) { contenido.innerHTML = '<div class="vacio">Aún no hay mensajes.</div>'; return; }
    const nuevos = mensajes.filter((m) => m.estado === 'nuevo').length;
    contenido.innerHTML = `
      <p style="color:var(--texto-suave);margin:0 0 12px">${mensajes.length} mensajes · <strong>${nuevos} nuevos</strong></p>
      <div class="tabla-envoltura"><table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Contacto</th><th>Pedido</th><th>Mensaje</th><th>Estado</th></tr></thead>
        <tbody>${mensajes.map((m) => {
          const asunto = encodeURIComponent(`Martan · ${TIPOS_MENSAJE[m.tipo]}${m.pedido_numero ? ` · Pedido N° ${m.pedido_numero}` : ''}`);
          return `
          <tr style="${m.estado === 'cerrado' ? 'opacity:.6' : ''}">
            <td style="white-space:nowrap">${fecha(m.creado_en)}</td>
            <td><span class="estado-pill tipo-${m.tipo}">${TIPOS_MENSAJE[m.tipo] || esc(m.tipo)}</span></td>
            <td><strong>${esc(m.nombre)}</strong><br>RUT ${esc(m.rut)}<br>
              <a href="mailto:${esc(m.email)}?subject=${asunto}">${esc(m.email)}</a>${m.telefono ? `<br><a href="tel:${esc(m.telefono)}">${esc(m.telefono)}</a>` : ''}</td>
            <td>${m.pedido_numero ? `N° ${m.pedido_numero}` : '—'}</td>
            <td style="max-width:420px;white-space:pre-wrap">${esc(m.mensaje)}</td>
            <td><select data-mensaje-estado="${m.id}" aria-label="Estado del mensaje">
              ${Object.entries(ESTADOS_MENSAJE).map(([k, v]) => `<option value="${k}" ${k === m.estado ? 'selected' : ''}>${v}</option>`).join('')}
            </select></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`;
  }

  contenido.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-mensaje-estado]');
    if (!sel) return;
    sel.disabled = true;
    try {
      await pedir('mensaje-estado', { method: 'POST', body: { id: Number(sel.dataset.mensajeEstado), estado: sel.value } });
      sel.closest('tr').style.opacity = sel.value === 'cerrado' ? '.6' : '';
      window.Tienda.toast('Mensaje actualizado');
    } catch (err) {
      window.Tienda.toast(err.message);
    }
    sel.disabled = false;
  });

  // ---------- Pedidos ----------
  function renderPedidos(pedidos) {
    if (!pedidos.length) { contenido.innerHTML = '<div class="vacio">No hay pedidos.</div>'; return; }
    const pagados = pedidos.filter((p) => !['pendiente_pago', 'rechazado', 'cancelado'].includes(p.estado));
    const ventas = pagados.reduce((s, p) => s + p.total, 0);
    contenido.innerHTML = `
      <p style="color:var(--texto-suave);margin:0 0 12px">${pedidos.length} pedidos mostrados · ${pagados.length} pagados · ventas ${clp(ventas)}</p>
      <div class="tabla-envoltura"><table>
        <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Despacho</th><th>Productos</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>${pedidos.map((p) => `
          <tr>
            <td><strong>${p.numero}</strong></td>
            <td>${fecha(p.creado_en)}</td>
            <td>${esc(p.cliente_nombre)}<br><a href="mailto:${esc(p.cliente_email)}">${esc(p.cliente_email)}</a><br><a href="tel:${esc(p.cliente_telefono)}">${esc(p.cliente_telefono)}</a>${p.cliente_rut ? `<br>${esc(p.cliente_rut)}` : ''}</td>
            <td>${esc(p.comuna)}<br>${esc(p.direccion)}${p.referencia ? `<br><small>${esc(p.referencia)}</small>` : ''}
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
              <button class="btn btn--peligro btn--chico" data-eliminar="${p.id}" title="Eliminar ${esc(p.nombre)}" aria-label="Eliminar ${esc(p.nombre)}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
              </button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`;
    contenido.querySelectorAll('[data-fila]').forEach((fila) => calcular(fila));
  }

  // ---------- Eliminar ----------
  contenido.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-eliminar]');
    if (!b) return;
    const id = Number(b.dataset.eliminar);
    const p = productos.find((x) => x.id === id);
    const nombre = `${p.nombre}${p.formato ? ` (${p.formato})` : ''}`;
    const ok = confirm(
      `¿Eliminar "${nombre}" definitivamente?\n\n` +
      'Esta acción no se puede deshacer. Los pedidos antiguos conservan su detalle.\n\n' +
      'Si solo quieres dejar de venderlo por un tiempo, cancela y desmarca "Visible".'
    );
    if (!ok) return;
    b.disabled = true;
    try {
      await pedir('eliminar', { method: 'POST', body: { id } });
      productos = productos.filter((x) => x.id !== id);
      const fila = contenido.querySelector(`[data-fila="${id}"]`);
      // Si era el último producto de su categoría, también se quita la franja de la categoría.
      const anterior = fila.previousElementSibling;
      const siguiente = fila.nextElementSibling;
      fila.remove();
      if (anterior?.classList.contains('fila-categoria') && (!siguiente || siguiente.classList.contains('fila-categoria'))) {
        anterior.remove();
      }
      if (!productos.length) renderProductos();
      window.Tienda.toast(`"${p.nombre}" eliminado`);
    } catch (err) {
      b.disabled = false;
      window.Tienda.toast(err.message);
    }
  });

  // ---------- Fotos ----------
  const MAX_FOTOS = 8;
  const fotosDe = (p) => [p.imagen_url, ...(p.imagenes || [])].filter(Boolean);

  function celdaFoto(p) {
    const fotos = fotosDe(p);
    if (!fotos.length) {
      return `<button type="button" class="foto-admin foto-admin--vacia" data-fotos="${p.id}" title="Subir fotos de ${esc(p.nombre)}">+ Fotos</button>`;
    }
    return `
      <button type="button" class="foto-admin" data-fotos="${p.id}" title="Administrar fotos de ${esc(p.nombre)}">
        <img src="${esc(fotos[0])}" alt="${esc(p.nombre)}" loading="lazy">
        <span class="foto-admin__cuenta">${fotos.length}</span>
      </button>`;
  }

  const selectorFoto = document.createElement('input');
  selectorFoto.type = 'file';
  selectorFoto.accept = 'image/*'; // en el celular permite usar la cámara
  selectorFoto.multiple = true;
  selectorFoto.hidden = true;
  document.body.appendChild(selectorFoto);

  const dialogoFotos = document.querySelector('[data-dialogo-fotos]');
  const galeria = dialogoFotos.querySelector('[data-galeria]');
  const fotosMsg = dialogoFotos.querySelector('[data-fotos-msg]');
  let productoFotos = null;

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

  function avisoFotos(texto, tipo = 'error') {
    fotosMsg.innerHTML = texto ? `<div class="aviso aviso--${tipo}">${texto}</div>` : '';
  }

  // Aplica la respuesta del servidor al producto, a la galería abierta y a la celda de la tabla.
  function aplicarGaleria(p, guardado) {
    p.imagen_url = guardado.imagen_url;
    p.imagenes = guardado.imagenes || [];
    renderGaleria();
    const celda = contenido.querySelector(`[data-foto-celda="${p.id}"]`);
    if (celda) celda.innerHTML = celdaFoto(p);
  }

  function renderGaleria() {
    const p = productoFotos;
    const fotos = fotosDe(p);
    dialogoFotos.querySelector('[data-fotos-titulo]').textContent = `Fotos: ${p.nombre}`;
    dialogoFotos.querySelector('[data-agregar-fotos]').disabled = fotos.length >= MAX_FOTOS;
    galeria.innerHTML = fotos.length
      ? fotos.map((f, i) => `
        <figure class="galeria-admin__foto ${i === 0 ? 'es-principal' : ''}">
          <img src="${esc(f)}" alt="Foto ${i + 1}">
          ${i === 0 ? '<span class="galeria-admin__etiqueta">★ Principal</span>' : ''}
          <figcaption>
            ${i === 0 ? '' : `<button type="button" class="btn btn--claro btn--chico" data-principal="${esc(f)}">★ Principal</button>`}
            <button type="button" class="btn btn--peligro btn--chico" data-quitar="${esc(f)}">Quitar</button>
          </figcaption>
        </figure>`).join('')
      : '<div class="vacio" style="grid-column:1/-1;padding:24px">Este producto aún no tiene fotos.</div>';
  }

  function abrirFotos(id) {
    productoFotos = productos.find((x) => x.id === id);
    avisoFotos('');
    renderGaleria();
    dialogoFotos.showModal();
  }

  contenido.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fotos]');
    if (b) abrirFotos(Number(b.dataset.fotos));
  });

  dialogoFotos.querySelector('[data-agregar-fotos]').addEventListener('click', () => {
    selectorFoto.value = '';
    selectorFoto.click();
  });

  // Sube una o varias fotos, una a la vez, mostrando el avance.
  selectorFoto.addEventListener('change', async () => {
    const p = productoFotos;
    const libres = MAX_FOTOS - fotosDe(p).length;
    const archivos = [...selectorFoto.files].slice(0, libres);
    if (!archivos.length) return;
    if (selectorFoto.files.length > libres) avisoFotos(`Solo se subirán ${libres} foto(s): el máximo es ${MAX_FOTOS} por producto.`, 'alerta');
    const boton = dialogoFotos.querySelector('[data-agregar-fotos]');
    boton.disabled = true;
    let errores = 0;
    for (const [i, archivo] of archivos.entries()) {
      boton.textContent = `Subiendo ${i + 1} de ${archivos.length}…`;
      try {
        const guardado = await pedir('foto', { method: 'POST', body: { id: p.id, imagen: await prepararFoto(archivo) } });
        aplicarGaleria(p, guardado);
      } catch (err) {
        errores++;
        avisoFotos(`${esc(archivo.name)}: ${esc(err.message)}`);
      }
    }
    boton.textContent = '+ Agregar fotos';
    boton.disabled = fotosDe(p).length >= MAX_FOTOS;
    if (!errores) window.Tienda.toast(archivos.length === 1 ? 'Foto guardada' : `${archivos.length} fotos guardadas`);
  });

  galeria.addEventListener('click', async (e) => {
    const principal = e.target.closest('[data-principal]');
    const quitar = e.target.closest('[data-quitar]');
    if (!principal && !quitar) return;
    if (quitar && !confirm('¿Quitar esta foto del producto?')) return;
    const p = productoFotos;
    (principal || quitar).disabled = true;
    try {
      const guardado = principal
        ? await pedir('foto-principal', { method: 'POST', body: { id: p.id, url: principal.dataset.principal } })
        : await pedir('foto-quitar', { method: 'POST', body: { id: p.id, url: quitar.dataset.quitar } });
      aplicarGaleria(p, guardado);
      avisoFotos('');
    } catch (err) {
      avisoFotos(esc(err.message));
      renderGaleria();
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

  const CAMPOS_FICHA = ['temporada', 'conservacion', 'preparacion', 'receta'];

  function abrirProducto(p) {
    editando = p;
    formProducto.reset();
    document.querySelector('[data-dialogo-titulo]').textContent = p ? `Editar: ${p.nombre}` : 'Nuevo producto';
    document.querySelector('[data-dialogo-msg]').innerHTML = '';
    const f = formProducto.elements;
    const v = p || { activo: true, destacado: false, orden: 0, stock: 0 };
    ['nombre', 'categoria', 'formato', 'precio', 'precio_anterior', 'stock', 'orden', 'descripcion', ...CAMPOS_FICHA]
      .forEach((k) => { f[k].value = v[k] ?? ''; });
    if (!p) f.conservacion.value = 'Mantener congelado a −18 °C. Una vez descongelado, no volver a congelar.';
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
      imagen_url: editando?.imagen_url ?? null, // las fotos se administran con el botón de la columna "Foto"
      descripcion: f.descripcion.value,
      ...Object.fromEntries(CAMPOS_FICHA.map((k) => [k, f[k].value])),
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
