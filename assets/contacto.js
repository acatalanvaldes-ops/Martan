/* Martan · página de preguntas frecuentes y formulario de contacto. */
(function () {
  'use strict';
  const { catalogo, api, clp, esc } = window.Tienda;

  // ---------- Preguntas frecuentes con datos reales de la tienda ----------
  catalogo().then(({ zonas = [], config = {} }) => {
    const gratis = config.despacho_gratis_desde ? ` Despacho gratis en compras sobre ${clp(config.despacho_gratis_desde)}.` : '';
    // Agrupa las comunas por tarifa: la más baja es Gran Santiago y la más alta, las comunas periféricas.
    const tarifas = [...new Set(zonas.map((z) => z.costo))].sort((a, b) => a - b);
    const comunasDe = (costo) => zonas.filter((z) => z.costo === costo).map((z) => z.comuna)
      .sort((a, b) => a.localeCompare(b, 'es')).join(', ');
    const nombreTarifa = (i) => (tarifas.length === 2 ? (i === 0 ? 'Gran Santiago' : 'Comunas periféricas') : `Tarifa ${clp(tarifas[i])}`);
    const comunas = document.querySelector('[data-comunas]');
    if (zonas.length) {
      comunas.innerHTML = 'Despachamos a todas las comunas de la Región Metropolitana.' + tarifas.map((c, i) =>
        `<br><br><strong>${nombreTarifa(i)} (${clp(c)}):</strong> ${esc(comunasDe(c))}.`).join('');
    }
    const costo = document.querySelector('[data-costo-despacho]');
    if (tarifas.length === 2) {
      costo.textContent = `${clp(tarifas[0])} en Gran Santiago y ${clp(tarifas[1])} en las comunas periféricas de la Región Metropolitana (${comunasDe(tarifas[1])}). Lo verás en el resumen antes de pagar.${gratis}`;
    } else if (tarifas.length === 1) {
      costo.textContent = `El despacho cuesta ${clp(tarifas[0])} a cualquier comuna de la Región Metropolitana.${gratis}`;
    } else if (tarifas.length) {
      costo.textContent = `Depende de tu comuna: desde ${clp(tarifas[0])} hasta ${clp(tarifas[tarifas.length - 1])}. Lo verás antes de pagar.${gratis}`;
    }
    document.querySelector('[data-minimo]').textContent = config.monto_minimo
      ? `Sí, el monto mínimo de compra es ${clp(config.monto_minimo)}.`
      : 'No, puedes comprar desde un producto.';

    // Otros canales (WhatsApp y correo) en el lateral del formulario
    const wsp = document.querySelector('[data-canal-wsp]');
    const mail = document.querySelector('[data-canal-mail]');
    if (config.whatsapp) { wsp.href = `https://wa.me/${encodeURIComponent(config.whatsapp)}`; wsp.classList.remove('oculto'); }
    if (config.email_contacto) { mail.href = `mailto:${config.email_contacto}`; mail.textContent = config.email_contacto; mail.classList.remove('oculto'); }
    if (config.whatsapp || config.email_contacto) document.querySelector('[data-canales]').hidden = false;
  }).catch(() => {});

  // ---------- Formulario ----------
  const form = document.querySelector('[data-form-contacto]');
  const msg = document.querySelector('[data-contacto-msg]');
  const boton = form.querySelector('[data-enviar]');
  const campoPedido = form.querySelector('[data-campo-pedido]');

  const AYUDAS = {
    sugerencia: 'Cuéntanos tu idea: productos que te gustaría encontrar, mejoras al sitio, etc.',
    reclamo: 'Describe el problema, qué producto(s) afecta y cuándo recibiste el pedido.',
    cotizacion: 'Indica qué productos y qué cantidades necesitas, y la comuna de despacho.',
    factura: 'Indica la razón social, el RUT y el giro de la empresa, y la dirección de facturación.',
  };

  function avisar(texto, tipo = 'error') {
    msg.innerHTML = texto ? `<div class="aviso aviso--${tipo}">${texto}</div>` : '';
  }

  function alCambiarTipo() {
    const t = form.tipo.value;
    campoPedido.classList.toggle('oculto', !['reclamo', 'factura'].includes(t));
    form.mensaje.placeholder = AYUDAS[t] || 'Cuéntanos en qué te podemos ayudar.';
  }
  form.tipo.addEventListener('change', alCambiarTipo);

  // Enlaces de las preguntas frecuentes que preseleccionan el tipo de contacto.
  function elegirTipo(t) {
    if (!AYUDAS[t]) return;
    form.tipo.value = t;
    alCambiarTipo();
  }
  document.querySelectorAll('[data-elegir-tipo]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    elegirTipo(a.dataset.elegirTipo);
    document.querySelector('#contacto').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => form.nombre.focus({ preventScroll: true }), 400);
  }));
  elegirTipo(new URLSearchParams(location.search).get('tipo'));

  // RUT chileno: valida el dígito verificador (módulo 11) y lo formatea 12.345.678-9.
  function normalizarRut(valor) {
    const limpio = String(valor || '').replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length < 2 || limpio.length > 9) return null;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    let suma = 0;
    let factor = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += Number(cuerpo[i]) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    return dv === esperado ? `${Number(cuerpo).toLocaleString('es-CL')}-${dv}` : null;
  }

  const ayudaRut = form.querySelector('[data-rut-ayuda]');
  form.rut.addEventListener('blur', () => {
    if (!form.rut.value.trim()) return;
    const ok = normalizarRut(form.rut.value);
    if (ok) form.rut.value = ok;
    form.rut.setAttribute('aria-invalid', String(!ok));
    ayudaRut.textContent = ok ? 'RUT válido.' : 'RUT no válido: revisa el número y el dígito verificador.';
    ayudaRut.style.color = ok ? 'var(--verde)' : 'var(--rojo)';
  });

  function validar() {
    const f = form;
    if (!f.tipo.value) return [f.tipo, 'Elige el tipo de contacto.'];
    if (f.nombre.value.trim().length < 3) return [f.nombre, 'Ingresa tu nombre y apellido.'];
    if (!normalizarRut(f.rut.value)) return [f.rut, 'Ingresa un RUT válido, con dígito verificador.'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) return [f.email, 'Ingresa un correo válido.'];
    if (f.mensaje.value.trim().length < 10) return [f.mensaje, 'Cuéntanos un poco más en el mensaje (mínimo 10 caracteres).'];
    return null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = validar();
    if (error) { avisar(error[1]); error[0].focus(); return; }
    avisar('');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    const f = form;
    try {
      await api('/api/contacto', {
        method: 'POST',
        body: {
          tipo: f.tipo.value, nombre: f.nombre.value, rut: f.rut.value, email: f.email.value,
          telefono: f.telefono.value, pedido: f.pedido.value, mensaje: f.mensaje.value, web: f.web.value,
        },
      });
      document.querySelector('[data-correo-ok]').textContent = f.email.value.trim();
      document.querySelector('.contacto').classList.add('oculto');
      document.querySelector('[data-contacto-ok]').classList.remove('oculto');
      document.querySelector('#contacto').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      avisar(esc(err.message));
      boton.disabled = false;
      boton.textContent = 'Enviar mensaje';
    }
  });

  // Al llegar con #preguntas o #contacto desde otra página, abre la sección.
  if (location.hash === '#contacto') setTimeout(() => form.tipo.focus({ preventScroll: true }), 300);
})();
