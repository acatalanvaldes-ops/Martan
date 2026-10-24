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
  // ---------- Venta por caja (precio por mayor) o por kilo (precio al detalle) ----------
  // El stock viene en KILOS si el producto tiene kilos_por_caja; si no, en CAJAS.
  const kg = (n) => Number(n).toLocaleString('es-CL', { maximumFractionDigits: 3 });
  const Venta = {
    kilos: (p) => (Number(p.kilos_por_caja) > 0 ? Number(p.kilos_por_caja) : null),
    // Lo que descuenta del stock una caja: sus kilos, o 1 caja si el producto no tiene kilos.
    porCaja: (p) => Venta.kilos(p) || 1,
    vendeKilo: (p) => Venta.kilos(p) > 1 && p.precio_kilo > 0,
    // Detalle por bolsa cerrada (ej. papas en bolsas de 2,5 kg): se vende por bolsa a precio detalle por kilo.
    bolsa: (p) => (Number(p.kilos_por_bolsa) > 0 ? Number(p.kilos_por_bolsa) : null),
    precio: (p, modo) => {
      if (modo !== 'kilo') return p.precio;
      const b = Venta.bolsa(p);
      return b ? Math.round((p.precio_kilo * b) / 10) * 10 : p.precio_kilo;
    },
    unidadesDe: (p, modo) => (modo === 'kilo' ? Venta.bolsa(p) || 1 : Venta.porCaja(p)),
    // Peso legible: 2,5 kg · 200 g
    peso: (n) => (n < 1 ? `${Math.round(n * 1000)} g` : `${kg(n)} kg`),
    nombreDetalle: (p) => (Venta.bolsa(p) ? `Bolsa ${Venta.peso(Venta.bolsa(p))}` : 'Por kilo'),
    kg,
    etiqueta(p, modo) {
      if (modo === 'kilo') return Venta.nombreDetalle(p);
      const k = Venta.kilos(p);
      return k ? `Caja de ${kg(k)} kg` : `Caja${p.formato ? ` · ${p.formato}` : ''}`;
    },
    // Cuánto más barato sale el kilo comprando la caja (por mayor) que al detalle.
    ahorro(p) {
      if (!Venta.vendeKilo(p)) return 0;
      return Math.max(0, Math.round((1 - p.precio / Venta.kilos(p) / p.precio_kilo) * 100));
    },
  };

  let carro = leerLocal(CLAVE_CARRO, []);
  if (!Array.isArray(carro)) carro = [];
  carro = carro.filter((i) => i.modo !== 'unidad'); // la venta por unidad se reemplazó por venta por kilo
  carro.forEach((i) => { if (i.modo !== 'kilo') i.modo = 'caja'; }); // carros antiguos: todo era por caja
  const oyentes = new Set();
  const linea = (id, modo = 'caja') => carro.find((i) => i.id === id && i.modo === modo);

  function emitir() {
    guardarLocal(CLAVE_CARRO, carro);
    oyentes.forEach((fn) => fn(carro));
  }

  // Máximo que se puede pedir en una línea, descontando las unidades que ya usa la otra modalidad.
  function tope(i) {
    const otra = carro.find((x) => x.id === i.id && x.modo !== i.modo);
    const usadas = otra ? otra.cantidad * otra.unidadesPor : 0;
    return Math.max(0, Math.min(999, Math.floor(((i.stock ?? 999) - usadas) / i.unidadesPor)));
  }

  const Carro = {
    items: () => carro,
    cantidad: (id, modo = 'caja') => linea(id, modo)?.cantidad || 0,
    unidades: () => carro.reduce((s, i) => s + i.cantidad, 0),
    subtotal: () => carro.reduce((s, i) => s + i.precio * i.cantidad, 0),
    tope: (id, modo = 'caja') => { const l = linea(id, modo); return l ? tope(l) : 0; },
    alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },
    agregar(p, n = 1, modo = 'caja') {
      let l = linea(p.id, modo);
      if (!l) {
        l = { id: p.id, modo, cantidad: 0 };
        carro.push(l);
      }
      Object.assign(l, {
        nombre: p.nombre, formato: Venta.etiqueta(p, modo), precio: Venta.precio(p, modo), imagen_url: p.imagen_url,
        categoria: p.categoria, stock: p.stock, unidadesPor: Venta.unidadesDe(p, modo),
      });
      l.cantidad = Math.min(l.cantidad + n, tope(l));
      if (l.cantidad <= 0) carro = carro.filter((x) => x !== l);
      emitir();
    },
    fijar(id, cantidad, modo = 'caja') {
      const l = linea(id, modo);
      if (!l) return;
      if (cantidad <= 0) carro = carro.filter((x) => x !== l);
      else l.cantidad = Math.min(cantidad, tope(l));
      emitir();
    },
    quitar(id, modo = 'caja') { carro = carro.filter((x) => !(x.id === id && x.modo === modo)); emitir(); },
    vaciar() { carro = []; emitir(); },
    // Actualiza precios/stock con el catálogo vigente y quita lo que ya no existe o ya no se vende así.
    sincronizar(productos) {
      const porId = new Map(productos.map((p) => [p.id, p]));
      const quitados = [];
      carro = carro.filter((i) => {
        const p = porId.get(i.id);
        if (!p || p.stock <= 0 || (i.modo === 'kilo' && !Venta.vendeKilo(p))) { quitados.push(i.nombre); return false; }
        Object.assign(i, {
          nombre: p.nombre, formato: Venta.etiqueta(p, i.modo), precio: Venta.precio(p, i.modo), imagen_url: p.imagen_url,
          categoria: p.categoria, stock: p.stock, unidadesPor: Venta.unidadesDe(p, i.modo),
        });
        return true;
      });
      carro.forEach((i) => { i.cantidad = Math.min(i.cantidad, tope(i)); });
      carro = carro.filter((i) => i.cantidad > 0 || !quitados.push(i.nombre));
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
  // Sin foto: el pingüino de la marca en blanco, sobre tonos de Azul Profundo.
  const TONOS = ['#033360', '#043a6c', '#05427a', '#023058', '#063d70', '#032b52'];

  function tono(categoria) {
    let h = 0;
    for (const c of String(categoria)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TONOS[h % TONOS.length];
  }

  function imagen(p) {
    if (p.imagen_url) return `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy">`;
    const t = tono(p.categoria);
    return `<div class="foto-ph" style="background:radial-gradient(circle at 75% 15%,rgba(13,150,179,.35),transparent 60%),${t}" role="img" aria-label="${esc(p.nombre)}"><img src="/assets/isotipo-blanco.svg" alt=""></div>`;
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
      const modo = b.dataset.modo || 'caja';
      if (b.dataset.accion === 'mas') Carro.fijar(id, Carro.cantidad(id, modo) + 1, modo);
      if (b.dataset.accion === 'menos') Carro.fijar(id, Carro.cantidad(id, modo) - 1, modo);
      if (b.dataset.accion === 'quitar') Carro.quitar(id, modo);
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
            <button class="linea__quitar" data-accion="quitar" data-id="${i.id}" data-modo="${i.modo}">Quitar</button>
          </div>
          <div class="linea__derecha">
            <strong>${clp(i.precio * i.cantidad)}</strong>
            <div class="cantidad">
              <button data-accion="menos" data-id="${i.id}" data-modo="${i.modo}" aria-label="Quitar uno">−</button>
              <span>${i.cantidad}${i.modo === 'kilo' && i.unidadesPor === 1 ? ' kg' : ''}</span>
              <button data-accion="mas" data-id="${i.id}" data-modo="${i.modo}" aria-label="Agregar uno" ${i.cantidad >= Carro.tope(i.id, i.modo) ? 'disabled' : ''}>+</button>
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
    // WhatsApp y correo de contacto del pie, desde la configuración de la tienda.
    const wsp = document.querySelector('[data-contacto-wsp]');
    const mail = document.querySelector('[data-contacto-mail]');
    if (!wsp && !mail) return;
    catalogo().then(({ config = {} }) => {
      if (wsp && config.whatsapp) {
        wsp.href = `https://wa.me/${encodeURIComponent(config.whatsapp)}`;
        wsp.classList.remove('oculto');
      }
      if (mail && config.email_contacto) {
        mail.href = `mailto:${config.email_contacto}`;
        mail.textContent = config.email_contacto;
        mail.classList.remove('oculto');
      }
    }).catch(() => {});
  }

  window.Tienda = { Carro, Venta, catalogo, api, clp, esc, imagen, toast, abrirCarro: () => {} };

  document.addEventListener('DOMContentLoaded', () => {
    montarContador();
    montarCarroLateral();
    montarPie();
  });
})();
