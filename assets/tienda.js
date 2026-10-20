/* Martan · utilidades compartidas: carro, catálogo, formato y carro lateral. */
(function () {
  'use strict';

  const CLAVE_CARRO = 'martan_carrito';
  const formatoCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

  const clp = (n) => formatoCLP.format(Math.round(n || 0));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- Almacenamiento seguro ----------
  function leerLocal(clave, defecto) {
    try { const v = JSON.parse(localStorage.getItem(clave)); return v ?? defecto; } catch { return defecto; }
  }
  function guardarLocal(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado */ }
  }

  // ---------- Carro ----------
  let carro = leerLocal(CLAVE_CARRO, []);
  if (!Array.isArray(carro)) carro = [];
  const oyentes = new Set();

  function emitir() {
    guardarLocal(CLAVE_CARRO, carro);
    oyentes.forEach((fn) => fn(carro));
  }

  const Carro = {
    items: () => carro,
    cantidad: (id) => carro.find((i) => i.id === id)?.cantidad || 0,
    unidades: () => carro.reduce((s, i) => s + i.cantidad, 0),
    subtotal: () => carro.reduce((s, i) => s + i.precio * i.cantidad, 0),
    alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },
    agregar(p, n = 1) {
      const linea = carro.find((i) => i.id === p.id);
      const tope = Math.min(p.stock ?? 99, 99);
      if (linea) linea.cantidad = Math.min(linea.cantidad + n, tope);
      else carro.push({ id: p.id, nombre: p.nombre, formato: p.formato, precio: p.precio, imagen_url: p.imagen_url, categoria: p.categoria, stock: p.stock, cantidad: Math.min(n, tope) });
      emitir();
    },
    fijar(id, cantidad) {
      const linea = carro.find((i) => i.id === id);
      if (!linea) return;
      if (cantidad <= 0) carro = carro.filter((i) => i.id !== id);
      else linea.cantidad = Math.min(cantidad, linea.stock ?? 99, 99);
      emitir();
    },
    quitar(id) { carro = carro.filter((i) => i.id !== id); emitir(); },
    vaciar() { carro = []; emitir(); },
    // Actualiza precios/stock con el catálogo vigente y quita lo que ya no existe.
    sincronizar(productos) {
      const porId = new Map(productos.map((p) => [p.id, p]));
      const quitados = [];
      carro = carro.filter((i) => {
        const p = porId.get(i.id);
        if (!p || p.stock <= 0) { quitados.push(i.nombre); return false; }
        Object.assign(i, { nombre: p.nombre, formato: p.formato, precio: p.precio, imagen_url: p.imagen_url, categoria: p.categoria, stock: p.stock });
        i.cantidad = Math.min(i.cantidad, p.stock);
        return true;
      });
      emitir();
      return quitados;
    },
  };

  // Mantiene sincronizadas varias pestañas abiertas.
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE_CARRO) return;
    carro = leerLocal(CLAVE_CARRO, []);
    oyentes.forEach((fn) => fn(carro));
  });

  // ---------- Catálogo ----------
  let catalogoPromesa = null;
  function catalogo() {
    if (!catalogoPromesa) {
      catalogoPromesa = fetch('/api/catalogo').then(async (r) => {
        const datos = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(datos.error || 'No pudimos cargar los productos.');
        return datos;
      });
      catalogoPromesa.catch(() => { catalogoPromesa = null; });
    }
    return catalogoPromesa;
  }

  async function api(url, opciones = {}) {
    const r = await fetch(url, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
      body: opciones.body && typeof opciones.body !== 'string' ? JSON.stringify(opciones.body) : opciones.body,
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(datos.error || 'Ocurrió un error. Intenta nuevamente.');
      err.status = r.status;
      err.datos = datos;
      throw err;
    }
    return datos;
  }

  // ---------- Imágenes ----------
  const COLORES = {
    Empanadas: ['#f4a259', '#e07a2f'], Pizzas: ['#e76f51', '#c4452a'], Mariscos: ['#2a9d8f', '#1d7469'],
    Carnes: ['#b5485d', '#8c2f42'], Verduras: ['#6a994e', '#4c7536'], Postres: ['#9d79bc', '#7651a0'],
  };
  const COPO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.6 10.4l3.4-.9-.9-3.4M20.4 13.6l-3.4.9.9 3.4M3.6 13.6l3.4.9-.9 3.4M20.4 10.4l-3.4-.9.9-3.4"/></svg>';

  function imagen(p) {
    if (p.imagen_url) return `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy">`;
    const [a, b] = COLORES[p.categoria] || ['#4f86c6', '#2f5f99'];
    return `<div class="foto-ph" style="background:linear-gradient(135deg,${a},${b})" role="img" aria-label="${esc(p.nombre)}">${COPO}</div>`;
  }

  // ---------- Toast ----------
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 2400);
  }

  // ---------- Carro lateral ----------
  function montarCarroLateral() {
    if (document.body.dataset.sinCarro !== undefined) return;
    const velo = document.createElement('div');
    velo.className = 'velo';
    const panel = document.createElement('aside');
    panel.className = 'carro';
    panel.setAttribute('aria-label', 'Carro de compras');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="carro__cabeza"><h2>Tu carro</h2><button class="cerrar" data-cerrar aria-label="Cerrar carro">×</button></div>
      <div class="carro__lista" data-lista></div>
      <div class="carro__pie" data-pie></div>`;
    document.body.append(velo, panel);

    const abrir = () => { velo.classList.add('abierto'); panel.classList.add('abierto'); panel.setAttribute('aria-hidden', 'false'); panel.querySelector('[data-cerrar]').focus(); };
    const cerrar = () => { velo.classList.remove('abierto'); panel.classList.remove('abierto'); panel.setAttribute('aria-hidden', 'true'); };
    velo.addEventListener('click', cerrar);
    panel.querySelector('[data-cerrar]').addEventListener('click', cerrar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
    document.querySelectorAll('[data-abrir-carro]').forEach((b) => b.addEventListener('click', abrir));

    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const id = Number(b.dataset.id);
      if (b.dataset.accion === 'mas') Carro.fijar(id, Carro.cantidad(id) + 1);
      if (b.dataset.accion === 'menos') Carro.fijar(id, Carro.cantidad(id) - 1);
      if (b.dataset.accion === 'quitar') Carro.quitar(id);
    });

    let config = {};
    catalogo().then((d) => { config = d.config || {}; render(); }).catch(() => {});

    function render() {
      const lista = panel.querySelector('[data-lista]');
      const pie = panel.querySelector('[data-pie]');
      const items = Carro.items();
      if (!items.length) {
        lista.innerHTML = '<div class="vacio"><p>Tu carro está vacío.</p></div>';
        pie.innerHTML = '<a class="btn btn--claro btn--ancho" href="/#productos" data-cerrar-link>Ver productos</a>';
        pie.querySelector('[data-cerrar-link]').addEventListener('click', cerrar);
        return;
      }
      lista.innerHTML = items.map((i) => `
        <div class="linea">
          <div class="linea__foto">${imagen(i)}</div>
          <div>
            <p class="linea__nombre">${esc(i.nombre)}</p>
            <div class="linea__formato">${esc(i.formato)} · ${clp(i.precio)}</div>
            <button class="linea__quitar" data-accion="quitar" data-id="${i.id}">Quitar</button>
          </div>
          <div class="linea__derecha">
            <strong>${clp(i.precio * i.cantidad)}</strong>
            <div class="cantidad">
              <button data-accion="menos" data-id="${i.id}" aria-label="Quitar uno">−</button>
              <span>${i.cantidad}</span>
              <button data-accion="mas" data-id="${i.id}" aria-label="Agregar uno" ${i.cantidad >= (i.stock ?? 99) ? 'disabled' : ''}>+</button>
            </div>
          </div>
        </div>`).join('');

      const sub = Carro.subtotal();
      let avisos = '';
      if (config.monto_minimo && sub < config.monto_minimo) {
        avisos += `<div class="aviso aviso--alerta">Te faltan <strong>${clp(config.monto_minimo - sub)}</strong> para el mínimo de compra (${clp(config.monto_minimo)}).</div>`;
      } else if (config.despacho_gratis_desde) {
        const falta = config.despacho_gratis_desde - sub;
        const pct = Math.min(100, (sub / config.despacho_gratis_desde) * 100);
        avisos += falta > 0
          ? `<div class="aviso">Agrega <strong>${clp(falta)}</strong> y el despacho es gratis.<div class="barra"><span style="width:${pct}%"></span></div></div>`
          : '<div class="aviso aviso--ok">¡Tienes despacho gratis!</div>';
      }
      const bloqueado = config.monto_minimo && sub < config.monto_minimo;
      pie.innerHTML = `
        ${avisos}
        <div class="fila-total"><span>Subtotal</span><span>${clp(sub)}</span></div>
        <a class="btn btn--primario btn--ancho ${bloqueado ? 'oculto' : ''}" href="/checkout">Ir a pagar</a>
        ${bloqueado ? '<button class="btn btn--primario btn--ancho" disabled>Ir a pagar</button>' : ''}`;
    }

    Carro.alCambiar(render);
    render();
    window.Tienda.abrirCarro = abrir;
  }

  function montarContador() {
    const actualizar = () => {
      document.querySelectorAll('[data-contador]').forEach((el) => { el.textContent = Carro.unidades(); });
    };
    Carro.alCambiar(() => {
      actualizar();
      document.querySelectorAll('.boton-carro').forEach((b) => { b.classList.remove('pulso'); void b.offsetWidth; b.classList.add('pulso'); });
    });
    actualizar();
  }

  function montarPie() {
    document.querySelectorAll('[data-anio]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  window.Tienda = { Carro, catalogo, api, clp, esc, imagen, toast, abrirCarro: () => {} };

  document.addEventListener('DOMContentLoaded', () => {
    montarContador();
    montarCarroLateral();
    montarPie();
  });
})();
