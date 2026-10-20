/* Martan · portada: catálogo, filtros y preguntas frecuentes dinámicas. */
(function () {
  'use strict';
  const { Carro, catalogo, clp, esc, imagen, toast } = window.Tienda;

  const grilla = document.querySelector('[data-grilla]');
  const contCategorias = document.querySelector('[data-categorias]');
  const buscar = document.querySelector('[data-buscar]');

  let productos = [];
  let categoria = 'Todos';
  let termino = '';

  const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function insignias(p) {
    const lista = [];
    if (p.stock <= 0) lista.push('<span class="insignia insignia--agotado">Agotado</span>');
    else if (p.stock <= 5) lista.push(`<span class="insignia insignia--pocas">¡Quedan ${p.stock}!</span>`);
    if (p.precio_anterior && p.precio_anterior > p.precio) {
      lista.push(`<span class="insignia insignia--oferta">-${Math.round((1 - p.precio / p.precio_anterior) * 100)}%</span>`);
    }
    if (p.destacado) lista.push('<span class="insignia">★ Destacado</span>');
    return lista.join('');
  }

  function accion(p) {
    if (p.stock <= 0) return '<button class="btn btn--claro btn--chico" disabled>Sin stock</button>';
    const n = Carro.cantidad(p.id);
    if (!n) return `<button class="btn btn--azul btn--chico" data-agregar="${p.id}">Agregar</button>`;
    return `
      <div class="cantidad">
        <button data-menos="${p.id}" aria-label="Quitar uno">−</button>
        <span>${n}</span>
        <button data-mas="${p.id}" aria-label="Agregar uno" ${n >= p.stock ? 'disabled' : ''}>+</button>
      </div>`;
  }

  function tarjeta(p) {
    return `
      <article class="tarjeta">
        <div class="tarjeta__foto">${imagen(p)}<div class="tarjeta__insignias">${insignias(p)}</div></div>
        <div class="tarjeta__cuerpo">
          <span class="tarjeta__cat">${esc(p.categoria)}</span>
          <h3 class="tarjeta__nombre">${esc(p.nombre)}</h3>
          <span class="tarjeta__formato">${esc(p.formato)}</span>
          ${p.descripcion ? `<p class="tarjeta__desc">${esc(p.descripcion)}</p>` : ''}
          <div class="tarjeta__pie">
            <div class="precio">${p.precio_anterior > p.precio ? `<s>${clp(p.precio_anterior)}</s>` : ''}${clp(p.precio)}</div>
            <div data-accion-de="${p.id}">${accion(p)}</div>
          </div>
        </div>
      </article>`;
  }

  function filtrados() {
    const t = normalizar(termino);
    return productos.filter((p) =>
      (categoria === 'Todos' || p.categoria === categoria) &&
      (!t || normalizar(`${p.nombre} ${p.descripcion} ${p.categoria}`).includes(t)));
  }

  function renderCategorias() {
    const cats = ['Todos', ...new Set(productos.map((p) => p.categoria))];
    contCategorias.innerHTML = cats.map((c) =>
      `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === categoria}">${esc(c)}</button>`).join('');
  }

  function renderGrilla() {
    if (!productos.length) {
      grilla.innerHTML = '<div class="vacio" style="grid-column:1/-1"><h2 style="font-size:1.8rem">Estamos preparando nuestro catálogo</h2><p>Muy pronto podrás comprar aquí nuestros congelados.</p></div>';
      return;
    }
    const lista = filtrados();
    // Disponibles primero, agotados al final.
    lista.sort((a, b) => (b.stock > 0) - (a.stock > 0));
    grilla.innerHTML = lista.length
      ? lista.map(tarjeta).join('')
      : '<div class="vacio" style="grid-column:1/-1">No encontramos productos con ese criterio.</div>';
  }

  // Solo re-dibuja los botones (evita parpadeos de imágenes).
  function renderAcciones() {
    grilla.querySelectorAll('[data-accion-de]').forEach((el) => {
      const p = productos.find((x) => x.id === Number(el.dataset.accionDe));
      if (p) el.innerHTML = accion(p);
    });
  }

  contCategorias.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    categoria = b.dataset.cat;
    renderCategorias();
    renderGrilla();
  });

  buscar.addEventListener('input', () => { termino = buscar.value; renderGrilla(); });

  grilla.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = Number(b.dataset.agregar || b.dataset.mas || b.dataset.menos);
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    if (b.dataset.agregar) { Carro.agregar(p); toast(`${p.nombre} agregado al carro`); }
    if (b.dataset.mas) Carro.fijar(id, Carro.cantidad(id) + 1);
    if (b.dataset.menos) Carro.fijar(id, Carro.cantidad(id) - 1);
  });

  Carro.alCambiar(renderAcciones);

  function renderInfo(datos) {
    const { zonas = [], config = {} } = datos;
    const comunas = document.querySelector('[data-comunas]');
    comunas.textContent = zonas.length
      ? `Despachamos a: ${zonas.map((z) => `${z.comuna} (${clp(z.costo)})`).join(', ')}.` +
        (config.despacho_gratis_desde ? ` Despacho gratis en compras sobre ${clp(config.despacho_gratis_desde)}.` : '')
      : 'Por ahora solo trabajamos con retiro en local.';
    document.querySelector('[data-minimo]').textContent = config.monto_minimo
      ? `Sí, el monto mínimo de compra es ${clp(config.monto_minimo)}.`
      : 'No, puedes comprar desde un producto.';
    if (config.despacho_gratis_desde) {
      document.querySelector('[data-texto-despacho]').textContent = `Gratis sobre ${clp(config.despacho_gratis_desde)}`;
    }
    if (config.whatsapp) {
      const a = document.querySelector('[data-contacto-wsp]');
      a.href = `https://wa.me/${encodeURIComponent(config.whatsapp)}`;
      a.classList.remove('oculto');
    }
    if (config.email_contacto) {
      const a = document.querySelector('[data-contacto-mail]');
      a.href = `mailto:${config.email_contacto}`;
      a.textContent = config.email_contacto;
      a.classList.remove('oculto');
    }
  }

  catalogo()
    .then((datos) => {
      productos = datos.productos || [];
      const quitados = Carro.sincronizar(productos);
      if (quitados.length) toast(`Quitamos del carro productos sin stock: ${quitados.join(', ')}`);
      renderCategorias();
      renderGrilla();
      renderInfo(datos);
    })
    .catch((e) => {
      grilla.innerHTML = `<div class="vacio" style="grid-column:1/-1"><p>${esc(e.message)}</p><button class="btn btn--claro" data-reintentar>Reintentar</button></div>`;
      grilla.querySelector('[data-reintentar]').addEventListener('click', () => location.reload());
    });
})();
