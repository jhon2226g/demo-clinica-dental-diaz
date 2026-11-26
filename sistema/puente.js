/* Conecta la landing con el sistema de la demo. Las reservas se dejan en localStorage (WEB_KEY)
   y el sistema (sistema/app.js) las toma; la disponibilidad se lee de la agenda guardada (STORE_KEY).
   Se aplica después de la hidratación de React para no provocar diferencias con el HTML del servidor. */
(() => {
  const WEB_KEY = 'cdd-web-citas', STORE_KEY = 'cdd-demo-v1', SISTEMA = 'sistema/';
  const ABR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const norm = h => h.trim().padStart(5, '0');
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

  // Los botones de la landing pasan a ser los próximos días hábiles, desde mañana
  function proximosDias(n) {
    const out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    while (out.length < n) { d.setDate(d.getDate() + 1); if (d.getDay()) out.push(new Date(d)); }
    return out;
  }
  function ocupado(fecha, hora) {
    const m = toMin(hora);
    const citas = (read(STORE_KEY)?.citas || []).filter(c => c.fecha === fecha && c.estado !== 'cancelada' && toMin(c.hora) <= m && toMin(c.hora) + c.dur > m);
    const web = (read(WEB_KEY) || []).filter(w => w.fecha === fecha && w.hora === hora);
    // ponytail: 3 sillones fijos; si la clínica agrega doctores, leer la cantidad desde el sistema
    return new Set(citas.map(c => c.doctorId)).size + web.length >= 3;
  }
  const sec = () => document.getElementById('reserva');
  const radios = label => [...(sec()?.querySelectorAll(`[role=radiogroup][aria-label="${label}"] [role=radio]`) || [])];
  const elegido = label => radios(label).find(b => b.getAttribute('aria-checked') === 'true');

  function aplicar() {
    if (!sec()) return;
    const dias = radios('Día'), fechas = proximosDias(dias.length);
    dias.forEach((b, i) => {
      const span = b.querySelector('span:last-child'), d = fechas[i];
      b.dataset.fecha = iso(d);
      b.dataset.label = `${ABR[d.getDay()]} ${d.getDate()}`;
      if (span.textContent !== b.dataset.label) span.textContent = b.dataset.label;
    });
    const f = elegido('Día')?.dataset.fecha;
    for (const b of radios('Hora')) {
      const h = norm(b.textContent);
      const off = f && ocupado(f, h);
      b.toggleAttribute('data-ocupado', !!off);
      b.title = off ? 'Horario ocupado en la agenda de la clínica' : '';
    }
    const dia = elegido('Día'), hora = elegido('Hora');
    const conf = [...sec().querySelectorAll('button:not([role])')].pop();
    const txt = conf && [...conf.childNodes].filter(n => n.nodeType === 3).pop();
    if (txt && dia && hora && txt.data.startsWith('Confirmar')) txt.data = `Confirmar ${dia.dataset.label}, ${hora.textContent.trim()}`;
    const p = sec().querySelector('h2 + p');
    if (p && !p.dataset.puente) { p.dataset.puente = 1; p.textContent = 'Pruébalo aquí al lado. La cita entra a la agenda del sistema de la clínica y los horarios ocupados se muestran tachados.'; }
    const st = document.querySelector('form[aria-label^="Solicitar"] [role=status]');
    if (st && !st.dataset.puente) { st.dataset.puente = 1; st.textContent = 'Tu solicitud llega a recepción en el sistema de la clínica.'; }
  }

  function guardar(item) {
    const q = read(WEB_KEY) || [];
    q.push({ ...item, creado: new Date().toISOString() });
    localStorage.setItem(WEB_KEY, JSON.stringify(q));
  }

  const css = document.createElement('style');
  css.textContent = `
  #reserva [data-ocupado]{opacity:.35;text-decoration:line-through;cursor:not-allowed}
  .pz-scrim{position:fixed;inset:0;background:rgba(15,19,36,.5);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}
  .pz-box{background:#fff;color:#141A33;border-radius:24px;width:min(420px,100%);padding:24px;display:grid;gap:14px;font-family:inherit;box-shadow:0 30px 80px -20px rgba(0,0,0,.5)}
  .pz-box h3{margin:0;font-size:20px;font-weight:600;letter-spacing:-.01em}
  .pz-box p{margin:0;color:#5A6380;font-size:14px}
  .pz-box label{display:grid;gap:6px;font-size:13px;font-weight:600}
  .pz-box input,.pz-box select{height:44px;border:1px solid #D9DEEC;border-radius:12px;padding:0 12px;font:inherit;color:inherit;background:#fff}
  .pz-row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
  .pz-btn{height:44px;border-radius:999px;padding:0 18px;font-weight:600;border:1px solid #D9DEEC;background:#fff;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none;color:#141A33}
  .pz-pri{background:var(--brand,#17365f);color:var(--brand-ink,#fff);border:0}
  .pz-err{color:#C0263D;font-size:13px;min-height:1em}
  .pz-fab{position:fixed;left:16px;bottom:16px;z-index:90;background:#141A33;color:#fff;border-radius:999px;padding:10px 16px;font-size:13px;font-weight:600;text-decoration:none;box-shadow:0 10px 30px -10px rgba(0,0,0,.5)}
  .pz-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:110;background:#141A33;color:#fff;border-radius:14px;padding:12px 16px;font-size:14px;max-width:calc(100% - 32px)}
  .pz-toast a{color:#9FE7F5;font-weight:600}`;
  document.head.append(css);

  function toast(html) {
    const t = document.createElement('div'); t.className = 'pz-toast'; t.innerHTML = html; document.body.append(t);
    setTimeout(() => t.remove(), 6000);
  }

  function modalReserva(fecha, hora) {
    const d = new Date(fecha + 'T00:00');
    const s = document.createElement('div'); s.className = 'pz-scrim';
    s.innerHTML = `<form class="pz-box" novalidate><h3>Confirma tu cita</h3>
      <p>${d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${hora}</p>
      <label>Nombre y apellidos<input name="nombre" autocomplete="name" required></label>
      <label>Celular<input name="tel" inputmode="tel" autocomplete="tel" required></label>
      <label>Motivo<select name="motivo"><option>Evaluación general</option><option>Ortodoncia</option><option>Implantes</option><option>Blanqueamiento</option><option>Profilaxis y limpieza</option><option>Dolor o urgencia</option></select></label>
      <span class="pz-err" role="alert"></span>
      <div class="pz-row"><button type="button" class="pz-btn" data-x>Cancelar</button><button class="pz-btn pz-pri">Reservar</button></div></form>`;
    document.body.append(s);
    s.querySelector('input').focus();
    const close = () => s.remove();
    s.addEventListener('click', e => { if (e.target === s || e.target.matches('[data-x]')) close(); });
    s.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target), nombre = f.get('nombre').trim(), tel = f.get('tel').replace(/\D/g, '');
      const err = nombre.length < 3 ? 'Escribe tu nombre.' : tel.length < 9 ? 'Escribe un celular de 9 dígitos.' : ocupado(fecha, hora) ? 'Ese horario acaba de ocuparse. Elige otro.' : '';
      if (err) { s.querySelector('.pz-err').textContent = err; return; }
      guardar({ nombre, tel, motivo: f.get('motivo'), fecha, hora });
      s.querySelector('form').innerHTML = `<h3>¡Listo, ${nombre.split(' ')[0]}!</h3><p>Tu cita quedó registrada en la agenda de la clínica. Un día antes te llegará un recordatorio por WhatsApp.</p>
        <p style="background:#F5F7FC;border-radius:12px;padding:10px 12px">Demo: entra al sistema como Recepción y la verás en la agenda marcada como reserva web.</p>
        <div class="pz-row"><button type="button" class="pz-btn" data-x>Cerrar</button><a class="pz-btn pz-pri" href="${SISTEMA}#/agenda" target="_blank" rel="noopener">Ver en el sistema</a></div>`;
      aplicar();
    });
  }

  // Captura en document: corre antes que los manejadores de React (que escuchan en su contenedor)
  document.addEventListener('click', e => {
    const b = e.target.closest?.('#reserva button');
    if (!b) return;
    if (b.matches('[data-ocupado]')) { e.preventDefault(); e.stopPropagation(); return; }
    if (b.getAttribute('role') !== 'radio' && !b.disabled) {
      const f = elegido('Día')?.dataset.fecha, h = elegido('Hora');
      if (f && h) { e.preventDefault(); e.stopPropagation(); modalReserva(f, norm(h.textContent)); return; }
    }
    setTimeout(aplicar, 0);
  }, true);

  document.addEventListener('submit', e => {
    const f = e.target;
    if (!f.matches?.('form[aria-label^="Solicitar"]')) return;
    e.preventDefault(); e.stopPropagation();
    const nombre = f.querySelector('#nombre').value.trim(), tel = f.querySelector('#telefono').value.replace(/\D/g, '');
    const st = f.querySelector('[role=status]');
    if (nombre.length < 3 || tel.length < 9) { st.textContent = 'Escribe tu nombre y un celular de 9 dígitos.'; st.style.color = '#C0263D'; return; }
    guardar({ nombre, tel, motivo: f.querySelector('#motivo').value });
    f.querySelector('#nombre').value = ''; f.querySelector('#telefono').value = '';
    st.style.color = ''; st.textContent = 'Listo. Recepción te llamará para darte la hora.';
    toast(`Solicitud enviada a la clínica. <a href="${SISTEMA}#/inicio" target="_blank" rel="noopener">Ver en el sistema</a>`);
  }, true);

  const fab = document.createElement('a');
  fab.className = 'pz-fab'; fab.href = SISTEMA; fab.textContent = 'Acceso clínica';
  window.addEventListener('load', () => { setTimeout(() => { aplicar(); document.body.append(fab); }, 1200); });
  window.addEventListener('storage', e => { if (e.key === STORE_KEY || e.key === WEB_KEY) aplicar(); });
})();
