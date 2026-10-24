/* Martan · portada: carruseles por categoría, búsqueda, ficha de producto y FAQ dinámicas. */
(function () {
  'use strict';
  const { Carro, Venta, catalogo, clp, esc, imagen, toast } = window.Tienda;

  const vitrina = document.querySelector('[data-grilla]');
  const contCategorias = document.querySelector('[data-categorias]');
  const buscar = document.querySelector('[data-buscar]');

  let productos = [];
  let categoria = 'Todos';
  let termino = '';

  const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const fotosDe = (p) => [p.imagen_url, ...(p.imagenes || [])].filter(Boolean);
  // Texto con saltos de línea → párrafos seguros.
  const parrafos = (t) => esc(t).split(/\n{2,}/).map((b) => `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');

  // ---------- Tarjetas ----------
  // Modalidad elegida por producto: "caja" (precio por mayor, por defecto) o "kilo" (precio al detalle).
  const modoSel = new Map();
  const modoDe = (p) => (Venta.vendeKilo(p) && modoSel.get(p.id) === 'kilo' ? 'kilo' : 'caja');
  const disponibles = (p, modo) => Math.floor(p.stock / Venta.unidadesDe(p, modo));

  function insignias(p) {
    const lista = [];
    const cajas = disponibles(p, 'caja');
    if (p.stock <= 0) lista.push('<span class="insignia insignia--agotado">Agotado</span>');
    else if (cajas <= 3) lista.push(`<span class="insignia insignia--pocas">${cajas ? `¡Quedan ${cajas} caja${cajas === 1 ? '' : 's'}!` : 'Solo por kilo'}</span>`);
    if (p.precio_anterior && p.precio_anterior > p.precio) {
      lista.push(`<span class="insignia insignia--oferta">-${Math.round((1 - p.precio / p.precio_anterior) * 100)}%</span>`);
    }
    if (p.destacado) lista.push('<span class="insignia">★ Destacado</span>');
    return lista.join('');
  }

  function accion(p, clase = 'btn--chico', modo = modoDe(p)) {
    if (disponibles(p, modo) <= 0) return `<button class="btn btn--claro ${clase}" disabled>Sin stock</button>`;
    const n = Carro.cantidad(p.id, modo);
    if (!n) return `<button class="btn btn--azul ${clase}" data-agregar="${p.id}" data-modo="${modo}">Agregar</button>`;
    return `
      <div class="cantidad">
        <button data-menos="${p.id}" data-modo="${modo}" aria-label="Quitar uno">−</button>
        <span>${n}${modo === 'kilo' ? ' kg' : ''}</span>
        <button data-mas="${p.id}" data-modo="${modo}" aria-label="Agregar uno" ${n >= Carro.tope(p.id, modo) ? 'disabled' : ''}>+</button>
      </div>`;
  }

  // Selector Caja / Kilo (solo si el producto se vende también por kilo).
  function selectorModo(p, modo) {
    if (!Venta.vendeKilo(p)) return '';
    return `
      <div class="modos" role="group" aria-label="Comprar por caja (por mayor) o por kilo (al detalle)">
        <button data-modo-sel="caja" data-id="${p.id}" aria-pressed="${modo === 'caja'}">Caja ${Venta.kg(Venta.kilos(p))} kg<small>Por mayor</small></button>
        <button data-modo-sel="kilo" data-id="${p.id}" aria-pressed="${modo === 'kilo'}">Por kilo<small>Al detalle</small></button>
      </div>`;
  }

  function precioHtml(p, modo) {
    const precio = Venta.precio(p, modo);
    const tachado = modo === 'caja' && p.precio_anterior > p.precio ? `<s>${clp(p.precio_anterior)}</s>` : '';
    let detalle = '';
    if (modo === 'caja' && Venta.vendeKilo(p)) {
      const ah = Venta.ahorro(p);
      detalle = `<span class="precio__detalle">${clp(p.precio / Venta.kilos(p))} el kg por mayor${ah > 0 ? ` · <b>ahorras ${ah}%</b>` : ''}</span>`;
    } else if (modo === 'kilo') {
      detalle = '<span class="precio__detalle">el kg, al detalle</span>';
    } else {
      detalle = '<span class="precio__detalle">precio por mayor</span>';
    }
    return `<div class="precio">${tachado}${clp(precio)}${detalle}</div>`;
  }

  function tarjeta(p) {
    const fotos = fotosDe(p).length;
    const modo = modoDe(p);
    return `
      <article class="tarjeta" data-tarjeta="${p.id}">
        <button class="tarjeta__foto" data-ver="${p.id}" aria-label="Ver ficha de ${esc(p.nombre)}">
          ${imagen(p)}
          <div class="tarjeta__insignias">${insignias(p)}</div>
          ${fotos > 1 ? `<span class="tarjeta__fotos">${fotos} fotos</span>` : ''}
        </button>
        <div class="tarjeta__cuerpo">
          <span class="tarjeta__cat">${esc(p.categoria)}</span>
          <h3 class="tarjeta__nombre"><button class="tarjeta__ver" data-ver="${p.id}">${esc(p.nombre)}</button></h3>
          <span class="tarjeta__formato">${esc(Venta.etiqueta(p, modo))}</span>
          ${p.descripcion ? `<p class="tarjeta__desc">${esc(p.descripcion)}</p>` : ''}
          ${selectorModo(p, modo)}
          <div class="tarjeta__pie">
            ${precioHtml(p, modo)}
            <div data-accion-de="${p.id}" data-modo="${modo}">${accion(p, 'btn--chico', modo)}</div>
          </div>
        </div>
      </article>`;
  }

  // ---------- Carruseles ----------
  function carrusel(titulo, lista) {
    // Disponibles primero, agotados al final.
    const orden = [...lista].sort((a, b) => (b.stock > 0) - (a.stock > 0));
    return `
      <section class="carrusel" data-carrusel>
        <div class="carrusel__cabeza">
          <h3 class="carrusel__titulo">${esc(titulo)}</h3>
          <span class="carrusel__cuenta">${lista.length} producto${lista.length === 1 ? '' : 's'}</span>
          <div class="carrusel__flechas">
            <button class="carrusel__flecha" data-mover="-1" aria-label="Anteriores" disabled>‹</button>
            <button class="carrusel__flecha" data-mover="1" aria-label="Siguientes">›</button>
          </div>
        </div>
        <div class="carrusel__pista" tabindex="0">${orden.map(tarjeta).join('')}</div>
      </section>`;
  }

  function filtrados() {
    const t = normalizar(termino);
    return productos.filter((p) =>
      (categoria === 'Todos' || p.categoria === categoria) &&
      (!t || normalizar(`${p.nombre} ${p.descripcion} ${p.categoria} ${p.formato}`).includes(t)));
  }

  function renderCategorias() {
    const cats = ['Todos', ...new Set(productos.map((p) => p.categoria))];
    contCategorias.innerHTML = cats.map((c) =>
      `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === categoria}">${esc(c)}</button>`).join('');
  }

  function renderVitrina() {
    if (!productos.length) {
      vitrina.innerHTML = '<div class="vacio"><h2 style="font-size:1.8rem">Estamos preparando nuestro catálogo</h2><p>Muy pronto podrás comprar aquí nuestros congelados.</p></div>';
      return;
    }
    const lista = filtrados();
    if (!lista.length) {
      vitrina.innerHTML = '<div class="vacio">No encontramos productos con ese criterio.</div>';
      return;
    }
    if (termino) {
      vitrina.innerHTML = carrusel(`Resultados para «${termino.trim()}»`, lista);
    } else if (categoria !== 'Todos') {
      vitrina.innerHTML = carrusel(categoria, lista);
    } else {
      // "Todos": un carrusel por categoría, en el orden del catálogo.
      const grupos = new Map();
      lista.forEach((p) => grupos.set(p.categoria, [...(grupos.get(p.categoria) || []), p]));
      vitrina.innerHTML = [...grupos].map(([c, ps]) => carrusel(c, ps)).join('');
    }
    vitrina.querySelectorAll('[data-carrusel]').forEach(actualizarFlechas);
  }

  function actualizarFlechas(c) {
    const pista = c.querySelector('.carrusel__pista');
    const [prev, sig] = c.querySelectorAll('[data-mover]');
    const max = pista.scrollWidth - pista.clientWidth - 2;
    prev.disabled = pista.scrollLeft <= 2;
    sig.disabled = pista.scrollLeft >= max;
    c.classList.toggle('carrusel--sin-flechas', max <= 0);
  }

  // El evento scroll no burbujea: se escucha en fase de captura.
  vitrina.addEventListener('scroll', (e) => {
    const c = e.target.closest?.('[data-carrusel]');
    if (c) actualizarFlechas(c);
  }, true);
  window.addEventListener('resize', () => vitrina.querySelectorAll('[data-carrusel]').forEach(actualizarFlechas));

  // Solo re-dibuja los botones (evita parpadeos de imágenes).
  function renderAcciones() {
    document.querySelectorAll('[data-accion-de]').forEach((el) => {
      const p = productos.find((x) => x.id === Number(el.dataset.accionDe));
      if (p) el.innerHTML = accion(p, el.dataset.clase ?? 'btn--chico', el.dataset.modo || 'caja');
    });
  }

  contCategorias.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    categoria = b.dataset.cat;
    renderCategorias();
    renderVitrina();
  });

  buscar.addEventListener('input', () => { termino = buscar.value; renderVitrina(); });

  // Botones del carro (en tarjetas y en la ficha).
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-agregar],[data-mas],[data-menos]');
    if (!b) return;
    const id = Number(b.dataset.agregar || b.dataset.mas || b.dataset.menos);
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    const modo = b.dataset.modo || 'caja';
    if (b.dataset.agregar) { Carro.agregar(p, 1, modo); toast(`${p.nombre} (${modo === 'kilo' ? 'por kilo' : 'caja'}) agregado al carro`); }
    if (b.dataset.mas) Carro.fijar(id, Carro.cantidad(id, modo) + 1, modo);
    if (b.dataset.menos) Carro.fijar(id, Carro.cantidad(id, modo) - 1, modo);
  });

  vitrina.addEventListener('click', (e) => {
    const flecha = e.target.closest('[data-mover]');
    if (flecha) {
      const pista = flecha.closest('[data-carrusel]').querySelector('.carrusel__pista');
      pista.scrollBy({ left: Number(flecha.dataset.mover) * pista.clientWidth * 0.9, behavior: 'smooth' });
      return;
    }
    const ver = e.target.closest('[data-ver]');
    if (ver) abrirFicha(Number(ver.dataset.ver));
  });

  Carro.alCambiar(renderAcciones);

  // ---------- Ficha del producto ----------
  const ficha = document.querySelector('[data-ficha]');
  const visor = ficha.querySelector('[data-visor]');
  const miniaturas = ficha.querySelector('[data-miniaturas]');
  const info = ficha.querySelector('[data-ficha-info]');
  let fotoActual = 0;

  function irAFoto(i, suave = true) {
    const total = visor.children.length;
    if (!total) return;
    fotoActual = (i + total) % total;
    visor.scrollTo({ left: visor.clientWidth * fotoActual, behavior: suave ? 'smooth' : 'auto' });
    miniaturas.querySelectorAll('button').forEach((m, j) => m.setAttribute('aria-current', String(j === fotoActual)));
  }

  function seccion(titulo, contenido, modificador = '') {
    if (!contenido) return '';
    const clase = modificador ? ` ficha__seccion--${modificador}` : '';
    const marca = modificador ? ` data-${modificador}` : '';
    return `<section class="ficha__seccion${clase}"${marca}><h3>${titulo}</h3>${parrafos(contenido)}</section>`;
  }

  // Bloque de compra de la ficha: selector Caja/Kilo, precio y botón.
  function compraFicha(p) {
    const modo = modoDe(p);
    return `
      <div class="ficha__compra-fila">
        ${precioHtml(p, modo).replace('class="precio"', 'class="precio precio--grande"')}
        <div data-accion-de="${p.id}" data-clase="" data-modo="${modo}">${accion(p, '', modo)}</div>
      </div>
      ${selectorModo(p, modo)}
      <p class="ficha__modo-texto">${esc(Venta.etiqueta(p, modo))}</p>
      <p class="ficha__nota-precio">${Venta.vendeKilo(p)
        ? '<strong>Valor caja:</strong> precio por mayor. <strong>Valor por kilo:</strong> precio al detalle.'
        : '<strong>Valor caja:</strong> precio por mayor.'}</p>`;
  }

  // Cambio Caja ↔ Kilo: repinta la tarjeta y, si está abierta, la ficha.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo-sel]');
    if (!b) return;
    const p = productos.find((x) => x.id === Number(b.dataset.id));
    if (!p) return;
    modoSel.set(p.id, b.dataset.modoSel);
    const t = vitrina.querySelector(`[data-tarjeta="${p.id}"]`);
    if (t) t.outerHTML = tarjeta(p);
    const compra = ficha.open && ficha.dataset.slug === p.slug && ficha.querySelector('[data-ficha-compra]');
    if (compra) compra.innerHTML = compraFicha(p);
  });

  function abrirFicha(id) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    const fotos = fotosDe(p);
    visor.innerHTML = fotos.length
      ? fotos.map((f, i) => `<img src="${esc(f)}" alt="${esc(p.nombre)} — foto ${i + 1} de ${fotos.length}" ${i ? 'loading="lazy"' : ''}>`).join('')
      : `<div class="ficha__sin-foto">${imagen(p)}</div>`;
    miniaturas.innerHTML = fotos.length > 1
      ? fotos.map((f, i) => `<button data-miniatura="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join('')
      : '';
    ficha.classList.toggle('ficha--una-foto', fotos.length <= 1);

    const detalles = [
      ['Formato', Venta.kilos(p) ? `Caja de ${Venta.kg(Venta.kilos(p))} kg${p.formato ? ` · ${p.formato}` : ''}` : p.formato],
      ['Venta', Venta.vendeKilo(p) ? 'Por caja (por mayor) o por kilo (al detalle)' : 'Por caja'],
      ['Categoría', p.categoria],
      ['Temporada', p.temporada],
      ['Disponibilidad', p.stock <= 0 ? 'Agotado por ahora' : disponibles(p, 'caja') <= 3 ? 'Pocas unidades' : 'En stock'],
    ].filter(([, v]) => v);

    info.innerHTML = `
      <span class="sobretitulo">${esc(p.categoria)}</span>
      <h2 id="ficha-nombre" class="ficha__nombre">${esc(p.nombre)}</h2>
      ${p.formato ? `<p class="ficha__formato">${esc(p.formato)}</p>` : ''}
      <div class="ficha__insignias">${insignias(p)}</div>
      ${p.receta ? '<button class="ficha__ir-receta" data-ir-receta>Ver receta sugerida ↓</button>' : ''}
      <div class="ficha__compra" data-ficha-compra>${compraFicha(p)}</div>
      ${p.descripcion ? `<div class="ficha__desc">${parrafos(p.descripcion)}</div>` : ''}
      <dl class="ficha__datos">${detalles.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${seccion('Conservación', p.conservacion)}
      ${seccion('Preparación', p.preparacion)}
      ${seccion('Receta sugerida', p.receta, 'receta')}
      <button class="btn btn--claro btn--chico ficha__compartir" data-compartir>Compartir producto</button>`;

    if (!ficha.open) ficha.showModal();
    document.body.style.overflow = 'hidden';
    fotoActual = 0;
    requestAnimationFrame(() => irAFoto(0, false));
    // Enlace directo a la ficha (para compartir por WhatsApp, etc.).
    const url = new URL(location.href);
    url.searchParams.set('producto', p.slug);
    history.replaceState(null, '', url);
    ficha.dataset.slug = p.slug;
    ficha.dataset.nombre = p.nombre;
  }

  function cerrarFicha() {
    if (ficha.open) ficha.close();
  }

  ficha.addEventListener('close', () => {
    document.body.style.overflow = '';
    const url = new URL(location.href);
    url.searchParams.delete('producto');
    history.replaceState(null, '', url);
  });
  ficha.querySelector('[data-cerrar-ficha]').addEventListener('click', cerrarFicha);
  // Clic fuera del contenido (en el fondo oscuro) cierra la ficha.
  ficha.addEventListener('click', (e) => { if (e.target === ficha) cerrarFicha(); });

  ficha.addEventListener('click', async (e) => {
    const paso = e.target.closest('[data-foto-paso]');
    if (paso) { irAFoto(fotoActual + Number(paso.dataset.fotoPaso)); return; }
    const mini = e.target.closest('[data-miniatura]');
    if (mini) { irAFoto(Number(mini.dataset.miniatura)); return; }
    if (e.target.closest('[data-ir-receta]')) {
      ficha.querySelector('[data-receta]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('[data-compartir]')) {
      const datos = { title: `${ficha.dataset.nombre} · Martan Congelados`, url: location.href };
      try {
        if (navigator.share) await navigator.share(datos);
        else { await navigator.clipboard.writeText(location.href); toast('Enlace copiado'); }
      } catch { /* el usuario canceló */ }
    }
  });

  ficha.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') irAFoto(fotoActual + 1);
    if (e.key === 'ArrowLeft') irAFoto(fotoActual - 1);
  });

  // Al deslizar con el dedo, sincroniza la miniatura activa.
  let tVisor;
  visor.addEventListener('scroll', () => {
    clearTimeout(tVisor);
    tVisor = setTimeout(() => {
      const i = Math.round(visor.scrollLeft / Math.max(visor.clientWidth, 1));
      if (i !== fotoActual) {
        fotoActual = i;
        miniaturas.querySelectorAll('button').forEach((m, j) => m.setAttribute('aria-current', String(j === i)));
      }
    }, 80);
  });

  // ---------- Información dinámica ----------
  function renderInfo(datos) {
    const { config = {} } = datos;
    if (config.despacho_gratis_desde) {
      document.querySelector('[data-texto-despacho]').textContent = `Gratis sobre ${clp(config.despacho_gratis_desde)}`;
    }
  }

  catalogo()
    .then((datos) => {
      productos = datos.productos || [];
      const quitados = Carro.sincronizar(productos);
      if (quitados.length) toast(`Quitamos del carro productos sin stock: ${quitados.join(', ')}`);
      renderCategorias();
      renderVitrina();
      renderInfo(datos);
      // ¿Llegó con un enlace directo a un producto?
      const slug = new URLSearchParams(location.search).get('producto');
      const p = slug && productos.find((x) => x.slug === slug);
      if (p) abrirFicha(p.id);
    })
    .catch((e) => {
      vitrina.innerHTML = `<div class="vacio"><p>${esc(e.message)}</p><button class="btn btn--claro" data-reintentar>Reintentar</button></div>`;
      vitrina.querySelector('[data-reintentar]').addEventListener('click', () => location.reload());
    });
})();
