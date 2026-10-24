/* Martan · checkout: datos del cliente, despacho y redirección a Mercado Pago. */
(function () {
  'use strict';
  const { Carro, catalogo, api, clp, esc, imagen } = window.Tienda;

  const form = document.querySelector('[data-form]');
  const vacio = document.querySelector('[data-vacio]');
  const mensaje = document.querySelector('[data-mensaje]');
  const botonPagar = document.querySelector('[data-pagar]');
  const selComuna = form.comuna;

  const CLAVE_DATOS = 'martan_datos_cliente';
  let datos = { zonas: [], config: {} };

  function avisar(texto, tipo = 'error') {
    mensaje.innerHTML = texto ? `<div class="aviso aviso--${tipo}">${texto}</div>` : '';
  }

  function costoEnvio() {
    const zona = datos.zonas.find((z) => z.comuna === selComuna.value);
    if (!zona) return null;
    const { despacho_gratis_desde: gratis } = datos.config;
    return gratis && Carro.subtotal() >= gratis ? 0 : zona.costo;
  }

  function renderResumen() {
    const items = Carro.items();
    if (!items.length) {
      form.classList.add('oculto');
      vacio.classList.remove('oculto');
      return;
    }
    document.querySelector('[data-resumen-items]').innerHTML = items.map((i) => `
      <div class="linea" style="grid-template-columns:48px 1fr auto">
        <div class="linea__foto" style="width:48px;height:48px">${imagen(i)}</div>
        <div><p class="linea__nombre">${esc(i.nombre)}</p><div class="linea__formato">${esc(i.formato)}<br>${i.cantidad} × ${clp(i.precio)}</div></div>
        <strong>${clp(i.precio * i.cantidad)}</strong>
      </div>`).join('');

    const sub = Carro.subtotal();
    const envio = costoEnvio();
    document.querySelector('[data-subtotal]').textContent = clp(sub);
    document.querySelector('[data-envio]').textContent = envio === null ? 'Elige comuna' : envio === 0 ? 'Gratis' : clp(envio);
    document.querySelector('[data-total]').textContent = clp(sub + (envio || 0));

    const minimo = datos.config.monto_minimo;
    if (minimo && sub < minimo) {
      avisar(`El monto mínimo de compra es ${clp(minimo)}. Te faltan ${clp(minimo - sub)}.`, 'alerta');
      botonPagar.disabled = true;
    } else {
      if (mensaje.querySelector('.aviso--alerta')) avisar('');
      botonPagar.disabled = false;
    }
  }

  function prepararComunas() {
    selComuna.innerHTML = '<option value="">Selecciona…</option>' +
      datos.zonas.map((z) => `<option value="${esc(z.comuna)}">${esc(z.comuna)} · ${clp(z.costo)}</option>`).join('');
  }

  // Recuerda los datos del cliente en este navegador para la próxima compra.
  function cargarDatosGuardados() {
    let guardados = {};
    try { guardados = JSON.parse(localStorage.getItem(CLAVE_DATOS)) || {}; } catch { /* sin almacenamiento */ }
    ['nombre', 'email', 'telefono', 'rut', 'direccion', 'referencia'].forEach((k) => {
      if (guardados[k] && !form[k].value) form[k].value = guardados[k];
    });
    if (guardados.comuna) selComuna.value = guardados.comuna;
  }
  function guardarDatos() {
    const d = {};
    ['nombre', 'email', 'telefono', 'rut', 'direccion', 'referencia', 'comuna'].forEach((k) => { d[k] = form[k].value.trim(); });
    try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
  }

  function validar() {
    const f = form;
    if (f.nombre.value.trim().length < 3) return [f.nombre, 'Ingresa tu nombre y apellido.'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) return [f.email, 'Ingresa un correo válido.'];
    if (f.telefono.value.replace(/\D/g, '').length < 8) return [f.telefono, 'Ingresa un teléfono válido.'];
    if (!selComuna.value) return [selComuna, 'Elige tu comuna.'];
    if (f.direccion.value.trim().length < 5) return [f.direccion, 'Ingresa tu dirección.'];
    if (!f.acepto.checked) return [f.acepto, 'Debes aceptar los términos y condiciones.'];
    return null;
  }

  selComuna.addEventListener('change', renderResumen);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = validar();
    if (error) { avisar(error[1]); error[0].focus(); return; }

    avisar('');
    botonPagar.disabled = true;
    botonPagar.textContent = 'Conectando con Mercado Pago…';
    guardarDatos();

    const f = form;
    try {
      const r = await api('/api/checkout', {
        method: 'POST',
        body: {
          items: Carro.items().map((i) => ({ id: i.id, modo: i.modo, cantidad: i.cantidad })),
          cliente: { nombre: f.nombre.value, email: f.email.value, telefono: f.telefono.value, rut: f.rut.value },
          entrega: { tipo: 'despacho', comuna: selComuna.value, direccion: f.direccion.value, referencia: f.referencia.value },
          notas: f.notas.value,
        },
      });
      try { localStorage.setItem('martan_ultimo_pedido', r.pedidoId); } catch { /* sin almacenamiento */ }
      location.href = r.urlPago;
    } catch (err) {
      botonPagar.disabled = false;
      botonPagar.textContent = 'Pagar con Mercado Pago';
      if (err.status === 409 && err.datos?.sinStock) {
        // Ajusta el carro al stock real y explica qué cambió.
        // El servidor informa las UNIDADES disponibles: se actualiza el stock de cada línea y se ajustan las cantidades.
        const detalle = err.datos.sinStock.map((s) => {
          const lineas = Carro.items().filter((i) => i.id === s.id);
          lineas.forEach((l) => { l.stock = s.disponible; });
          lineas.forEach((l) => Carro.fijar(l.id, l.cantidad, l.modo));
          const nombre = s.nombre || lineas[0]?.nombre || 'Producto';
          const queda = s.disponible <= 0 ? 'agotado'
            : s.kilos_por_caja ? `quedan ${s.disponible.toLocaleString('es-CL')} kg (${s.cajas} caja${s.cajas === 1 ? '' : 's'})` : `quedan ${s.disponible} caja${s.disponible === 1 ? '' : 's'}`;
          return `<li>${esc(nombre)}: ${queda}</li>`;
        }).join('');
        avisar(`Actualizamos tu carro porque cambió el stock:<ul style="margin:6px 0 0;padding-left:18px">${detalle}</ul>Revisa el resumen y vuelve a intentar.`);
      } else {
        avisar(esc(err.message));
      }
    }
  });

  Carro.alCambiar(renderResumen);

  catalogo()
    .then((d) => {
      datos = { zonas: d.zonas || [], config: d.config || {} };
      Carro.sincronizar(d.productos || []);
      prepararComunas();
      cargarDatosGuardados();
      renderResumen();
    })
    .catch((e) => { avisar(esc(e.message)); renderResumen(); });
})();
