/* Martan · checkout: datos del cliente, despacho, boleta o factura y redirección a Mercado Pago. */
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
    document.getElementById('lista-comunas-factura').innerHTML =
      datos.zonas.map((z) => `<option value="${esc(z.comuna)}">`).join('');
  }

  // ---------- Boleta o factura ----------
  const bloqueFactura = document.querySelector('[data-bloque-factura]');
  const ayudaBoleta = document.querySelector('[data-ayuda-boleta]');
  const CAMPOS_FACTURA = ['f_razon_social', 'f_rut', 'f_giro', 'f_direccion', 'f_comuna', 'f_email'];
  const esFactura = () => form.documento.value === 'factura';

  function mostrarDocumento() {
    bloqueFactura.classList.toggle('oculto', !esFactura());
    ayudaBoleta.classList.toggle('oculto', esFactura());
  }

  // Valida un RUT chileno (módulo 11) y lo devuelve como 12.345.678-9, o null si no es válido.
  function normalizarRut(valor) {
    const limpio = String(valor || '').toUpperCase().replace(/[^0-9K]/g, '');
    if (limpio.length < 2) return null;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    if (!/^\d{1,8}$/.test(cuerpo)) return null;
    let suma = 0, mult = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * mult; mult = mult === 7 ? 2 : mult + 1; }
    const r = 11 - (suma % 11);
    const esperado = r === 11 ? '0' : r === 10 ? 'K' : String(r);
    if (dv !== esperado) return null;
    return Number(cuerpo).toLocaleString('es-CL') + '-' + dv;
  }
  // Al salir del campo, deja el RUT con puntos y guion.
  [form.rut, form.f_rut].forEach((campo) => campo.addEventListener('blur', () => {
    const n = normalizarRut(campo.value);
    if (n) campo.value = n;
  }));

  // Recuerda los datos del cliente en este navegador para la próxima compra.
  function cargarDatosGuardados() {
    let guardados = {};
    try { guardados = JSON.parse(localStorage.getItem(CLAVE_DATOS)) || {}; } catch { /* sin almacenamiento */ }
    ['nombre', 'email', 'telefono', 'rut', 'direccion', 'referencia'].forEach((k) => {
      if (guardados[k] && !form[k].value) form[k].value = guardados[k];
    });
    if (guardados.comuna) selComuna.value = guardados.comuna;
    // Los datos de la factura se recuerdan aparte, para no tener que escribirlos cada vez.
    const fac = guardados.factura || {};
    CAMPOS_FACTURA.forEach((k) => { if (fac[k] && !form[k].value) form[k].value = fac[k]; });
    if (guardados.documento === 'factura') form.documento.value = 'factura';
    mostrarDocumento();
  }
  function guardarDatos() {
    const d = {};
    ['nombre', 'email', 'telefono', 'rut', 'direccion', 'referencia', 'comuna'].forEach((k) => { d[k] = form[k].value.trim(); });
    d.documento = form.documento.value;
    d.factura = {};
    CAMPOS_FACTURA.forEach((k) => { d.factura[k] = form[k].value.trim(); });
    try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
  }

  function validar() {
    const f = form;
    if (f.nombre.value.trim().length < 3) return [f.nombre, 'Ingresa tu nombre y apellido.'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) return [f.email, 'Ingresa un correo válido.'];
    if (f.telefono.value.replace(/\D/g, '').length < 8) return [f.telefono, 'Ingresa un teléfono válido.'];
    if (!selComuna.value) return [selComuna, 'Elige tu comuna.'];
    if (f.direccion.value.trim().length < 5) return [f.direccion, 'Ingresa tu dirección.'];
    if (f.rut.value.trim() && !normalizarRut(f.rut.value)) return [f.rut, 'Tu RUT no es válido. Revisa el número y el dígito verificador.'];
    if (esFactura()) {
      if (f.f_razon_social.value.trim().length < 3) return [f.f_razon_social, 'Ingresa la razón social de la empresa.'];
      if (!normalizarRut(f.f_rut.value)) return [f.f_rut, 'El RUT de la empresa no es válido. Revisa el número y el dígito verificador.'];
      if (f.f_giro.value.trim().length < 3) return [f.f_giro, 'Ingresa el giro de la empresa.'];
      if (f.f_direccion.value.trim().length < 5) return [f.f_direccion, 'Ingresa la dirección comercial de la empresa.'];
      if (f.f_comuna.value.trim().length < 3) return [f.f_comuna, 'Ingresa la comuna de la empresa.'];
      if (f.f_email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.f_email.value.trim())) return [f.f_email, 'El correo para la factura no es válido.'];
    }
    if (!f.acepto.checked) return [f.acepto, 'Debes aceptar los términos y condiciones.'];
    return null;
  }

  selComuna.addEventListener('change', renderResumen);
  form.querySelectorAll('[name="documento"]').forEach((r) => r.addEventListener('change', mostrarDocumento));

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
          documento: esFactura() ? {
            tipo: 'factura', razon_social: f.f_razon_social.value, rut: f.f_rut.value, giro: f.f_giro.value,
            direccion: f.f_direccion.value, comuna: f.f_comuna.value, email: f.f_email.value,
          } : { tipo: 'boleta' },
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
