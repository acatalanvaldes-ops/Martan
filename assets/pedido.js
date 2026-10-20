/* Martan · estado del pedido después del pago. */
(function () {
  'use strict';
  const { Carro, api, clp, esc } = window.Tienda;

  const caja = document.querySelector('[data-estado]');
  const detalle = document.querySelector('[data-detalle]');
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const pagoId = params.get('payment_id') || params.get('collection_id');

  const ICONOS = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    pendiente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  };

  function textos(p) {
    const retiro = p.entrega === 'retiro';
    switch (p.estado) {
      case 'pendiente_pago': return ['pendiente', 'Esperando confirmación del pago', 'Estamos esperando la confirmación de Mercado Pago. Esta página se actualiza sola.'];
      case 'rechazado': return ['error', 'El pago no se completó', 'Tu pago fue rechazado o cancelado. Tu carro sigue guardado: puedes intentarlo de nuevo con otro medio de pago.'];
      case 'cancelado': return ['error', 'Pedido cancelado', 'Este pedido fue cancelado. Si crees que es un error, contáctanos.'];
      case 'pagado': return ['ok', `¡Gracias, ${p.cliente_nombre}! Pago confirmado`, retiro ? 'Te avisaremos por correo cuando tu pedido esté listo para retiro.' : 'Estamos preparando tu pedido. Te avisaremos cuando vaya en camino.'];
      case 'en_preparacion': return ['info', 'Estamos preparando tu pedido', 'Tu pago está confirmado y ya estamos armando tu pedido.'];
      case 'en_camino': return ['info', 'Tu pedido va en camino', 'Mantén espacio en el congelador: llegará pronto.'];
      case 'listo_retiro': return ['ok', 'Tu pedido está listo para retiro', 'Puedes pasar a buscarlo en el horario del local.'];
      case 'entregado': return ['ok', 'Pedido entregado', '¡Que lo disfrutes! Gracias por comprar en Martan.'];
      default: return ['info', 'Estado del pedido', ''];
    }
  }

  function lineaTiempo(p) {
    const pasos = p.entrega === 'retiro'
      ? [['pagado', 'Pagado'], ['en_preparacion', 'Preparando'], ['listo_retiro', 'Listo para retiro'], ['entregado', 'Retirado']]
      : [['pagado', 'Pagado'], ['en_preparacion', 'Preparando'], ['en_camino', 'En camino'], ['entregado', 'Entregado']];
    const actual = pasos.findIndex(([e]) => e === p.estado);
    if (actual < 0) return '';
    return `<div class="linea-tiempo">${pasos.map(([, t], i) => `<div class="${i <= actual ? 'hecho' : ''}">${t}</div>`).join('')}</div>`;
  }

  function render(p) {
    const [tipo, titulo, texto] = textos(p);
    caja.className = `panel estado estado--${tipo}`;
    caja.innerHTML = `
      <div class="estado__icono">${ICONOS[tipo]}</div>
      <p style="margin:0 0 6px;font-weight:700;color:var(--azul-500)">Pedido N° ${p.numero}</p>
      <h1>${esc(titulo)}</h1>
      <p>${esc(texto)}</p>
      ${lineaTiempo(p)}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px">
        ${p.estado === 'rechazado' ? '<a class="btn btn--primario" href="/checkout">Intentar de nuevo</a>' : ''}
        <a class="btn btn--claro" href="/">Volver a la tienda</a>
      </div>`;

    const punto = p.puntos_retiro;
    const entrega = p.entrega === 'retiro'
      ? `Retiro en <strong>${esc(punto?.nombre)}</strong><br>${esc(punto?.direccion)}<br><span style="color:var(--texto-suave)">${esc(punto?.horario)}</span>`
      : `Despacho a <strong>${esc(p.direccion)}</strong>, ${esc(p.comuna)}`;
    detalle.innerHTML = `
      <h2>Detalle</h2>
      ${p.pedido_items.map((i) => `
        <div class="resumen__item"><span>${i.cantidad} × ${esc(i.nombre)} <small>${esc(i.formato)}</small></span><span>${clp(i.subtotal)}</span></div>`).join('')}
      <hr style="border:0;border-top:1px solid var(--borde)">
      <div class="resumen__item"><span>Subtotal</span><span>${clp(p.subtotal)}</span></div>
      <div class="resumen__item"><span>Entrega</span><span>${p.costo_despacho ? clp(p.costo_despacho) : 'Gratis'}</span></div>
      <div class="fila-total" style="margin-top:6px"><span>Total</span><span>${clp(p.total)}</span></div>
      <p style="margin:18px 0 0">${entrega}</p>`;
    detalle.classList.remove('oculto');

    // Pago confirmado: se vacía el carro si este pedido fue el último creado en este navegador.
    if (!['pendiente_pago', 'rechazado', 'cancelado'].includes(p.estado)) {
      let ultimo = null;
      try { ultimo = localStorage.getItem('martan_ultimo_pedido'); } catch { /* sin almacenamiento */ }
      if (ultimo === id) {
        Carro.vaciar();
        try { localStorage.removeItem('martan_ultimo_pedido'); } catch { /* sin almacenamiento */ }
      }
    }
  }

  function error(msg) {
    caja.className = 'panel estado estado--error';
    caja.innerHTML = `<div class="estado__icono">${ICONOS.error}</div><h1>No encontramos el pedido</h1><p>${esc(msg)}</p><a class="btn btn--claro" href="/">Volver a la tienda</a>`;
  }

  if (!id) { error('El enlace no es válido.'); return; }

  let intentos = 0;
  async function cargar() {
    try {
      const qs = new URLSearchParams({ id });
      if (pagoId && /^\d+$/.test(pagoId)) qs.set('payment_id', pagoId);
      const p = await api(`/api/pedido?${qs}`);
      render(p);
      // Mientras el pago esté pendiente, se consulta de nuevo (hasta ~3 minutos).
      if (p.estado === 'pendiente_pago' && intentos++ < 36) setTimeout(cargar, 5000);
    } catch (e) {
      error(e.message);
    }
  }
  cargar();
})();
