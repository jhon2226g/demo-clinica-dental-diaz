'use strict';
/* Demo del sistema de Clínica Dental Díaz. Todo vive en localStorage del navegador:
   la landing (../index.html) deja sus reservas en WEB_KEY y este sistema las toma. */
const STORE_KEY = 'cdd-demo-v1';
const WEB_KEY = 'cdd-web-citas';
const USER_KEY = 'cdd-user';
const PASS = 'demo2026';

const root = document.getElementById('root');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'S/ ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const TODAY = iso(new Date());
const fdate = (s, o = { day: 'numeric', month: 'short' }) => parse(s).toLocaleDateString('es-PE', o);
const fdateL = s => fdate(s, { weekday: 'long', day: 'numeric', month: 'long' });
const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const toH = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const initials = n => n.replace(/^(Dra?\.)\s/, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const uid = p => p + Math.random().toString(36).slice(2, 8);
const digits = s => String(s || '').replace(/\D/g, '');
const age = s => { const b = parse(s), t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const daysToBirthday = s => { const b = parse(s), t = parse(TODAY); let n = new Date(t.getFullYear(), b.getMonth(), b.getDate()); if (n < t) n = new Date(t.getFullYear() + 1, b.getMonth(), b.getDate()); return Math.round((n - t) / 864e5); };

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Datos de ejemplo ---------- */
const DOCTORES = [
  { id: 'd1', nombre: 'Dr. Luis Díaz Salazar', esp: 'Rehabilitación oral e implantes', color: '#2E3F94', sillon: 'Sillón 1' },
  { id: 'd2', nombre: 'Dra. Carmen Vega Ríos', esp: 'Ortodoncia', color: '#0E7490', sillon: 'Sillón 2' },
  { id: 'd3', nombre: 'Dr. Martín Espinoza Cruz', esp: 'Endodoncia y odontología general', color: '#B45309', sillon: 'Sillón 3' },
];
const USERS = [
  { email: 'recepcion@clinicadiaz.pe', nombre: 'Rosa Mendoza', rol: 'Recepción' },
  { email: 'ldiaz@clinicadiaz.pe', nombre: 'Dr. Luis Díaz', rol: 'Doctor', doctorId: 'd1' },
  { email: 'admin@clinicadiaz.pe', nombre: 'Administración', rol: 'Administrador' },
];
const METODOS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia'];
const ESTADOS = { pendiente: 'Por confirmar', confirmada: 'Confirmada', ensala: 'En sala', atendida: 'Atendida', cancelada: 'Cancelada' };
const EST_CHIP = { pendiente: 'warn', confirmada: 'br', ensala: 'info', atendida: 'ok', cancelada: 'bad' };
const SLOT = 30, A_START = 8 * 60, A_END = 20 * 60;
const MEDS = ['Amoxicilina 500 mg', 'Clindamicina 300 mg', 'Ibuprofeno 400 mg', 'Paracetamol 500 mg', 'Ketorolaco 10 mg', 'Naproxeno 550 mg', 'Clorhexidina 0.12% enjuague', 'Dexametasona 4 mg'];

function isOpen(date, min) {
  const wd = parse(date).getDay();
  if (wd === 0) return false;
  if (wd === 6) return min >= 9 * 60 && min < 13 * 60;
  return (min >= 9 * 60 && min < 13 * 60) || (min >= 15 * 60 && min < 20 * 60);
}

function seed() {
  const r = rng(Number(TODAY.replace(/-/g, '')));
  const pick = a => a[Math.floor(r() * a.length)];
  const tarifario = [
    ['t1', 'Consulta y evaluación', 50, 30], ['t2', 'Profilaxis y destartraje', 120, 30], ['t3', 'Resina simple', 90, 30],
    ['t4', 'Resina compuesta', 150, 60], ['t5', 'Endodoncia unirradicular', 380, 60], ['t6', 'Endodoncia multirradicular', 550, 60],
    ['t7', 'Extracción simple', 100, 30], ['t8', 'Extracción de tercera molar', 350, 60], ['t9', 'Corona de porcelana', 900, 60],
    ['t10', 'Implante dental', 3200, 60], ['t11', 'Blanqueamiento', 600, 60], ['t12', 'Ortodoncia brackets metálicos (inicial)', 1500, 60],
    ['t13', 'Control de ortodoncia', 150, 30], ['t14', 'Radiografía periapical', 25, 30], ['t15', 'Tomografía 3D', 180, 30], ['t16', 'Sellante por pieza', 40, 30],
  ].map(([id, nombre, precio, dur]) => ({ id, nombre, precio, dur }));
  const bd = (daysFromToday, years) => { const d = parse(addDays(TODAY, daysFromToday)); d.setFullYear(d.getFullYear() - years); return iso(d); };
  const P = [
    ['María Torres Ramos', bd(6, 34), 'Penicilina', '0458', -18],
    ['José Luis Quispe Huamán', bd(41, 52), '', '0312', -3],
    ['Rosa Elvira Chumpitaz León', bd(2, 61), 'Látex', '0127', -9],
    ['Carlos Alberto Rojas Medina', bd(120, 45), '', '0601', -230],
    ['Lucía Fernanda Paredes Soto', bd(15, 27), '', '0733', -6],
    ['Miguel Ángel Ramírez Villanueva', bd(200, 38), '', '0219', -260],
    ['Ana Sofía Huerta Cárdenas', bd(28, 9), '', '0815', -14],
    ['Jorge Enrique Salinas Bravo', bd(75, 57), 'AINES', '0094', -1],
    ['Patricia Milagros Flores Aguirre', bd(0, 31), '', '0547', -40],
    ['Renzo Valentín Castillo Ugarte', bd(160, 23), '', '0902', -300],
    ['Gladys Norma Vásquez Rivera', bd(9, 66), '', '0033', -21],
    ['Kevin Joel Mendoza Pajuelo', bd(300, 19), '', '0951', -11],
    ['Elena Victoria Sánchez Tello', bd(55, 42), '', '0388', -200],
    ['Fernando Raúl Aguilar Neyra', bd(24, 49), '', '0466', -5],
  ];
  const pacientes = P.map(([nombre, nac, alergia, ficha], i) => ({
    id: 'p' + (i + 1), nombre, nac, alergia, ficha,
    dni: String(40000000 + Math.floor(r() * 39999999)),
    tel: '9' + String(Math.floor(r() * 1e8)).padStart(8, '0'),
    email: nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + (i + 3) + '@gmail.com',
    desde: addDays(TODAY, -Math.floor(200 + r() * 1500)), origen: 'recepcion',
  }));
  const citas = [], cargos = [], pagos = [], comprobantes = [];
  // Pacientes con última visita antigua: alimentan la campaña de reactivación
  const activos = pacientes.filter((_, i) => P[i][4] > -100);
  pacientes.forEach((p, i) => { if (P[i][4] <= -100) citas.push({ id: uid('c'), fecha: addDays(TODAY, P[i][4]), hora: '10:00', dur: 30, doctorId: 'd3', pacienteId: p.id, tratId: 't2', motivo: 'Profilaxis y destartraje', estado: 'atendida', origen: 'recepcion' }); });
  let nb = 2841, nf = 312;
  const busy = {};
  const take = (f, d, pid, h, dur) => { for (let m = h; m < h + dur; m += SLOT) { if (busy[f + d + m] || busy[f + pid + m] || !isOpen(f, m)) return false; } for (let m = h; m < h + dur; m += SLOT) busy[f + d + m] = busy[f + pid + m] = 1; return true; };
  const motivoDoc = { d1: ['t1', 't9', 't10', 't4', 't7', 't14', 't15', 't11'], d2: ['t13', 't13', 't13', 't12', 't1', 't2'], d3: ['t5', 't6', 't3', 't4', 't2', 't7', 't8', 't16'] };
  const nm = nowMin();
  for (let off = -24; off <= 14; off++) {
    const f = addDays(TODAY, off);
    if (parse(f).getDay() === 0) continue;
    for (const doc of DOCTORES) {
      const n = 2 + Math.floor(r() * 4);
      for (let k = 0; k < n * 3 && citas.filter(c => c.fecha === f && c.doctorId === doc.id).length < n; k++) {
        const tid = pick(motivoDoc[doc.id]), t = tarifario.find(x => x.id === tid);
        const h = 9 * 60 + Math.floor(r() * 22) * SLOT;
        const p = pick(activos);
        if (!take(f, doc.id, p.id, h, t.dur)) continue;
        let estado;
        if (off < 0) estado = r() < 0.9 ? 'atendida' : 'cancelada';
        else if (off === 0) estado = h + t.dur <= nm ? (r() < 0.92 ? 'atendida' : 'cancelada') : h <= nm ? 'ensala' : r() < 0.7 ? 'confirmada' : 'pendiente';
        else estado = off < 3 && r() < 0.5 ? 'confirmada' : 'pendiente';
        const c = { id: uid('c'), fecha: f, hora: toH(h), dur: t.dur, doctorId: doc.id, pacienteId: p.id, tratId: t.id, motivo: t.nombre, estado, origen: r() < 0.32 ? 'web' : 'recepcion' };
        citas.push(c);
        if (estado === 'atendida') {
          cargos.push({ id: uid('g'), fecha: f, pacienteId: p.id, concepto: t.nombre, monto: t.precio });
          const parcial = t.precio >= 500 && r() < 0.4;
          const monto = parcial ? Math.round(t.precio / 2) : t.precio;
          const fact = r() < 0.12;
          const comp = { id: fact ? `F001-${String(nf++).padStart(6, '0')}` : `B001-${String(nb++).padStart(6, '0')}`, tipo: fact ? 'Factura' : 'Boleta', fecha: f, pacienteId: p.id, total: monto, estado: 'Aceptado', concepto: t.nombre, ruc: fact ? '20' + String(Math.floor(r() * 1e9)).padStart(9, '0') : '' };
          comprobantes.push(comp);
          pagos.push({ id: uid('$'), fecha: f, hora: toH(h + t.dur), pacienteId: p.id, monto, metodo: pick(METODOS), concepto: t.nombre + (parcial ? ' (adelanto)' : ''), comprobanteId: comp.id });
        }
      }
    }
  }
  // María: implante en curso con saldo, ficha del mockup
  cargos.push({ id: uid('g'), fecha: addDays(TODAY, -40), pacienteId: 'p1', concepto: 'Implante dental pieza 36', monto: 3200 });
  pagos.push({ id: uid('$'), fecha: addDays(TODAY, -40), hora: '10:30', pacienteId: 'p1', monto: 2000, metodo: 'Transferencia', concepto: 'Implante dental pieza 36 (adelanto)', comprobanteId: 'B001-002790' });
  comprobantes.push({ id: 'B001-002790', tipo: 'Boleta', fecha: addDays(TODAY, -40), pacienteId: 'p1', total: 2000, estado: 'Aceptado', concepto: 'Implante dental pieza 36 (adelanto)' });
  const lastC = comprobantes.slice(-3);
  lastC[0].estado = 'Pendiente';

  const odontos = {
    p1: { 36: { implante: 1 }, 26: { corona: 1 }, 15: { o: 'restauracion', m: 'restauracion' }, 46: { o: 'caries' }, 18: { ausente: 1 }, 48: { ausente: 1 }, 24: { d: 'caries' } },
    p2: { 11: { corona: 1 }, 21: { corona: 1 }, 37: { endodoncia: 1, o: 'restauracion' }, 38: { extraccion: 1 }, 16: { o: 'caries', v: 'caries' } },
    p3: { 17: { ausente: 1 }, 27: { ausente: 1 }, 46: { endodoncia: 1, corona: 1 }, 34: { v: 'caries' } },
  };
  const planes = {
    p1: [{ id: uid('i'), tratId: 't10', diente: '36', precio: 3200, estado: 'proceso' }, { id: uid('i'), tratId: 't9', diente: '26', precio: 900, estado: 'terminado' }, { id: uid('i'), tratId: 't4', diente: '46', precio: 150, estado: 'pendiente' }, { id: uid('i'), tratId: 't4', diente: '24', precio: 150, estado: 'pendiente' }, { id: uid('i'), tratId: 't2', diente: '', precio: 120, estado: 'pendiente' }],
    p2: [{ id: uid('i'), tratId: 't6', diente: '37', precio: 550, estado: 'terminado' }, { id: uid('i'), tratId: 't8', diente: '38', precio: 350, estado: 'pendiente' }, { id: uid('i'), tratId: 't4', diente: '16', precio: 150, estado: 'pendiente' }],
  };
  return {
    seededOn: TODAY, tarifario, pacientes, citas, cargos, pagos, comprobantes, odontos, planes, solicitudes: [],
    evoluciones: [
      { id: uid('e'), pacienteId: 'p1', fecha: addDays(TODAY, -18), doctorId: 'd1', texto: 'Control de oseointegración pieza 36. Sin dolor ni movilidad. Se toma impresión para corona sobre implante. Próximo control en 3 semanas.' },
      { id: uid('e'), pacienteId: 'p1', fecha: addDays(TODAY, -40), doctorId: 'd1', texto: 'Colocación de implante pieza 36 bajo anestesia local. Paciente alérgica a penicilina: se indica clindamicina.' },
    ],
    recetas: [{ id: uid('r'), pacienteId: 'p1', fecha: addDays(TODAY, -40), doctorId: 'd1', items: [{ med: 'Clindamicina 300 mg', dosis: '1 cápsula', frec: 'cada 8 horas', dias: 7 }, { med: 'Ibuprofeno 400 mg', dosis: '1 tableta', frec: 'cada 8 horas', dias: 3 }], ind: 'Dieta blanda 48 horas. No enjuagar con fuerza el primer día.' }],
    consentimientos: [{ id: uid('k'), pacienteId: 'p1', tipo: 'Colocación de implante dental', fecha: addDays(TODAY, -40), firmado: true }, { id: uid('k'), pacienteId: 'p1', tipo: 'Corona sobre implante', fecha: addDays(TODAY, -18), firmado: false }],
    lab: [
      { id: uid('l'), pacienteId: 'p1', trabajo: 'Corona de zirconio sobre implante, pieza 36', lab: 'Dental Lab Huacho', enviado: addDays(TODAY, -15), entrega: addDays(TODAY, 2), estado: 'proceso', costo: 420 },
      { id: uid('l'), pacienteId: 'p2', trabajo: 'Corona de porcelana, pieza 11', lab: 'Ceramic Art Lima', enviado: addDays(TODAY, -9), entrega: addDays(TODAY, 5), estado: 'enviado', costo: 350 },
      { id: uid('l'), pacienteId: 'p3', trabajo: 'Prótesis parcial removible superior', lab: 'Dental Lab Huacho', enviado: addDays(TODAY, -20), entrega: addDays(TODAY, -1), estado: 'recibido', costo: 480 },
      { id: uid('l'), pacienteId: 'p8', trabajo: 'Placa de relajación', lab: 'Dental Lab Huacho', enviado: addDays(TODAY, -30), entrega: addDays(TODAY, -12), estado: 'instalado', costo: 180 },
      { id: uid('l'), pacienteId: 'p14', trabajo: 'Incrustación de resina, pieza 46', lab: 'Ceramic Art Lima', enviado: addDays(TODAY, -4), entrega: addDays(TODAY, 8), estado: 'enviado', costo: 220 },
    ],
    inventario: [
      ['Anestesia lidocaína 2% (cartucho)', 'Anestesia', 46, 60, 'und', 2.8], ['Resina compuesta A2', 'Restauración', 7, 5, 'jeringa', 68], ['Resina compuesta A3', 'Restauración', 3, 5, 'jeringa', 68],
      ['Guantes de nitrilo talla M', 'Bioseguridad', 14, 10, 'caja', 24], ['Mascarillas quirúrgicas', 'Bioseguridad', 6, 8, 'caja', 15], ['Limas K 21 mm surtidas', 'Endodoncia', 12, 6, 'blíster', 32],
      ['Hipoclorito de sodio 5%', 'Endodoncia', 4, 3, 'litro', 18], ['Brackets metálicos Roth (kit)', 'Ortodoncia', 9, 4, 'kit', 95], ['Alginato', 'Impresión', 2, 4, 'bolsa', 38],
      ['Eyectores de saliva', 'Descartables', 180, 100, 'und', 0.12], ['Implante 4.0 x 10 mm', 'Implantes', 5, 3, 'und', 520], ['Gel blanqueador 35%', 'Estética', 3, 2, 'kit', 145],
    ].map(([nombre, cat, stock, min, unidad, costo]) => ({ id: uid('v'), nombre, cat, stock, min, unidad, costo })),
    caja: { apertura: 200, egresos: [{ id: uid('x'), fecha: TODAY, hora: '09:40', concepto: 'Compra de agua y útiles de limpieza', monto: 36 }], cerrada: false },
    marketing: { cumple: true, descuento: 15, resenas: true, reactivacion: true, recordatorio: true },
    cupones: [{ codigo: 'CUMPLE-PATRICIA', pacienteId: 'p9', desc: 15, vence: addDays(TODAY, 30), usado: false, enviado: TODAY }],
    mensajes: [
      { id: uid('m'), fecha: TODAY, hora: '08:00', pacienteId: 'p9', tipo: 'Cumpleaños', texto: '¡Feliz cumpleaños, Patricia! En Clínica Dental Díaz te regalamos 15% de descuento en tu próxima limpieza. Código CUMPLE-PATRICIA, válido 30 días.', estado: 'Leído' },
      { id: uid('m'), fecha: addDays(TODAY, -1), hora: '18:00', pacienteId: 'p1', tipo: 'Recordatorio', texto: 'Hola María, te recordamos tu cita de mañana con el Dr. Luis Díaz. Responde Confirmar o Reprogramar.', estado: 'Respondido', resp: 'Confirmar' },
    ],
    // Meses anteriores proyectados desde lo cobrado en las últimas 3 semanas de ejemplo
    hist: [0.82, 0.88, 0.76, 0.95, 0.91, 1].map(f => Math.round(pagos.filter(x => x.fecha < TODAY).reduce((a, x) => a + x.monto, 0) / 24 * 26 * f / 10) * 10),
  };
}

let S;
function load() {
  try { S = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { S = null; }
  // ponytail: los datos de ejemplo se regeneran cada día para que la agenda siempre luzca viva; los cambios del día se conservan
  if (!S || S.seededOn !== TODAY) S = seed();
  ingestWeb(false);
  save();
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { } }

const pac = id => S.pacientes.find(p => p.id === id) || { nombre: 'Paciente', tel: '', id };
const doc = id => DOCTORES.find(d => d.id === id) || DOCTORES[0];
const trat = id => S.tarifario.find(t => t.id === id);
const saldo = pid => S.cargos.filter(c => c.pacienteId === pid).reduce((a, c) => a + c.monto, 0) - S.pagos.filter(c => c.pacienteId === pid).reduce((a, c) => a + c.monto, 0);

function slotFree(fecha, doctorId, hora, dur, ignore) {
  const a = toMin(hora), b = a + dur;
  for (let m = a; m < b; m += SLOT) if (!isOpen(fecha, m)) return false;
  return !S.citas.some(c => c.id !== ignore && c.estado !== 'cancelada' && c.fecha === fecha && c.doctorId === doctorId && toMin(c.hora) < b && toMin(c.hora) + c.dur > a);
}

/* ---------- Puente con la landing ---------- */
function ingestWeb(live) {
  let q = [];
  try { q = JSON.parse(localStorage.getItem(WEB_KEY) || '[]'); } catch { }
  if (!q.length) return 0;
  for (const w of q) {
    let p = S.pacientes.find(x => digits(x.tel).slice(-9) === digits(w.tel).slice(-9) && digits(w.tel));
    if (!p) {
      p = { id: uid('p'), nombre: w.nombre || 'Paciente web', tel: digits(w.tel), dni: '', nac: '', alergia: '', ficha: String(1000 + S.pacientes.length), email: '', desde: TODAY, origen: 'web' };
      S.pacientes.push(p);
    }
    const t = S.tarifario.find(t => (w.motivo || '').toLowerCase().includes(t.nombre.split(' ')[0].toLowerCase())) || S.tarifario[0];
    if (w.fecha && w.hora) {
      const pref = /orto/i.test(w.motivo || '') ? ['d2', 'd1', 'd3'] : /implant/i.test(w.motivo || '') ? ['d1', 'd3', 'd2'] : ['d3', 'd1', 'd2'];
      const d = pref.find(id => slotFree(w.fecha, id, w.hora, SLOT)) || pref[0];
      S.citas.push({ id: uid('c'), fecha: w.fecha, hora: w.hora, dur: SLOT, doctorId: d, pacienteId: p.id, tratId: t.id, motivo: w.motivo || t.nombre, estado: 'pendiente', origen: 'web', nueva: true });
      S.mensajes.unshift({ id: uid('m'), fecha: TODAY, hora: toH(nowMin()), pacienteId: p.id, tipo: 'Reserva web', texto: `Hola ${p.nombre.split(' ')[0]}, recibimos tu reserva para el ${fdateL(w.fecha)} a las ${w.hora}. Te escribiremos un día antes para confirmar.`, estado: 'Entregado' });
      if (live) toast(`Nueva cita desde la web: ${p.nombre}, ${fdate(w.fecha)} ${w.hora}`, 'ph-globe');
    } else {
      S.solicitudes.unshift({ id: uid('s'), fecha: TODAY, hora: toH(nowMin()), pacienteId: p.id, motivo: w.motivo || 'Evaluación general' });
      if (live) toast(`Nueva solicitud desde la web: ${p.nombre}`, 'ph-globe');
    }
  }
  localStorage.removeItem(WEB_KEY);
  return q.length;
}
window.addEventListener('storage', e => {
  if (e.key === WEB_KEY && e.newValue && user()) { if (ingestWeb(true)) { save(); render(); } }
});

/* ---------- UI helpers ---------- */
function toast(msg, icon = 'ph-check-circle', cls = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.innerHTML = `<i class="ph ${icon}"></i><span>${esc(msg)}</span>`;
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 4200);
}
let modalEl = null;
function modal(title, body, foot = '', cls = '') {
  closeModal();
  modalEl = document.createElement('div');
  modalEl.className = 'scrim';
  modalEl.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${title}</h3><button class="x" data-act="close" aria-label="Cerrar"><i class="ph ph-x"></i></button></header><div class="body">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`;
  modalEl.addEventListener('mousedown', e => { if (e.target === modalEl) closeModal(); });
  document.body.append(modalEl);
  modalEl.querySelector('input,select,textarea')?.focus();
  return modalEl;
}
function closeModal() { modalEl?.remove(); modalEl = null; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
const val = (sel, el = modalEl) => el.querySelector(sel)?.value?.trim() ?? '';
const chip = (txt, c) => `<span class="chip ${c}">${esc(txt)}</span>`;
const estChip = e => chip(ESTADOS[e], EST_CHIP[e]);
const who = (p, sub) => `<span class="who"><span class="av">${initials(p.nombre)}</span><span>${esc(p.nombre)}<small>${sub ?? ''}</small></span></span>`;
const empty = (icon, txt) => `<div class="empty"><i class="ph ${icon}"></i><span>${txt}</span></div>`;

/* ---------- Gráficos (SVG) ---------- */
function bars(data, { h = 220, fmt = v => v, color = 'var(--brand-2)' } = {}) {
  const w = 600, pt = 24, pb = 28, max = Math.max(...data.map(d => d.v), 1) * 1.1;
  const bw = (w / data.length) * 0.56, step = w / data.length;
  const ticks = [0, 0.5, 1].map(f => max * f);
  return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" role="img">${ticks.map(t => { const y = h - pb - (t / max) * (h - pt - pb); return `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="var(--line)"/>`; }).join('')}
  ${data.map((d, i) => { const bh = (d.v / max) * (h - pt - pb), x = i * step + (step - bw) / 2, y = h - pb - bh;
    return `<g data-tip="${esc(d.l)}: ${esc(fmt(d.v))}"><rect x="${i * step}" y="${pt}" width="${step}" height="${h - pt - pb}" fill="transparent"/><path d="M${x},${h - pb} V${y + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${h - pb} Z" fill="${d.c || color}" opacity="${d.dim ? .45 : 1}"/>
    <text x="${x + bw / 2}" y="${h - 9}" text-anchor="middle">${esc(d.l)}</text>${d.lab ? `<text class="val" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${esc(fmt(d.v))}</text>` : ''}</g>`; }).join('')}</svg></div>`;
}
function hbars(data, { fmt = v => v, color = 'var(--brand-2)' } = {}) {
  const max = Math.max(...data.map(d => d.v), 1);
  return `<div class="list">${data.map(d => `<div class="li" data-tip="${esc(d.l)}: ${esc(fmt(d.v))}" style="display:grid;grid-template-columns:minmax(0,1fr) 90px;gap:6px 12px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.l)}</span><b class="r">${esc(fmt(d.v))}</b><span class="bar" style="grid-column:1/-1;background:transparent"><span style="width:${(d.v / max) * 100}%;background:${d.c || color}"></span></span></div>`).join('')}</div>`;
}
const tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.hidden = true; document.body.append(tipEl);
document.addEventListener('mousemove', e => {
  const t = e.target.closest?.('[data-tip]');
  if (!t) { tipEl.hidden = true; return; }
  tipEl.hidden = false; tipEl.textContent = t.dataset.tip; tipEl.style.left = e.clientX + 'px'; tipEl.style.top = e.clientY + 'px';
});

/* ---------- Sesión y navegación ---------- */
const user = () => { try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; } };
const NAV = [
  ['inicio', 'Inicio', 'ph-house'], ['agenda', 'Agenda', 'ph-calendar-dots'], ['pacientes', 'Pacientes', 'ph-users'],
  ['caja', 'Caja y cobros', 'ph-cash-register'], ['facturacion', 'Facturación SUNAT', 'ph-receipt'], ['laboratorio', 'Laboratorio', 'ph-flask'],
  ['inventario', 'Inventario', 'ph-package'], ['reportes', 'Reportes', 'ph-chart-bar'], ['marketing', 'Marketing', 'ph-megaphone'], ['ajustes', 'Ajustes', 'ph-gear'],
];
const ALLOWED = { Doctor: ['inicio', 'agenda', 'pacientes', 'laboratorio', 'reportes'], 'Recepción': ['inicio', 'agenda', 'pacientes', 'caja', 'facturacion', 'laboratorio', 'inventario', 'marketing'] };
const can = r => { const u = user(); return u.rol === 'Administrador' || ALLOWED[u.rol].includes(r); };
const route = () => (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');

const ui = { agDay: TODAY, agDoc: 'todos', tab: 'resumen', q: '', odoTool: 'caries', facF: 'todos', repN: 6 };

function render() {
  const u = user();
  if (!u) return renderLogin();
  let [r, id] = route();
  if (!NAV.some(n => n[0] === r) || !can(r)) { r = 'inicio'; }
  const views = { inicio: vInicio, agenda: vAgenda, pacientes: id ? () => vPaciente(id) : vPacientes, caja: vCaja, facturacion: vFacturacion, laboratorio: vLab, inventario: vInventario, reportes: vReportes, marketing: vMarketing, ajustes: vAjustes };
  const pend = S.citas.filter(c => c.fecha === TODAY && c.estado !== 'cancelada').length;
  root.innerHTML = `<div class="app" id="app">
  <aside class="side">
    ${logo()}
    ${NAV.filter(n => can(n[0])).map(([k, l, i]) => `<a class="nav ${k === r ? 'on' : ''}" href="#/${k}"><i class="ph ${i}"></i>${l}${k === 'agenda' ? `<span class="badge">${pend} hoy</span>` : ''}${k === 'pacientes' && S.solicitudes.length ? `<span class="badge">${S.solicitudes.length} web</span>` : ''}</a>`).join('')}
    <div class="foot"><a href="../" target="_blank" rel="noopener"><i class="ph ph-globe"></i> Ver la web de citas</a><span>Demo con datos de ejemplo. Propuesta de QH Soluciones Informáticas.</span></div>
  </aside>
  <div class="main">
    <header class="top">
      <button class="btn ghost menu-btn" data-act="menu" aria-label="Abrir menú"><i class="ph ph-list"></i></button>
      <div class="search"><i class="ph ph-magnifying-glass"></i><input id="q" placeholder="Buscar paciente por nombre, DNI o celular" autocomplete="off" aria-label="Buscar paciente"><div class="search-res" id="qres" hidden></div></div>
      <span class="sp"></span>
      ${can('agenda') ? `<button class="btn" data-act="nuevaCita"><i class="ph ph-calendar-plus"></i><span>Nueva cita</span></button>` : ''}
      <button class="btn pri" data-act="nuevoPaciente"><i class="ph ph-user-plus"></i><span>Nuevo paciente</span></button>
      <button class="user" data-act="logout" title="Cerrar sesión"><span class="av">${initials(u.nombre)}</span><div><b>${esc(u.nombre)}</b><small>${esc(u.rol)}</small></div><i class="ph ph-sign-out muted"></i></button>
    </header>
    <section class="content" id="view">${views[r]()}</section>
  </div></div>`;
  window.scrollTo(0, 0);
}
const logo = (dark) => `<div class="logo"><svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="${dark ? '#2E3F94' : '#fff'}"/><path d="M12.5 12.6c2.3-2.2 4.8-1.4 7.5-.3 2.7-1.1 5.2-1.9 7.5.3 2.3 2.3 1.6 6.2.6 9.1-.8 2.4-1.2 5.3-1.8 7.6-.4 1.4-1.9 1.5-2.3.1l-1.8-5.6c-.5-1.6-3.9-1.6-4.4 0l-1.8 5.6c-.4 1.4-1.9 1.3-2.3-.1-.6-2.3-1-5.2-1.8-7.6-1-2.9-1.7-6.8.6-9.1z" fill="${dark ? '#fff' : '#2E3F94'}"/></svg><div><b>DIAZ</b><small>CLÍNICA DENTAL</small></div></div>`;

function renderLogin() {
  root.innerHTML = `<div class="login">
  <div class="login-art"><h2>La agenda, las fichas y la caja de la clínica en un solo lugar.</h2><p>Las citas que los pacientes reservan en la web llegan aquí al instante.</p></div>
  <div class="login-form"><form id="loginF" novalidate>
    <div style="color:var(--brand)">${logo(true)}</div>
    <div><h1>Ingresar al sistema</h1><p class="muted" style="margin:6px 0 0">Elige un perfil para probar la demo.</p></div>
    <div class="roles">${USERS.map((u, i) => `<button type="button" class="role" data-act="pickRole" data-i="${i}" aria-pressed="${i === 0}"><b>${u.rol}</b><small>${esc(u.nombre)}</small></button>`).join('')}</div>
    <div class="f"><label for="em">Correo</label><input id="em" type="email" value="${USERS[0].email}" autocomplete="username"></div>
    <div class="f"><label for="pw">Contraseña</label><input id="pw" type="password" value="${PASS}" autocomplete="current-password"><span class="err" id="lerr" role="alert"></span></div>
    <button class="btn pri" style="height:44px">Ingresar</button>
    <p class="hint">Demo: la contraseña de los tres perfiles es <b>${PASS}</b>. Los datos son ficticios y se guardan solo en este navegador.</p>
    <a href="../" class="muted" style="font-size:13px"><i class="ph ph-arrow-left"></i> Volver a la web de la clínica</a>
  </form></div></div>`;
  document.getElementById('loginF').onsubmit = e => {
    e.preventDefault();
    const em = document.getElementById('em').value.trim().toLowerCase(), pw = document.getElementById('pw').value;
    const u = USERS.find(x => x.email === em);
    if (!u || pw !== PASS) { document.getElementById('lerr').textContent = 'Correo o contraseña incorrectos.'; return; }
    sessionStorage.setItem(USER_KEY, JSON.stringify(u));
    if (u.doctorId) ui.agDoc = u.doctorId;
    location.hash = '#/inicio';
    render();
  };
}

/* ---------- Inicio ---------- */
function vInicio() {
  const u = user();
  const hoy = S.citas.filter(c => c.fecha === TODAY && (!u.doctorId || c.doctorId === u.doctorId)).sort((a, b) => a.hora.localeCompare(b.hora));
  const activas = hoy.filter(c => c.estado !== 'cancelada');
  const conf = activas.filter(c => ['confirmada', 'ensala', 'atendida'].includes(c.estado)).length;
  const ing = S.pagos.filter(p => p.fecha === TODAY).reduce((a, p) => a + p.monto, 0);
  const porCobrar = S.pacientes.reduce((a, p) => a + Math.max(0, saldo(p.id)), 0);
  const cumple = S.pacientes.filter(p => p.nac && daysToBirthday(p.nac) <= 7).sort((a, b) => daysToBirthday(a.nac) - daysToBirthday(b.nac));
  const web = S.citas.filter(c => c.nueva);
  const bajos = S.inventario.filter(i => i.stock < i.min);
  const labHoy = S.lab.filter(l => l.estado !== 'instalado' && l.entrega <= addDays(TODAY, 2));
  const h = new Date().getHours();
  return `<div class="page-h"><div><h1>${h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${esc(u.nombre.split(' ')[0] === 'Dr.' ? u.nombre : u.nombre.split(' ')[0])}</h1><p>${fdateL(TODAY)}</p></div></div>
  <div class="kpis">
    <div class="kpi"><span><i class="ph ph-calendar-dots"></i>Citas de hoy</span><b>${activas.length}</b><small>${hoy.length - activas.length} canceladas</small></div>
    <div class="kpi"><span><i class="ph ph-check-circle"></i>Confirmadas</span><b>${activas.length ? Math.round(conf / activas.length * 100) : 0}%</b><small>${conf} de ${activas.length} por WhatsApp o recepción</small></div>
    ${u.rol === 'Doctor' ? `<div class="kpi"><span><i class="ph ph-flask"></i>Laboratorio</span><b>${labHoy.length}</b><small>trabajos por llegar en 2 días</small></div>` : `<div class="kpi"><span><i class="ph ph-cash-register"></i>Cobrado hoy</span><b class="num">${money(ing)}</b><small>${S.pagos.filter(p => p.fecha === TODAY).length} pagos</small></div>`}
    <div class="kpi"><span><i class="ph ph-wallet"></i>Saldo por cobrar</span><b class="num">${money(porCobrar)}</b><small>en cuentas de pacientes</small></div>
  </div>
  <div class="grid g-main">
    <div class="card"><h2><i class="ph ph-clock"></i>Pacientes de hoy<a class="btn sm r" href="#/agenda">Ver agenda</a></h2>
      ${hoy.length ? `<div class="twrap" style="border:0"><table><thead><tr><th>Hora</th><th>Paciente</th><th>Doctor</th><th>Estado</th><th></th></tr></thead><tbody>
      ${hoy.map(c => `<tr class="click" data-act="verCita" data-id="${c.id}"><td class="num"><b>${c.hora}</b></td><td>${who(pac(c.pacienteId), esc(c.motivo))}</td><td>${esc(doc(c.doctorId).nombre)}</td><td>${estChip(c.estado)} ${c.origen === 'web' ? chip('Web', 'info') : ''}</td><td class="r">${c.estado === 'confirmada' || c.estado === 'pendiente' ? `<button class="btn sm" data-act="estado" data-id="${c.id}" data-e="ensala">Llegó</button>` : c.estado === 'ensala' ? `<button class="btn sm" data-act="estado" data-id="${c.id}" data-e="atendida">Terminar</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : empty('ph-coffee', 'No hay citas para hoy.')}
    </div>
    <div style="display:grid;gap:18px;align-content:start">
      <div class="card"><h2><i class="ph ph-globe"></i>Desde la web<span class="chip info r">${web.length + S.solicitudes.length}</span></h2>
        ${web.length + S.solicitudes.length ? `<div class="list">${web.slice(-4).reverse().map(c => `<div class="li click" data-act="verCita" data-id="${c.id}" style="cursor:pointer">${who(pac(c.pacienteId), `${fdate(c.fecha)} ${c.hora} · ${esc(c.motivo)}`)}<span class="grow"></span>${estChip(c.estado)}</div>`).join('')}
        ${S.solicitudes.slice(0, 3).map(s => `<div class="li">${who(pac(s.pacienteId), 'Pide que lo llamen · ' + esc(s.motivo))}<span class="grow"></span><button class="btn sm" data-act="asignar" data-id="${s.id}">Dar hora</button></div>`).join('')}</div>`
        : empty('ph-globe', 'Las reservas hechas en la web aparecen aquí.<br><a href="../#reserva" target="_blank" rel="noopener">Probar una reserva en la web</a>')}
      </div>
      ${u.rol !== 'Doctor' ? `<div class="card"><h2><i class="ph ph-cake"></i>Cumpleaños de la semana</h2>
        ${cumple.length ? `<div class="list">${cumple.map(p => { const d = daysToBirthday(p.nac), sent = S.cupones.some(c => c.pacienteId === p.id && !c.usado); return `<div class="li">${who(p, d === 0 ? 'Hoy cumple ' + age(p.nac) : `En ${d} día${d > 1 ? 's' : ''}`)}<span class="grow"></span>${sent ? chip('Cupón enviado', 'ok') : `<button class="btn sm" data-act="cupon" data-id="${p.id}"><i class="ph ph-gift"></i>Enviar cupón</button>`}</div>`; }).join('')}</div>` : empty('ph-cake', 'Nadie cumple años esta semana.')}
      </div>` : ''}
      <div class="card"><h2><i class="ph ph-bell"></i>Avisos</h2><div class="list">
        ${bajos.map(i => `<div class="li"><i class="ph ph-warning" style="color:var(--warn)"></i><span class="grow">Stock bajo: ${esc(i.nombre)} <small>(${i.stock} ${i.unidad})</small></span></div>`).join('')}
        ${labHoy.map(l => `<div class="li"><i class="ph ph-flask" style="color:var(--info)"></i><span class="grow">${esc(l.trabajo)} <small>${l.estado === 'recibido' ? 'ya llegó del laboratorio' : 'llega el ' + fdate(l.entrega)}</small></span></div>`).join('')}
        ${!bajos.length && !labHoy.length ? empty('ph-check', 'Todo en orden.') : ''}
      </div></div>
    </div>
  </div>`;
}

/* ---------- Agenda ---------- */
function vAgenda() {
  const day = ui.agDay;
  const docs = ui.agDoc === 'todos' ? DOCTORES : [doc(ui.agDoc)];
  const wk0 = addDays(day, -((parse(day).getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(wk0, i));
  const rows = (A_END - A_START) / SLOT, rh = 40;
  const citas = S.citas.filter(c => c.fecha === day && docs.some(d => d.id === c.doctorId));
  const cols = docs.map(d => {
    const cells = Array.from({ length: rows }, (_, i) => { const m = A_START + i * SLOT; return `<div class="ag-c ${isOpen(day, m) ? '' : 'off'}" style="height:${rh}px" ${isOpen(day, m) ? `data-act="nuevaCita" data-f="${day}" data-h="${toH(m)}" data-d="${d.id}" title="Agendar ${toH(m)}"` : ''}></div>`; }).join('');
    const cs = citas.filter(c => c.doctorId === d.id).map(c => { const p = pac(c.pacienteId); const top = (toMin(c.hora) - A_START) / SLOT * rh;
      return `<div class="cita st-${c.estado}" style="top:${top + 2}px;height:${c.dur / SLOT * rh - 4}px;left:4px;right:4px" data-act="verCita" data-id="${c.id}">${c.origen === 'web' ? '<i class="ph ph-globe tag" title="Reservada en la web"></i>' : ''}<b>${c.hora} ${esc(p.nombre)}</b><small>${esc(c.motivo)}</small></div>`; }).join('');
    return `<div style="position:relative">${cells}${cs}</div>`;
  }).join('');
  const nowLine = day === TODAY && nowMin() > A_START && nowMin() < A_END ? `<div style="position:absolute;left:56px;right:0;top:${(nowMin() - A_START) / SLOT * rh + 45}px;border-top:2px solid var(--bad);z-index:2;pointer-events:none"></div>` : '';
  const load = f => S.citas.filter(c => c.fecha === f && c.estado !== 'cancelada' && docs.some(d => d.id === c.doctorId)).length;
  const maxLoad = Math.max(...week.map(load), 1);
  return `<div class="page-h"><div><h1>Agenda</h1><p>${fdateL(day)}${parse(day).getDay() === 0 ? ' · la clínica no atiende' : ''}</p></div><span class="sp"></span>
    <div class="seg" role="tablist" aria-label="Doctor"><button class="${ui.agDoc === 'todos' ? 'on' : ''}" data-act="agDoc" data-d="todos">Todos</button>${DOCTORES.map(d => `<button class="${ui.agDoc === d.id ? 'on' : ''}" data-act="agDoc" data-d="${d.id}">${esc(d.nombre.split(' ').slice(0, 2).join(' '))}</button>`).join('')}</div>
    <button class="btn" data-act="agMove" data-n="-7" aria-label="Semana anterior"><i class="ph ph-caret-left"></i></button><button class="btn" data-act="agGo" data-f="${TODAY}">Hoy</button><button class="btn" data-act="agMove" data-n="7" aria-label="Semana siguiente"><i class="ph ph-caret-right"></i></button>
    <input type="date" class="btn" value="${day}" data-change="agDate" aria-label="Ir a fecha"></div>
  <div class="week">${week.map(f => `<button class="wd ${f === day ? 'on' : ''}" data-act="agGo" data-f="${f}"><small>${fdate(f, { weekday: 'short' })}</small><b class="num">${parse(f).getDate()}</b><small>${load(f)} citas</small><span class="load"><span style="width:${load(f) / maxLoad * 100}%"></span></span></button>`).join('')}</div>
  ${S.solicitudes.length ? `<div class="card" style="flex-direction:row;align-items:center;flex-wrap:wrap;background:var(--info-soft);border-color:transparent"><i class="ph ph-globe" style="color:var(--info)"></i><b>${S.solicitudes.length} solicitud${S.solicitudes.length > 1 ? 'es' : ''} desde la web sin horario</b>${S.solicitudes.map(s => `<button class="btn sm" data-act="asignar" data-id="${s.id}">${esc(pac(s.pacienteId).nombre)} · Dar hora</button>`).join('')}</div>` : ''}
  <div class="legend">${Object.entries(ESTADOS).map(([k, v]) => `<span><i class="st-${k}"></i>${v}</span>`).join('')}<span><i class="ph ph-globe"></i> Reservada en la web</span><span class="muted">Toca un espacio libre para agendar.</span></div>
  <div class="ag-wrap"><div class="ag" style="grid-template-columns:56px repeat(${docs.length},minmax(200px,1fr))">
    <div class="ag-h" style="border-left:0"></div>${docs.map(d => `<div class="ag-h"><i class="dot" style="background:${d.color}"></i><span>${esc(d.nombre)}<small>${esc(d.sillon)} · ${esc(d.esp)}</small></span></div>`).join('')}
    <div>${Array.from({ length: rows }, (_, i) => `<div class="ag-t" style="height:${rh}px">${i % 2 ? '' : toH(A_START + i * SLOT)}</div>`).join('')}</div>${cols}${nowLine}
  </div></div>`;
}

function citaForm(c, preset = {}) {
  const p = c ? pac(c.pacienteId) : preset.pacienteId ? pac(preset.pacienteId) : null;
  const f = c?.fecha || preset.f || ui.agDay, d = c?.doctorId || preset.d || (ui.agDoc !== 'todos' ? ui.agDoc : 'd1');
  return `<div class="f"><label for="cp">Paciente</label><input id="cp" list="plist" value="${p ? esc(p.nombre) : ''}" placeholder="Escribe el nombre o elige uno" autocomplete="off"><datalist id="plist">${S.pacientes.map(x => `<option value="${esc(x.nombre)}">`).join('')}</datalist><span class="muted" style="font-size:12px">Si no existe, se crea como paciente nuevo.</span></div>
  <div class="frow"><div class="f"><label for="ctel">Celular</label><input id="ctel" inputmode="tel" value="${p ? esc(p.tel) : ''}"></div>
  <div class="f"><label for="ct">Tratamiento</label><select id="ct">${S.tarifario.map(t => `<option value="${t.id}" ${(c?.tratId || preset.t) === t.id ? 'selected' : ''}>${esc(t.nombre)} (${t.dur} min)</option>`).join('')}</select></div></div>
  <div class="frow"><div class="f"><label for="cd">Doctor</label><select id="cd">${DOCTORES.map(x => `<option value="${x.id}" ${x.id === d ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
  <div class="f"><label for="cf">Fecha</label><input id="cf" type="date" value="${f}" min="${TODAY}"></div></div>
  <div class="f"><label for="ch">Hora disponible</label><select id="ch"></select><span class="err" id="cerr"></span></div>`;
}
function wireCitaForm(c, presetH) {
  const fill = () => {
    const f = val('#cf'), d = val('#cd'), t = trat(val('#ct'));
    const opts = [];
    for (let m = A_START; m < A_END; m += SLOT) if (slotFree(f, d, toH(m), t.dur, c?.id) && !(f === TODAY && m < nowMin())) opts.push(toH(m));
    const cur = presetH || c?.hora;
    modalEl.querySelector('#ch').innerHTML = opts.length ? opts.map(h => `<option ${h === cur ? 'selected' : ''}>${h}</option>`).join('') : '<option value="">Sin horarios libres ese día</option>';
  };
  ['#cf', '#cd', '#ct'].forEach(s => modalEl.querySelector(s).addEventListener('change', fill));
  modalEl.querySelector('#cp').addEventListener('change', () => { const p = S.pacientes.find(x => x.nombre === val('#cp')); if (p) modalEl.querySelector('#ctel').value = p.tel; });
  fill();
}
function saveCita(c, extra = {}) {
  const nombre = val('#cp'), h = val('#ch'), t = trat(val('#ct'));
  if (!nombre) return modalEl.querySelector('#cerr').textContent = 'Escribe el nombre del paciente.';
  if (!h) return modalEl.querySelector('#cerr').textContent = 'Elige un día con horarios libres.';
  let p = S.pacientes.find(x => x.nombre.toLowerCase() === nombre.toLowerCase());
  if (!p) { p = { id: uid('p'), nombre, tel: digits(val('#ctel')), dni: '', nac: '', alergia: '', ficha: String(1000 + S.pacientes.length), email: '', desde: TODAY, origen: 'recepcion' }; S.pacientes.push(p); }
  const data = { fecha: val('#cf'), hora: h, dur: t.dur, doctorId: val('#cd'), pacienteId: p.id, tratId: t.id, motivo: t.nombre };
  if (c) Object.assign(c, data); else S.citas.push({ id: uid('c'), estado: 'pendiente', origen: 'recepcion', ...data, ...extra });
  save(); closeModal(); ui.agDay = data.fecha; render();
  toast(c ? 'Cita reprogramada.' : `Cita agendada: ${p.nombre}, ${fdate(data.fecha)} ${h}.`);
}
function verCita(c) {
  const p = pac(c.pacienteId), d = doc(c.doctorId);
  const msgs = S.mensajes.filter(m => m.pacienteId === p.id).slice(0, 3);
  modal(`Cita de ${esc(p.nombre)}`, `<div style="display:flex;gap:8px;flex-wrap:wrap">${estChip(c.estado)}${c.origen === 'web' ? chip('Reservada en la web', 'info') : chip('Agendada en recepción', 'mut')}${p.alergia ? chip('Alergia: ' + p.alergia, 'bad') : ''}</div>
    <dl class="kv"><dt>Fecha</dt><dd>${fdateL(c.fecha)}</dd><dt>Hora</dt><dd>${c.hora} a ${toH(toMin(c.hora) + c.dur)}</dd><dt>Doctor</dt><dd>${esc(d.nombre)}</dd><dt>Sillón</dt><dd>${esc(d.sillon)}</dd><dt>Tratamiento</dt><dd>${esc(c.motivo)}</dd><dt>Precio de lista</dt><dd class="num">${money(trat(c.tratId)?.precio)}</dd><dt>Celular</dt><dd>${esc(p.tel)}</dd><dt>Saldo del paciente</dt><dd class="num">${money(saldo(p.id))}</dd></dl>
    <div><b style="font-size:13px">Estado de la cita</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${Object.entries(ESTADOS).map(([k, v]) => `<button class="btn sm ${c.estado === k ? 'pri' : ''}" data-act="estado" data-id="${c.id}" data-e="${k}" data-keep="1">${v}</button>`).join('')}</div></div>
    ${msgs.length ? `<div class="wa-thread">${msgs.slice().reverse().map(m => `<div class="wa-msg out">${esc(m.texto)}<small>${fdate(m.fecha)} ${m.hora} · ${m.estado}</small></div>${m.resp ? `<div class="wa-msg">${esc(m.resp)}</div>` : ''}`).join('')}</div>` : ''}`,
    `<a class="btn" href="#/pacientes/${p.id}" data-act="close">Abrir ficha</a>${c.estado !== 'atendida' && c.estado !== 'cancelada' ? `<button class="btn" data-act="reprogramar" data-id="${c.id}">Reprogramar</button><button class="btn wa" data-act="recordar" data-id="${c.id}"><i class="ph ph-whatsapp-logo"></i>Enviar recordatorio</button>` : can('caja') ? `<button class="btn pri" data-act="cobrar" data-p="${p.id}" data-t="${c.tratId}">Cobrar</button>` : ''}`);
}

/* ---------- Pacientes ---------- */
function vPacientes() {
  const q = ui.q.toLowerCase();
  const list = S.pacientes.filter(p => !q || (p.nombre + p.dni + p.tel).toLowerCase().includes(q));
  const prox = pid => S.citas.filter(c => c.pacienteId === pid && c.fecha >= TODAY && c.estado !== 'cancelada').sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];
  const ult = pid => S.citas.filter(c => c.pacienteId === pid && c.estado === 'atendida').map(c => c.fecha).sort().pop();
  return `<div class="page-h"><div><h1>Pacientes</h1><p>${S.pacientes.length} pacientes registrados</p></div><span class="sp"></span><div class="search" style="max-width:320px"><i class="ph ph-funnel"></i><input value="${esc(ui.q)}" data-input="filtroP" placeholder="Filtrar la lista" aria-label="Filtrar pacientes"></div></div>
  <div class="twrap"><table><thead><tr><th>Paciente</th><th>DNI</th><th>Celular</th><th>Última visita</th><th>Próxima cita</th><th class="r">Saldo</th></tr></thead><tbody>
  ${list.map(p => { const n = prox(p.id), s = saldo(p.id), u = ult(p.id); return `<tr class="click" data-act="go" data-h="#/pacientes/${p.id}"><td>${who(p, `Ficha ${p.ficha}${p.origen === 'web' ? ' · llegó por la web' : ''}`)}</td><td class="num">${esc(p.dni) || '<span class="muted">Falta</span>'}</td><td class="num">${esc(p.tel)}</td><td>${u ? fdate(u, { day: 'numeric', month: 'short', year: 'numeric' }) : '<span class="muted">Sin visitas</span>'}</td><td>${n ? `${fdate(n.fecha)} ${n.hora}` : '<span class="muted">Sin cita</span>'}</td><td class="r num">${s > 0 ? `<b style="color:var(--warn)">${money(s)}</b>` : money(0)}</td></tr>`; }).join('') || `<tr><td colspan="6">${empty('ph-magnifying-glass', 'Ningún paciente coincide con el filtro.')}</td></tr>`}
  </tbody></table></div>`;
}

function vPaciente(id) {
  const p = S.pacientes.find(x => x.id === id);
  if (!p) return empty('ph-user', 'Paciente no encontrado. <a href="#/pacientes">Volver a la lista</a>');
  const tabs = [['resumen', 'Resumen'], ['odontograma', 'Odontograma'], ['plan', 'Plan y presupuesto'], ['cuenta', 'Cuenta corriente'], ['evolucion', 'Evolución'], ['recetas', 'Recetas'], ['consentimientos', 'Consentimientos']];
  const s = saldo(p.id), dc = p.nac ? daysToBirthday(p.nac) : 99;
  const T = { resumen: tResumen, odontograma: tOdonto, plan: tPlan, cuenta: tCuenta, evolucion: tEvol, recetas: tRecetas, consentimientos: tConsent };
  if (!T[ui.tab]) ui.tab = 'resumen';
  return `<a href="#/pacientes" class="muted" style="font-size:13px;text-decoration:none"><i class="ph ph-arrow-left"></i> Pacientes</a>
  <div class="phead"><span class="pav">${initials(p.nombre)}</span><div><h1>${esc(p.nombre)}</h1><div class="meta"><span>Ficha ${esc(p.ficha)}</span>${p.nac ? `<span>${age(p.nac)} años</span>` : ''}<span>DNI ${esc(p.dni) || 'por completar'}</span><span>Paciente desde ${fdate(p.desde, { month: 'short', year: 'numeric' })}</span></div></div><span class="sp"></span>
  ${p.alergia ? chip('Alergia: ' + p.alergia, 'bad') : ''}${dc <= 7 ? chip(dc === 0 ? 'Hoy es su cumpleaños' : `Cumpleaños en ${dc} días`, 'br') : ''}${s > 0 ? chip('Saldo ' + money(s), 'warn') : ''}
  <button class="btn" data-act="editPaciente" data-id="${p.id}"><i class="ph ph-pencil-simple"></i>Editar</button><a class="btn wa" href="https://wa.me/51${digits(p.tel).slice(-9)}" target="_blank" rel="noopener"><i class="ph ph-whatsapp-logo"></i>WhatsApp</a>${can('caja') ? `<button class="btn pri" data-act="cobrar" data-p="${p.id}">Cobrar</button>` : ''}</div>
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${ui.tab === k ? 'on' : ''}" role="tab" aria-selected="${ui.tab === k}" data-act="tab" data-t="${k}">${l}</button>`).join('')}</div>
  <div id="tabv">${T[ui.tab](p)}</div>`;
}
function tResumen(p) {
  const cs = S.citas.filter(c => c.pacienteId === p.id).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  const prox = cs.filter(c => c.fecha >= TODAY && c.estado !== 'cancelada' && c.estado !== 'atendida').pop();
  const msgs = S.mensajes.filter(m => m.pacienteId === p.id);
  return `<div class="grid g-main"><div class="grid" style="align-content:start">
    <div class="card"><h2><i class="ph ph-calendar-check"></i>Próxima cita${prox ? `<button class="btn sm r" data-act="verCita" data-id="${prox.id}">Ver</button>` : `<button class="btn sm r" data-act="nuevaCita" data-p="${p.id}">Agendar</button>`}</h2>${prox ? `<div class="li" style="border:0">${estChip(prox.estado)}<span class="grow"><b>${fdateL(prox.fecha)}, ${prox.hora}</b><br><small>${esc(prox.motivo)} con ${esc(doc(prox.doctorId).nombre)}</small></span></div>` : '<p class="muted" style="margin:0">Sin citas programadas.</p>'}</div>
    <div class="card"><h2><i class="ph ph-clock-counter-clockwise"></i>Historial de citas</h2>${cs.length ? `<div class="list">${cs.slice(0, 8).map(c => `<div class="li click" data-act="verCita" data-id="${c.id}" style="cursor:pointer"><span class="num" style="width:110px">${fdate(c.fecha, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span class="grow">${esc(c.motivo)}<br><small>${esc(doc(c.doctorId).nombre)}</small></span>${estChip(c.estado)}</div>`).join('')}</div>` : empty('ph-calendar', 'Aún no tiene citas.')}</div>
  </div><div class="grid" style="align-content:start">
    <div class="card"><h2><i class="ph ph-identification-card"></i>Datos</h2><dl class="kv"><dt>Celular</dt><dd>${esc(p.tel)}</dd><dt>Correo</dt><dd>${esc(p.email) || '-'}</dd><dt>Nacimiento</dt><dd>${p.nac ? fdate(p.nac, { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</dd><dt>Alergias</dt><dd>${esc(p.alergia) || 'Ninguna'}</dd><dt>Saldo</dt><dd class="num">${money(saldo(p.id))}</dd></dl></div>
    <div class="card"><h2><i class="ph ph-whatsapp-logo" style="color:#1F8A5B"></i>WhatsApp</h2>${msgs.length ? `<div class="wa-thread">${msgs.slice(0, 5).reverse().map(m => `<div class="wa-msg out">${esc(m.texto)}<small>${fdate(m.fecha)} ${m.hora} · ${m.estado}</small></div>${m.resp ? `<div class="wa-msg">${esc(m.resp)}</div>` : ''}`).join('')}</div>` : '<p class="muted" style="margin:0">Sin mensajes todavía.</p>'}</div>
  </div></div>`;
}

const FACE_C = { caries: '#C0263D', restauracion: '#4458C0', sellante: '#1F8A5B' };
const TOOLS = [['caries', 'Caries', '#C0263D'], ['restauracion', 'Restauración', '#4458C0'], ['sellante', 'Sellante', '#1F8A5B'], ['corona', 'Corona', '#4458C0'], ['endodoncia', 'Endodoncia', '#C0263D'], ['implante', 'Implante', '#1F8A5B'], ['extraccion', 'Extracción indicada', '#C0263D'], ['ausente', 'Ausente', '#5A6380'], ['sano', 'Borrar', '#E3E7F2']];
function tOdonto(p) {
  const o = S.odontos[p.id] || {};
  const up = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], lo = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const tooth = (n, x, y, numY) => {
    const t = o[n] || {}, s = 36, i = 11, f = k => t[k] ? FACE_C[t[k]] : 'var(--surface)';
    const poly = (k, pts) => `<polygon class="face" points="${pts}" fill="${f(k)}" stroke="var(--muted)" stroke-width="1" data-act="odo" data-n="${n}" data-f="${k}"/>`;
    return `<g transform="translate(${x},${y})"><text x="${s / 2}" y="${numY}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:var(--muted)">${n}</text>
      ${poly('v', `0,0 ${s},0 ${s - i},${i} ${i},${i}`)}${poly('d', `${s},0 ${s},${s} ${s - i},${s - i} ${s - i},${i}`)}${poly('l', `${s},${s} 0,${s} ${i},${s - i} ${s - i},${s - i}`)}${poly('m', `0,${s} 0,0 ${i},${i} ${i},${s - i}`)}${poly('o', `${i},${i} ${s - i},${i} ${s - i},${s - i} ${i},${s - i}`)}
      ${t.ausente ? `<path d="M-2,-2 L${s + 2},${s + 2} M${s + 2},-2 L-2,${s + 2}" stroke="var(--muted)" stroke-width="3" pointer-events="none"/>` : ''}
      ${t.extraccion ? `<path d="M-2,-2 L${s + 2},${s + 2} M${s + 2},-2 L-2,${s + 2}" stroke="#C0263D" stroke-width="3" pointer-events="none"/>` : ''}
      ${t.corona ? `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 + 4}" fill="none" stroke="#4458C0" stroke-width="2.5" pointer-events="none"/>` : ''}
      ${t.implante ? `<rect x="-4" y="-4" width="${s + 8}" height="${s + 8}" rx="4" fill="none" stroke="#1F8A5B" stroke-width="2.5" pointer-events="none"/><text x="${s / 2}" y="${s / 2 + 4}" text-anchor="middle" style="font-size:12px;font-weight:700;fill:#1F8A5B" pointer-events="none">IM</text>` : ''}
      ${t.endodoncia ? `<path d="M${s / 2},${numY < 0 ? s + 4 : -4} V${numY < 0 ? s + 16 : -16}" stroke="#C0263D" stroke-width="3" pointer-events="none"/>` : ''}</g>`;
  };
  const W = 46, gap = 24, x = i => 14 + i * W + (i >= 8 ? gap : 0);
  const svg = `<svg id="odo" viewBox="0 0 ${16 * W + gap + 28} 190" role="img" aria-label="Odontograma">
    ${up.map((n, i) => tooth(n, x(i), 30, -10)).join('')}${lo.map((n, i) => tooth(n, x(i), 120, 52)).join('')}
    <line x1="${x(8) - gap / 2 - 5}" x2="${x(8) - gap / 2 - 5}" y1="8" y2="186" stroke="var(--line)" stroke-dasharray="4 4"/><line x1="0" x2="${16 * W + gap + 28}" y1="97" y2="97" stroke="var(--line)" stroke-dasharray="4 4"/></svg>`;
  const hallazgos = Object.entries(o).flatMap(([n, t]) => Object.entries(t).map(([k, v]) => v === 1 ? `${TOOLS.find(x => x[0] === k)?.[1]} en pieza ${n}` : `${TOOLS.find(x => x[0] === v)?.[1]} en cara ${({ v: 'vestibular', d: 'distal', l: 'lingual', m: 'mesial', o: 'oclusal' })[k]} de la pieza ${n}`));
  return `<div class="grid g-main"><div class="card"><h2>Odontograma adulto<span class="muted r" style="font-weight:500;font-size:12px">Elige un hallazgo y toca la cara o la pieza</span></h2>
    <div class="odo-tools">${TOOLS.map(([k, l, c]) => `<button class="${ui.odoTool === k ? 'on' : ''}" data-act="odoTool" data-k="${k}"><i style="background:${c}"></i>${l}</button>`).join('')}</div>
    <div style="overflow-x:auto"><div style="min-width:640px">${svg}</div></div></div>
    <div class="card"><h2>Hallazgos<span class="chip mut r">${hallazgos.length}</span></h2>${hallazgos.length ? `<div class="list">${hallazgos.map(h => `<div class="li"><i class="ph ph-tooth" style="color:var(--brand-2)"></i><span class="grow">${esc(h)}</span></div>`).join('')}</div>` : empty('ph-tooth', 'Sin hallazgos registrados.')}
    <button class="btn" data-act="tab" data-t="plan"><i class="ph ph-list-checks"></i>Pasar a plan de tratamiento</button></div></div>`;
}
function tPlan(p) {
  const items = S.planes[p.id] || [];
  const tot = items.reduce((a, i) => a + i.precio, 0), hecho = items.filter(i => i.estado === 'terminado').reduce((a, i) => a + i.precio, 0);
  const E = { pendiente: ['Pendiente', 'mut'], proceso: ['En proceso', 'info'], terminado: ['Terminado', 'ok'] };
  return `<div class="grid g-main"><div class="twrap"><table><thead><tr><th>Tratamiento</th><th>Pieza</th><th>Estado</th><th class="r">Precio</th><th></th></tr></thead><tbody>
    ${items.map(i => `<tr><td>${esc(trat(i.tratId).nombre)}</td><td class="num">${esc(i.diente) || '-'}</td><td><button class="btn sm" data-act="planEst" data-p="${p.id}" data-id="${i.id}" title="Cambiar estado">${chip(E[i.estado][0], E[i.estado][1])}</button></td><td class="r num">${money(i.precio)}</td><td class="r"><button class="btn sm ghost danger" data-act="planDel" data-p="${p.id}" data-id="${i.id}" aria-label="Quitar"><i class="ph ph-trash"></i></button></td></tr>`).join('') || `<tr><td colspan="5">${empty('ph-list-checks', 'Agrega tratamientos para armar el presupuesto.')}</td></tr>`}
    </tbody></table></div>
    <div class="grid" style="align-content:start"><div class="card"><h2>Agregar tratamiento</h2>
      <div class="f"><label for="pt">Tratamiento</label><select id="pt">${S.tarifario.map(t => `<option value="${t.id}">${esc(t.nombre)} · ${money(t.precio)}</option>`).join('')}</select></div>
      <div class="frow"><div class="f"><label for="pd">Pieza</label><input id="pd" placeholder="Ej. 36" inputmode="numeric"></div><div class="f"><label for="pp">Precio</label><input id="pp" inputmode="decimal" placeholder="Precio de lista"></div></div>
      <button class="btn pri" data-act="planAdd" data-p="${p.id}"><i class="ph ph-plus"></i>Agregar</button></div>
      <div class="card"><h2>Presupuesto</h2><dl class="kv"><dt>Total del plan</dt><dd class="num">${money(tot)}</dd><dt>Realizado</dt><dd class="num">${money(hecho)}</dd><dt>Pagado</dt><dd class="num">${money(S.pagos.filter(x => x.pacienteId === p.id).reduce((a, x) => a + x.monto, 0))}</dd></dl>
      <div class="bar"><span style="width:${tot ? hecho / tot * 100 : 0}%"></span></div>
      <button class="btn" data-act="presupuesto" data-p="${p.id}" ${items.length ? '' : 'disabled'}><i class="ph ph-printer"></i>Imprimir presupuesto</button></div></div></div>`;
}
function tCuenta(p) {
  const mov = [...S.cargos.filter(c => c.pacienteId === p.id).map(c => ({ ...c, t: 'c' })), ...S.pagos.filter(c => c.pacienteId === p.id).map(c => ({ ...c, t: 'p' }))].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.t === 'c' ? -1 : 1));
  let run = 0;
  const rows = mov.map(m => { run += m.t === 'c' ? m.monto : -m.monto; return `<tr><td class="num">${fdate(m.fecha, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${esc(m.concepto)}${m.t === 'p' ? `<br><small class="muted">${esc(m.metodo)} · ${esc(m.comprobanteId || '')}</small>` : ''}</td><td class="r num">${m.t === 'c' ? money(m.monto) : ''}</td><td class="r num" style="color:var(--ok)">${m.t === 'p' ? money(m.monto) : ''}</td><td class="r num"><b>${money(run)}</b></td></tr>`; });
  return `<div class="twrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Cargo</th><th class="r">Abono</th><th class="r">Saldo</th></tr></thead><tbody>${rows.reverse().join('') || `<tr><td colspan="5">${empty('ph-wallet', 'Sin movimientos.')}</td></tr>`}</tbody></table></div>`;
}
function tEvol(p) {
  const ev = S.evoluciones.filter(e => e.pacienteId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return `<div class="grid g-main"><div class="card"><h2>Notas clínicas</h2>${ev.length ? `<div class="list">${ev.map(e => `<div class="li" style="align-items:flex-start"><span class="av">${initials(doc(e.doctorId).nombre)}</span><span class="grow"><b>${fdateL(e.fecha)}</b> <small>${esc(doc(e.doctorId).nombre)}</small><br>${esc(e.texto)}</span></div>`).join('')}</div>` : empty('ph-notepad', 'Sin notas todavía.')}</div>
  <div class="card"><h2>Nueva nota</h2><div class="f"><label for="evt">Lo que se hizo hoy</label><textarea id="evt" rows="6"></textarea></div><button class="btn pri" data-act="evolAdd" data-p="${p.id}">Guardar nota</button></div></div>`;
}
function tRecetas(p) {
  const rs = S.recetas.filter(r => r.pacienteId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return `<div class="page-h"><span class="sp"></span><button class="btn pri" data-act="receta" data-p="${p.id}"><i class="ph ph-prescription"></i>Nueva receta</button></div>
  ${rs.length ? `<div class="grid g2">${rs.map(r => `<div class="card"><h2>${fdateL(r.fecha)}<button class="btn sm r" data-act="verReceta" data-id="${r.id}"><i class="ph ph-printer"></i>Imprimir</button></h2><div class="list">${r.items.map(i => `<div class="li"><i class="ph ph-pill" style="color:var(--brand-2)"></i><span class="grow"><b>${esc(i.med)}</b><br><small>${esc(i.dosis)} ${esc(i.frec)} por ${i.dias} días</small></span></div>`).join('')}</div>${r.ind ? `<p class="muted" style="margin:0">${esc(r.ind)}</p>` : ''}</div>`).join('')}</div>` : `<div class="card">${empty('ph-prescription', 'Sin recetas emitidas.')}</div>`}`;
}
function tConsent(p) {
  const ks = S.consentimientos.filter(k => k.pacienteId === p.id);
  return `<div class="page-h"><span class="sp"></span><select class="btn" id="ktipo" aria-label="Tipo de consentimiento">${['Tratamiento de endodoncia', 'Extracción dental', 'Colocación de implante dental', 'Ortodoncia', 'Blanqueamiento dental', 'Uso de datos personales (Ley 29733)'].map(t => `<option>${t}</option>`).join('')}</select><button class="btn pri" data-act="consentAdd" data-p="${p.id}"><i class="ph ph-plus"></i>Generar consentimiento</button></div>
  <div class="twrap"><table><thead><tr><th>Documento</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>${ks.map(k => `<tr><td><i class="ph ph-file-text"></i> ${esc(k.tipo)}</td><td>${fdate(k.fecha, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${k.firmado ? chip('Firmado en tablet', 'ok') : chip('Por firmar', 'warn')}</td><td class="r">${k.firmado ? '' : `<button class="btn sm" data-act="firmar" data-id="${k.id}"><i class="ph ph-signature"></i>Firmar</button>`}</td></tr>`).join('') || `<tr><td colspan="4">${empty('ph-file-text', 'Sin consentimientos.')}</td></tr>`}</tbody></table></div>`;
}

function pacienteForm(p = {}) {
  return `<div class="f"><label for="pn">Nombres y apellidos</label><input id="pn" value="${esc(p.nombre)}"></div>
  <div class="frow"><div class="f"><label for="pdni">DNI</label><input id="pdni" inputmode="numeric" maxlength="8" value="${esc(p.dni)}"></div><div class="f"><label for="ptel">Celular</label><input id="ptel" inputmode="tel" value="${esc(p.tel)}"></div></div>
  <div class="frow"><div class="f"><label for="pnac">Fecha de nacimiento</label><input id="pnac" type="date" value="${esc(p.nac)}"></div><div class="f"><label for="pem">Correo</label><input id="pem" type="email" value="${esc(p.email)}"></div></div>
  <div class="f"><label for="pal">Alergias</label><input id="pal" value="${esc(p.alergia)}" placeholder="Ej. penicilina, látex"></div><span class="err" id="perr"></span>`;
}

/* ---------- Caja ---------- */
function vCaja() {
  const hoy = S.pagos.filter(p => p.fecha === TODAY).sort((a, b) => b.hora.localeCompare(a.hora));
  const tot = hoy.reduce((a, p) => a + p.monto, 0), egr = S.caja.egresos.filter(e => e.fecha === TODAY).reduce((a, e) => a + e.monto, 0);
  const byM = METODOS.map(m => ({ l: m, v: hoy.filter(p => p.metodo === m).reduce((a, p) => a + p.monto, 0) }));
  const ef = byM[0].v;
  return `<div class="page-h"><div><h1>Caja y cobros</h1><p>${fdateL(TODAY)} · ${S.caja.cerrada ? 'caja cerrada' : 'caja abierta desde las 08:30 por Rosa Mendoza'}</p></div><span class="sp"></span>
    <button class="btn" data-act="egreso"><i class="ph ph-arrow-up-right"></i>Registrar gasto</button><button class="btn" data-act="cierre"><i class="ph ph-lock-simple"></i>${S.caja.cerrada ? 'Ver cierre' : 'Cerrar caja'}</button><button class="btn pri" data-act="cobrar"><i class="ph ph-plus"></i>Nuevo cobro</button></div>
  <div class="kpis"><div class="kpi"><span>Cobrado hoy</span><b class="num">${money(tot)}</b><small>${hoy.length} pagos</small></div><div class="kpi"><span>Efectivo en caja</span><b class="num">${money(S.caja.apertura + ef - egr)}</b><small>apertura ${money(S.caja.apertura)} menos gastos</small></div><div class="kpi"><span>Yape y Plin</span><b class="num">${money(byM[1].v + byM[2].v)}</b><small>billeteras digitales</small></div><div class="kpi"><span>Gastos de caja chica</span><b class="num">${money(egr)}</b><small>${S.caja.egresos.filter(e => e.fecha === TODAY).length} movimientos</small></div></div>
  <div class="grid g-main"><div class="twrap"><table><thead><tr><th>Hora</th><th>Paciente</th><th>Concepto</th><th>Método</th><th>Comprobante</th><th class="r">Monto</th></tr></thead><tbody>
    ${hoy.map(p => `<tr><td class="num">${p.hora}</td><td>${esc(pac(p.pacienteId).nombre)}</td><td>${esc(p.concepto)}</td><td>${esc(p.metodo)}</td><td class="num">${esc(p.comprobanteId)}</td><td class="r num"><b>${money(p.monto)}</b></td></tr>`).join('') || `<tr><td colspan="6">${empty('ph-cash-register', 'Todavía no hay cobros hoy.')}</td></tr>`}
    ${S.caja.egresos.filter(e => e.fecha === TODAY).map(e => `<tr><td class="num">${e.hora}</td><td colspan="4"><i class="ph ph-arrow-up-right" style="color:var(--bad)"></i> ${esc(e.concepto)}</td><td class="r num" style="color:var(--bad)">-${money(e.monto)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="card"><h2>Cobrado por método</h2>${hbars(byM, { fmt: money })}</div></div>`;
}
function cobroModal(pid, tid) {
  const p = pid ? pac(pid) : null, t = tid ? trat(tid) : null, s = pid ? saldo(pid) : 0;
  modal('Registrar cobro', `<div class="f"><label for="kp">Paciente</label><input id="kp" list="plist2" value="${p ? esc(p.nombre) : ''}" autocomplete="off"><datalist id="plist2">${S.pacientes.map(x => `<option value="${esc(x.nombre)}">`).join('')}</datalist></div>
    <div class="f"><label for="kc">Concepto</label><select id="kc"><option value="saldo">Abono a cuenta${s > 0 ? ` (saldo ${money(s)})` : ''}</option>${S.tarifario.map(x => `<option value="${x.id}" ${t?.id === x.id ? 'selected' : ''}>${esc(x.nombre)} · ${money(x.precio)}</option>`).join('')}</select></div>
    <div class="frow"><div class="f"><label for="km">Monto (S/)</label><input id="km" inputmode="decimal" value="${t ? t.precio : s > 0 ? s : ''}"></div><div class="f"><label for="kmet">Método</label><select id="kmet">${METODOS.map(m => `<option>${m}</option>`).join('')}</select></div></div>
    <div class="frow"><div class="f"><label for="kcup">Cupón de descuento</label><input id="kcup" placeholder="Opcional" style="text-transform:uppercase"></div><div class="f"><label for="ktip">Comprobante</label><select id="ktip"><option>Boleta</option><option>Factura</option></select></div></div>
    <div class="f" id="rucf" hidden><label for="kruc">RUC</label><input id="kruc" inputmode="numeric" maxlength="11"></div>
    <p class="hint" style="margin:0">El comprobante se firma con el certificado digital de la clínica y se envía directo a SUNAT.</p><span class="err" id="kerr"></span>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="cobroOk"><i class="ph ph-check"></i>Cobrar y emitir</button>`);
  const kc = modalEl.querySelector('#kc');
  kc.onchange = () => { const x = trat(kc.value); modalEl.querySelector('#km').value = x ? x.precio : Math.max(0, saldo(S.pacientes.find(y => y.nombre === val('#kp'))?.id)) || ''; };
  modalEl.querySelector('#ktip').onchange = e => modalEl.querySelector('#rucf').hidden = e.target.value !== 'Factura';
  modalEl.querySelector('#kcup').onchange = e => {
    const c = S.cupones.find(c => c.codigo === e.target.value.trim().toUpperCase() && !c.usado);
    const m = modalEl.querySelector('#km');
    if (c) { m.value = (Number(m.value) * (1 - c.desc / 100)).toFixed(2); toast(`Cupón aplicado: ${c.desc}% de descuento.`, 'ph-gift'); } else if (e.target.value) toast('Ese cupón no existe o ya se usó.', 'ph-warning');
  };
}
function emitir(pago, tipo, ruc, concepto) {
  const pref = tipo === 'Factura' ? 'F001' : 'B001';
  const n = Math.max(0, ...S.comprobantes.filter(c => c.id.startsWith(pref)).map(c => Number(c.id.split('-')[1]))) + 1;
  const comp = { id: `${pref}-${String(n).padStart(6, '0')}`, tipo, fecha: TODAY, pacienteId: pago.pacienteId, total: pago.monto, estado: 'Enviando', concepto, ruc };
  S.comprobantes.push(comp); pago.comprobanteId = comp.id;
  setTimeout(() => { comp.estado = 'Aceptado'; save(); toast(`SUNAT aceptó ${comp.id}.`, 'ph-seal-check'); if (route()[0] === 'facturacion') render(); }, 1800);
  return comp;
}

/* ---------- Facturación ---------- */
function vFacturacion() {
  const list = S.comprobantes.filter(c => ui.facF === 'todos' || c.tipo === ui.facF || c.estado === ui.facF).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const mes = TODAY.slice(0, 7), delMes = S.comprobantes.filter(c => c.fecha.startsWith(mes));
  const venc = addDays(TODAY, 241);
  const E = { Aceptado: 'ok', Pendiente: 'warn', Enviando: 'info', Anulado: 'bad' };
  return `<div class="page-h"><div><h1>Facturación electrónica</h1><p>Boletas y facturas firmadas con el certificado digital de la clínica y enviadas directo a SUNAT</p></div></div>
  <div class="kpis"><div class="kpi"><span>Emitido este mes</span><b class="num">${money(delMes.reduce((a, c) => a + (c.estado === 'Anulado' ? 0 : c.total), 0))}</b><small>${delMes.length} comprobantes</small></div>
  <div class="kpi"><span>Boletas</span><b>${delMes.filter(c => c.tipo === 'Boleta').length}</b><small>serie B001</small></div><div class="kpi"><span>Facturas</span><b>${delMes.filter(c => c.tipo === 'Factura').length}</b><small>serie F001</small></div>
  <div class="kpi"><span><i class="ph ph-certificate"></i>Certificado digital</span><b style="font-size:18px">${chip('Vigente', 'ok')}</b><small>vence el ${fdate(venc, { day: 'numeric', month: 'short', year: 'numeric' })}, lo renueva QH</small></div></div>
  <div class="page-h"><div class="seg">${['todos', 'Boleta', 'Factura', 'Pendiente'].map(f => `<button class="${ui.facF === f ? 'on' : ''}" data-act="facF" data-f="${f}">${f === 'todos' ? 'Todos' : f === 'Pendiente' ? 'Por reenviar' : f + 's'}</button>`).join('')}</div></div>
  <div class="twrap"><table><thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th>Concepto</th><th>Estado SUNAT</th><th class="r">Total</th><th></th></tr></thead><tbody>
  ${list.slice(0, 40).map(c => `<tr><td class="num"><b>${c.id}</b></td><td>${fdate(c.fecha)}</td><td>${esc(pac(c.pacienteId).nombre)}${c.ruc ? `<br><small class="muted">RUC ${c.ruc}</small>` : ''}</td><td>${esc(c.concepto)}</td><td>${chip(c.estado, E[c.estado])}</td><td class="r num">${money(c.total)}</td><td class="r" style="white-space:nowrap">${c.estado === 'Pendiente' ? `<button class="btn sm" data-act="reenviar" data-id="${c.id}">Reenviar</button>` : ''}<button class="btn sm ghost" data-act="verComp" data-id="${c.id}" aria-label="Ver"><i class="ph ph-eye"></i></button></td></tr>`).join('') || `<tr><td colspan="7">${empty('ph-receipt', 'No hay comprobantes con ese filtro.')}</td></tr>`}
  </tbody></table></div>`;
}

/* ---------- Laboratorio ---------- */
function vLab() {
  const cols = [['enviado', 'Enviado', 'ph-paper-plane-tilt'], ['proceso', 'En proceso', 'ph-hourglass'], ['recibido', 'Recibido en clínica', 'ph-package'], ['instalado', 'Instalado', 'ph-check-circle']];
  return `<div class="page-h"><div><h1>Laboratorio</h1><p>Trabajos enviados a laboratorios externos</p></div><span class="sp"></span><button class="btn pri" data-act="labNew"><i class="ph ph-plus"></i>Nueva orden</button></div>
  <div class="kan">${cols.map(([k, l, i], ci) => { const items = S.lab.filter(x => x.estado === k); return `<div class="kcol"><h3><i class="ph ${i}"></i>${l}<span class="chip mut" style="margin-left:auto">${items.length}</span></h3>
    ${items.map(x => { const late = x.entrega < TODAY && ci < 2; return `<div class="kcard"><b>${esc(x.trabajo)}</b><small>${esc(pac(x.pacienteId).nombre)}</small><small>${esc(x.lab)} · ${money(x.costo)}</small><div style="display:flex;align-items:center;gap:6px;margin-top:4px">${late ? chip('Atrasado', 'bad') : chip('Entrega ' + fdate(x.entrega), ci < 2 ? 'mut' : 'ok')}<span class="sp" style="flex:1"></span>${ci < 3 ? `<button class="btn sm" data-act="labNext" data-id="${x.id}">${cols[ci + 1][1].split(' ')[0]} <i class="ph ph-arrow-right"></i></button>` : ''}</div></div>`; }).join('') || '<p class="muted" style="margin:0;font-size:12px">Sin trabajos.</p>'}</div>`; }).join('')}</div>`;
}

/* ---------- Inventario ---------- */
function vInventario() {
  const bajos = S.inventario.filter(i => i.stock < i.min);
  return `<div class="page-h"><div><h1>Inventario</h1><p>${S.inventario.length} insumos · valorizado en ${money(S.inventario.reduce((a, i) => a + i.stock * i.costo, 0))}</p></div><span class="sp"></span>${bajos.length ? chip(bajos.length + ' con stock bajo', 'warn') : ''}<button class="btn pri" data-act="invNew"><i class="ph ph-plus"></i>Nuevo insumo</button></div>
  <div class="twrap"><table><thead><tr><th>Insumo</th><th>Categoría</th><th class="r">Stock</th><th style="width:180px">Nivel</th><th class="r">Costo unit.</th><th></th></tr></thead><tbody>
  ${S.inventario.map(i => { const low = i.stock < i.min; return `<tr><td><b>${esc(i.nombre)}</b></td><td>${esc(i.cat)}</td><td class="r num">${i.stock} ${esc(i.unidad)}</td><td><div class="bar" title="Mínimo ${i.min}"><span style="width:${Math.min(100, i.stock / (i.min * 2) * 100)}%;background:${low ? 'var(--warn)' : 'var(--ok)'}"></span></div><small class="muted">${low ? 'Bajo el mínimo de ' + i.min : 'Mínimo ' + i.min}</small></td><td class="r num">${money(i.costo)}</td><td class="r" style="white-space:nowrap"><button class="btn sm" data-act="invMov" data-id="${i.id}" data-n="-1" aria-label="Usar uno">-1</button> <button class="btn sm" data-act="invIn" data-id="${i.id}">Ingreso</button></td></tr>`; }).join('')}
  </tbody></table></div>`;
}

/* ---------- Reportes ---------- */
function vReportes() {
  const meses = Array.from({ length: 7 }, (_, i) => { const d = parse(TODAY); d.setDate(1); d.setMonth(d.getMonth() - 6 + i); return d; });
  const mesActual = S.pagos.filter(p => p.fecha.startsWith(TODAY.slice(0, 7))).reduce((a, p) => a + p.monto, 0);
  const ing = meses.map((d, i) => ({ l: d.toLocaleDateString('es-PE', { month: 'short' }), v: i < 6 ? S.hist[i] : mesActual, lab: true, dim: i === 6 }));
  const desde = addDays(TODAY, -30);
  const at = S.citas.filter(c => c.fecha >= desde && c.fecha <= TODAY && c.estado === 'atendida');
  const porDoc = DOCTORES.map(d => ({ l: d.nombre.replace(/^Dra?\. /, '').split(' ').slice(0, 2).join(' '), v: at.filter(c => c.doctorId === d.id).length, c: d.color, lab: true }));
  const porTrat = Object.entries(at.reduce((a, c) => (a[c.motivo] = (a[c.motivo] || 0) + (trat(c.tratId)?.precio || 0), a), {})).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 6);
  const all30 = S.citas.filter(c => c.fecha >= desde && c.fecha <= TODAY);
  const web = all30.filter(c => c.origen === 'web').length, canc = all30.filter(c => c.estado === 'cancelada').length;
  return `<div class="page-h"><div><h1>Reportes</h1><p>Últimos 30 días, salvo donde se indica</p></div></div>
  <div class="kpis"><div class="kpi"><span>Pacientes atendidos</span><b>${at.length}</b><small>en 30 días</small></div><div class="kpi"><span>Ticket promedio</span><b class="num">${money(at.length ? at.reduce((a, c) => a + (trat(c.tratId)?.precio || 0), 0) / at.length : 0)}</b><small>por atención</small></div><div class="kpi"><span>Citas reservadas en la web</span><b>${all30.length ? Math.round(web / all30.length * 100) : 0}%</b><small>${web} de ${all30.length} citas</small></div><div class="kpi"><span>Cancelaciones</span><b>${all30.length ? Math.round(canc / all30.length * 100) : 0}%</b><small>${canc} citas</small></div></div>
  <div class="grid g2"><div class="card"><h2>Ingresos por mes<span class="muted r" style="font-weight:500;font-size:12px">El mes en curso aparece más claro</span></h2>${bars(ing, { fmt: v => 'S/ ' + Math.round(v / 100) / 10 + 'k' })}</div>
  <div class="card"><h2>Atenciones por doctor</h2>${bars(porDoc, { fmt: v => v + ' atenciones' })}</div>
  <div class="card"><h2>Tratamientos que más facturan</h2>${hbars(porTrat, { fmt: money })}</div>
  <div class="card"><h2>Origen de las citas</h2>${hbars([{ l: 'Web de la clínica', v: web, c: 'var(--info)' }, { l: 'Recepción y teléfono', v: all30.length - web }], { fmt: v => v + ' citas' })}<p class="muted" style="margin:0;font-size:12px">Las citas web entran solas a la agenda y reciben recordatorio por WhatsApp.</p></div></div>`;
}

/* ---------- Marketing ---------- */
function vMarketing() {
  const M = S.marketing;
  const prox = S.pacientes.filter(p => p.nac && daysToBirthday(p.nac) <= 30).sort((a, b) => daysToBirthday(a.nac) - daysToBirthday(b.nac));
  const ult = pid => S.citas.filter(c => c.pacienteId === pid && c.estado === 'atendida').map(c => c.fecha).sort().pop();
  const inact = S.pacientes.filter(p => { const u = ult(p.id); return !S.citas.some(c => c.pacienteId === p.id && c.fecha >= TODAY) && (!u || u < addDays(TODAY, -180)); });
  const sw = (k, l) => `<label class="toggle" title="${l}"><input type="checkbox" data-change="mk" data-k="${k}" ${M[k] ? 'checked' : ''} aria-label="${l}"><span></span></label>`;
  return `<div class="page-h"><div><h1>Marketing</h1><p>Mensajes automáticos por el WhatsApp Business de la clínica</p></div></div>
  <div class="grid g2">
    <div class="card"><h2><i class="ph ph-cake"></i>Cupón de cumpleaños<span class="r">${sw('cumple', 'Cupón de cumpleaños')}</span></h2>
      <p class="muted" style="margin:0">El día del cumpleaños, a las 8:00, el paciente recibe un cupón válido por 30 días.</p>
      <div class="frow"><div class="f"><label for="mdesc">Descuento</label><select id="mdesc" data-change="mkDesc">${[10, 15, 20, 25].map(n => `<option value="${n}" ${M.descuento === n ? 'selected' : ''}>${n}%</option>`).join('')}</select></div><div class="f"><label>Vista previa</label><div class="wa-msg">¡Feliz cumpleaños, María! Te regalamos ${M.descuento}% en tu próxima limpieza. Código CUMPLE-MARIA.</div></div></div>
      <div class="list">${prox.map(p => { const d = daysToBirthday(p.nac), c = S.cupones.find(c => c.pacienteId === p.id); return `<div class="li">${who(p, d === 0 ? 'Hoy' : `En ${d} días, ${fdate(addDays(TODAY, d))}`)}<span class="grow"></span>${c ? chip(c.usado ? 'Cupón usado' : 'Cupón ' + c.codigo, c.usado ? 'ok' : 'br') : `<button class="btn sm" data-act="cupon" data-id="${p.id}">Enviar ahora</button>`}</div>`; }).join('') || empty('ph-cake', 'Nadie cumple en los próximos 30 días.')}</div></div>
    <div class="card"><h2><i class="ph ph-arrow-counter-clockwise"></i>Reactivar pacientes<span class="r">${sw('reactivacion', 'Reactivación')}</span></h2>
      <p class="muted" style="margin:0">Pacientes sin visitas en 6 meses y sin cita futura. Se les invita a su control con un mensaje.</p>
      <div class="list">${inact.map(p => { const u = ult(p.id), sent = S.mensajes.some(m => m.pacienteId === p.id && m.tipo === 'Reactivación'); return `<div class="li">${who(p, u ? 'Última visita ' + fdate(u, { month: 'short', year: 'numeric' }) : 'Sin visitas registradas')}<span class="grow"></span>${sent ? chip('Invitado', 'ok') : ''}</div>`; }).join('') || empty('ph-check', 'Todos tus pacientes están al día.')}</div>
      <button class="btn wa" data-act="reactivar" ${inact.length ? '' : 'disabled'}><i class="ph ph-whatsapp-logo"></i>Enviar invitación a ${inact.length}</button></div>
    <div class="card"><h2><i class="ph ph-star"></i>Reseñas en Google<span class="r">${sw('resenas', 'Reseñas')}</span></h2><p class="muted" style="margin:0">Dos horas después de cada atención se envía el enlace para dejar una reseña de la clínica en Google.</p>
      <dl class="kv"><dt>Pedidos este mes</dt><dd>${S.citas.filter(c => c.estado === 'atendida' && c.fecha.startsWith(TODAY.slice(0, 7))).length}</dd><dt>Calificación actual en Google</dt><dd>4.9 de 5</dd></dl></div>
    <div class="card"><h2><i class="ph ph-bell-ringing"></i>Recordatorio de citas<span class="r">${sw('recordatorio', 'Recordatorio')}</span></h2><p class="muted" style="margin:0">Un día antes a las 18:00, con botones Confirmar y Reprogramar. La respuesta cambia el estado de la cita en la agenda.</p>
      <div class="wa-msg">Hola María, te recordamos tu cita de mañana a las 10:30 con el Dr. Luis Díaz.</div><div style="display:flex;gap:6px"><span class="chip ok" style="flex:1;justify-content:center;padding:6px">Confirmar</span><span class="chip mut" style="flex:1;justify-content:center;padding:6px">Reprogramar</span></div></div>
  </div>
  <div class="card"><h2><i class="ph ph-chat-circle-dots"></i>Mensajes enviados<span class="chip mut r">${S.mensajes.length}</span></h2>
  <div class="twrap" style="border:0"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Mensaje</th><th>Estado</th></tr></thead><tbody>${S.mensajes.slice(0, 15).map(m => `<tr><td class="num" style="white-space:nowrap">${fdate(m.fecha)} ${m.hora}</td><td>${esc(pac(m.pacienteId).nombre)}</td><td>${chip(m.tipo, 'br')}</td><td style="max-width:420px">${esc(m.texto)}</td><td>${chip(m.estado + (m.resp ? ': ' + m.resp : ''), m.estado === 'Respondido' || m.estado === 'Leído' ? 'ok' : 'mut')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------- Ajustes ---------- */
function vAjustes() {
  return `<div class="page-h"><div><h1>Ajustes</h1><p>Datos de la clínica, horarios, tarifario e integraciones</p></div></div>
  <div class="grid g2">
    <div class="card"><h2><i class="ph ph-buildings"></i>Clínica</h2><dl class="kv"><dt>Razón social</dt><dd>Clínica Dental Diaz S.A.C.</dd><dt>Dirección</dt><dd>Jr. San Román 394, Huacho</dd><dt>Horario</dt><dd>Lun a vie 9:00 a 13:00 y 15:00 a 20:00<br>Sáb 9:00 a 13:00</dd><dt>Sillones</dt><dd>3</dd></dl></div>
    <div class="card"><h2><i class="ph ph-plugs-connected"></i>Integraciones</h2><div class="list">
      <div class="li"><i class="ph ph-whatsapp-logo" style="color:#1F8A5B"></i><span class="grow">WhatsApp Business de la clínica<br><small>Canal conectado por QH. Sin costo por mensaje para la clínica.</small></span>${chip('Conectado', 'ok')}</div>
      <div class="li"><i class="ph ph-seal-check" style="color:var(--brand-2)"></i><span class="grow">SUNAT, envío directo con certificado digital<br><small>Lo gestiona y renueva QH.</small></span>${chip('Vigente', 'ok')}</div>
      <div class="li"><i class="ph ph-globe" style="color:var(--info)"></i><span class="grow">Web de citas<br><small>Lee la disponibilidad de esta agenda y escribe las reservas.</small></span><a class="btn sm" href="../#reserva" target="_blank" rel="noopener">Abrir</a></div></div></div>
    <div class="card"><h2><i class="ph ph-user-circle"></i>Doctores</h2><div class="list">${DOCTORES.map(d => `<div class="li"><span class="av" style="background:${d.color};color:#fff">${initials(d.nombre)}</span><span class="grow">${esc(d.nombre)}<br><small>${esc(d.esp)} · ${esc(d.sillon)}</small></span></div>`).join('')}</div></div>
    <div class="card"><h2><i class="ph ph-users-three"></i>Usuarios</h2><div class="list">${USERS.map(u => `<div class="li"><span class="av">${initials(u.nombre)}</span><span class="grow">${esc(u.nombre)}<br><small>${esc(u.email)}</small></span>${chip(u.rol, 'br')}</div>`).join('')}</div></div>
  </div>
  <div class="card"><h2><i class="ph ph-currency-circle-dollar"></i>Tarifario<span class="muted r" style="font-weight:500;font-size:12px">Edita un precio y se guarda al salir del campo</span></h2>
  <div class="twrap" style="border:0"><table><thead><tr><th>Tratamiento</th><th>Duración</th><th class="r" style="width:160px">Precio (S/)</th></tr></thead><tbody>${S.tarifario.map(t => `<tr><td>${esc(t.nombre)}</td><td>${t.dur} min</td><td class="r"><input class="btn sm num" style="width:110px;text-align:right" inputmode="decimal" value="${t.precio}" data-change="precio" data-id="${t.id}" aria-label="Precio de ${esc(t.nombre)}"></td></tr>`).join('')}</tbody></table></div></div>
  <div class="card" style="flex-direction:row;align-items:center;flex-wrap:wrap"><span class="grow" style="flex:1">Restablecer la demo borra los cambios hechos en este navegador y vuelve a cargar los datos de ejemplo.</span><button class="btn danger" data-act="reset"><i class="ph ph-arrow-counter-clockwise"></i>Restablecer datos</button></div>`;
}

/* ---------- Acciones ---------- */
function sendWA(pid, tipo, texto, extra = {}) {
  const m = { id: uid('m'), fecha: TODAY, hora: toH(nowMin()), pacienteId: pid, tipo, texto, estado: 'Entregado', ...extra };
  S.mensajes.unshift(m);
  return m;
}
const A = {
  close: () => closeModal(),
  menu: () => document.getElementById('app').classList.toggle('nav-open'),
  go: d => location.hash = d.h,
  logout: () => { sessionStorage.removeItem(USER_KEY); location.hash = ''; render(); },
  pickRole: d => { document.querySelectorAll('.role').forEach(b => b.setAttribute('aria-pressed', b.dataset.i === d.i)); document.getElementById('em').value = USERS[d.i].email; document.getElementById('pw').value = PASS; },
  tab: d => { ui.tab = d.t; render(); },
  agGo: d => { ui.agDay = d.f; render(); },
  agMove: d => { ui.agDay = addDays(ui.agDay, Number(d.n)); render(); },
  agDoc: d => { ui.agDoc = d.d; render(); },
  facF: d => { ui.facF = d.f; render(); },
  nuevaCita: d => {
    modal('Nueva cita', citaForm(null, { f: d.f, d: d.d, pacienteId: d.p }), `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="citaOk">Agendar</button>`);
    wireCitaForm(null, d.h);
  },
  citaOk: () => saveCita(null),
  asignar: d => {
    const s = S.solicitudes.find(x => x.id === d.id);
    const t = S.tarifario.find(t => s.motivo.toLowerCase().includes(t.nombre.split(' ')[0].toLowerCase())) || S.tarifario[0];
    modal('Dar horario a la solicitud web', `<p class="hint" style="margin:0">${esc(pac(s.pacienteId).nombre)} pidió "${esc(s.motivo)}" desde la web. Al agendar se le envía la confirmación por WhatsApp.</p>` + citaForm(null, { pacienteId: s.pacienteId, t: t.id }), `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="asignarOk" data-id="${s.id}">Agendar y avisar</button>`);
    wireCitaForm(null);
  },
  asignarOk: d => {
    const s = S.solicitudes.find(x => x.id === d.id), h = val('#ch'), f = val('#cf');
    if (!h) return;
    S.solicitudes = S.solicitudes.filter(x => x !== s);
    const p = pac(s.pacienteId);
    sendWA(p.id, 'Confirmación', `Hola ${p.nombre.split(' ')[0]}, tu cita quedó para el ${fdateL(f)} a las ${h} en Clínica Dental Díaz, Jr. San Román 394.`);
    saveCita(null, { origen: 'web', estado: 'confirmada' });
  },
  verCita: d => verCita(S.citas.find(c => c.id === d.id)),
  reprogramar: d => { const c = S.citas.find(x => x.id === d.id); modal('Reprogramar cita', citaForm(c), `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="reproOk" data-id="${c.id}">Guardar</button>`); wireCitaForm(c); },
  reproOk: d => saveCita(S.citas.find(c => c.id === d.id)),
  estado: (d) => {
    const c = S.citas.find(x => x.id === d.id); c.estado = d.e; delete c.nueva; save();
    render(); if (d.keep) verCita(c);
    toast(`${pac(c.pacienteId).nombre}: ${ESTADOS[d.e].toLowerCase()}.`);
  },
  recordar: d => {
    const c = S.citas.find(x => x.id === d.id), p = pac(c.pacienteId);
    sendWA(p.id, 'Recordatorio', `Hola ${p.nombre.split(' ')[0]}, te recordamos tu cita del ${fdateL(c.fecha)} a las ${c.hora} con ${doc(c.doctorId).nombre}. Responde Confirmar o Reprogramar.`);
    save(); closeModal(); toast('Recordatorio enviado por WhatsApp.', 'ph-whatsapp-logo', 'wa');
    // ponytail: respuesta simulada del paciente para mostrar el flujo; en producción llega por webhook
    setTimeout(() => {
      const m = S.mensajes.find(m => m.pacienteId === p.id && m.tipo === 'Recordatorio');
      if (m) { m.estado = 'Respondido'; m.resp = 'Confirmar'; }
      c.estado = 'confirmada'; delete c.nueva; save(); toast(`${p.nombre} confirmó su cita por WhatsApp.`, 'ph-whatsapp-logo', 'wa'); if (!modalEl) render();
    }, 2600);
  },
  cobrar: d => cobroModal(d.p, d.t),
  cobroOk: () => {
    const p = S.pacientes.find(x => x.nombre === val('#kp')), m = Number(val('#km')), cid = val('#kc'), tipo = val('#ktip'), ruc = val('#kruc');
    const err = !p ? 'Elige un paciente de la lista.' : !(m > 0) ? 'Escribe un monto válido.' : tipo === 'Factura' && !/^\d{11}$/.test(ruc) ? 'El RUC debe tener 11 dígitos.' : '';
    if (err) return modalEl.querySelector('#kerr').textContent = err;
    const t = trat(cid), concepto = t ? t.nombre : 'Abono a cuenta';
    if (t) S.cargos.push({ id: uid('g'), fecha: TODAY, pacienteId: p.id, concepto, monto: t.precio });
    const cup = S.cupones.find(c => c.codigo === val('#kcup').toUpperCase() && !c.usado);
    if (cup && t) { S.pagos.push({ id: uid('$'), fecha: TODAY, hora: toH(nowMin()), pacienteId: p.id, monto: t.precio - m, metodo: 'Cupón', concepto: 'Descuento ' + cup.codigo, comprobanteId: '' }); cup.usado = true; }
    const pago = { id: uid('$'), fecha: TODAY, hora: toH(nowMin()), pacienteId: p.id, monto: m, metodo: val('#kmet'), concepto };
    S.pagos.push(pago);
    const comp = emitir(pago, tipo, ruc, concepto);
    save(); closeModal(); render(); toast(`Cobro de ${money(m)} registrado. ${comp.id} enviado a SUNAT.`, 'ph-receipt');
  },
  nuevoPaciente: () => modal('Nuevo paciente', pacienteForm(), `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="pacOk">Guardar</button>`),
  editPaciente: d => modal('Editar paciente', pacienteForm(pac(d.id)), `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="pacOk" data-id="${d.id}">Guardar</button>`),
  pacOk: d => {
    const data = { nombre: val('#pn'), dni: digits(val('#pdni')), tel: digits(val('#ptel')), nac: val('#pnac'), email: val('#pem'), alergia: val('#pal') };
    const err = data.nombre.length < 3 ? 'Escribe nombres y apellidos.' : data.dni && data.dni.length !== 8 ? 'El DNI tiene 8 dígitos.' : data.tel.length < 9 ? 'El celular tiene 9 dígitos.' : '';
    if (err) return modalEl.querySelector('#perr').textContent = err;
    let p = d.id && pac(d.id);
    if (p) Object.assign(p, data); else { p = { id: uid('p'), ficha: String(1000 + S.pacientes.length), desde: TODAY, origen: 'recepcion', ...data }; S.pacientes.push(p); }
    save(); closeModal(); ui.tab = 'resumen'; location.hash = '#/pacientes/' + p.id; render(); toast('Paciente guardado.');
  },
  odoTool: d => { ui.odoTool = d.k; render(); },
  odo: d => {
    const pid = route()[1]; const o = S.odontos[pid] ??= {}; const t = o[d.n] ??= {};
    const k = ui.odoTool;
    if (k === 'sano') delete o[d.n];
    else if (FACE_C[k]) t[d.f] = t[d.f] === k ? undefined : k;
    else t[k] = t[k] ? undefined : 1;
    if (o[d.n]) Object.keys(t).forEach(x => t[x] === undefined && delete t[x]);
    save(); document.getElementById('tabv').innerHTML = tOdonto(pac(pid));
  },
  planAdd: d => {
    const t = trat(val('#pt', document)), pr = Number(val('#pp', document)) || t.precio;
    (S.planes[d.p] ??= []).push({ id: uid('i'), tratId: t.id, diente: val('#pd', document), precio: pr, estado: 'pendiente' });
    save(); render();
  },
  planEst: d => { const i = S.planes[d.p].find(x => x.id === d.id); i.estado = { pendiente: 'proceso', proceso: 'terminado', terminado: 'pendiente' }[i.estado]; save(); render(); },
  planDel: d => { S.planes[d.p] = S.planes[d.p].filter(x => x.id !== d.id); save(); render(); },
  presupuesto: d => {
    const p = pac(d.p), items = S.planes[d.p] || [];
    modal('Presupuesto', `<div class="rx print-area"><div class="rx-h">${logo(true)}<span class="sp" style="flex:1"></span><span>Presupuesto · ${fdate(TODAY, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div><p style="margin:0">Paciente: <b>${esc(p.nombre)}</b></p>
      <table><thead><tr><th>Tratamiento</th><th>Pieza</th><th class="r">Precio</th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(trat(i.tratId).nombre)}</td><td>${esc(i.diente) || '-'}</td><td class="r num">${money(i.precio)}</td></tr>`).join('')}<tr><td colspan="2"><b>Total</b></td><td class="r num"><b>${money(items.reduce((a, i) => a + i.precio, 0))}</b></td></tr></tbody></table>
      <small class="muted">Válido por 30 días. Jr. San Román 394, Huacho.</small></div>`, `<button class="btn" data-act="close">Cerrar</button><button class="btn pri" onclick="window.print()"><i class="ph ph-printer"></i>Imprimir</button>`, 'wide');
  },
  evolAdd: d => { const t = val('#evt', document); if (!t) return; S.evoluciones.push({ id: uid('e'), pacienteId: d.p, fecha: TODAY, doctorId: user().doctorId || 'd1', texto: t }); save(); render(); toast('Nota guardada.'); },
  receta: d => {
    const p = pac(d.p);
    const row = () => `<div class="frow rxrow" style="grid-template-columns:2fr 1fr 1fr 70px"><input list="meds" placeholder="Medicamento" aria-label="Medicamento" class="btn" style="justify-content:flex-start"><input placeholder="Dosis" value="1 tableta" aria-label="Dosis" class="btn"><input placeholder="Frecuencia" value="cada 8 horas" aria-label="Frecuencia" class="btn"><input type="number" min="1" value="3" aria-label="Días" class="btn"></div>`;
    modal('Nueva receta', `${p.alergia ? `<div class="hint" style="border-color:var(--bad);color:var(--bad)"><i class="ph ph-warning"></i> Alergia registrada: <b>${esc(p.alergia)}</b></div>` : ''}<datalist id="meds">${MEDS.map(m => `<option value="${m}">`).join('')}</datalist>
      <div id="rxrows" style="display:grid;gap:8px">${row()}</div><button class="btn sm" style="justify-self:start" data-act="rxRow"><i class="ph ph-plus"></i>Otro medicamento</button>
      <div class="f"><label for="rxind">Indicaciones</label><textarea id="rxind" rows="3"></textarea></div><span class="err" id="rxerr"></span>`,
      `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="rxOk" data-p="${p.id}">Guardar receta</button>`, 'wide');
    A._rxRow = row;
    modalEl.addEventListener('input', e => {
      if (e.target.matches('[list=meds]') && p.alergia && /penicil/i.test(p.alergia) && /amoxi|penicil|ampi/i.test(e.target.value)) modalEl.querySelector('#rxerr').textContent = 'Atención: la amoxicilina es una penicilina y el paciente es alérgico.';
    });
  },
  rxRow: () => modalEl.querySelector('#rxrows').insertAdjacentHTML('beforeend', A._rxRow()),
  rxOk: d => {
    const items = [...modalEl.querySelectorAll('.rxrow')].map(r => { const [m, ds, f, n] = [...r.querySelectorAll('input')].map(i => i.value.trim()); return { med: m, dosis: ds, frec: f, dias: Number(n) || 1 }; }).filter(i => i.med);
    if (!items.length) return modalEl.querySelector('#rxerr').textContent = 'Agrega al menos un medicamento.';
    const r = { id: uid('r'), pacienteId: d.p, fecha: TODAY, doctorId: user().doctorId || 'd1', items, ind: val('#rxind') };
    S.recetas.push(r); save(); render(); A.verReceta({ id: r.id });
  },
  verReceta: d => {
    const r = S.recetas.find(x => x.id === d.id), p = pac(r.pacienteId), dc = doc(r.doctorId);
    modal('Receta', `<div class="rx print-area"><div class="rx-h">${logo(true)}<span style="flex:1"></span><span style="text-align:right"><b>${esc(dc.nombre)}</b><br><small>${esc(dc.esp)} · COP 12458</small></span></div>
      <p style="margin:0">Paciente: <b>${esc(p.nombre)}</b>${p.nac ? ` · ${age(p.nac)} años` : ''} · ${fdate(r.fecha, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="list">${r.items.map(i => `<div class="li"><b style="font-size:18px;color:var(--brand)">Rp.</b><span class="grow"><b>${esc(i.med)}</b><br>${esc(i.dosis)} ${esc(i.frec)} por ${i.dias} días</span></div>`).join('')}</div>
      ${r.ind ? `<p style="margin:0"><b>Indicaciones:</b> ${esc(r.ind)}</p>` : ''}<small class="muted">Jr. San Román 394, Huacho</small></div>`,
      `<button class="btn" data-act="close">Cerrar</button><a class="btn wa" href="https://wa.me/51${digits(p.tel).slice(-9)}?text=${encodeURIComponent('Hola, te enviamos tu receta de Clínica Dental Díaz.')}" target="_blank" rel="noopener"><i class="ph ph-whatsapp-logo"></i>Enviar</a><button class="btn pri" onclick="window.print()"><i class="ph ph-printer"></i>Imprimir</button>`, 'wide');
  },
  consentAdd: d => { S.consentimientos.push({ id: uid('k'), pacienteId: d.p, tipo: document.getElementById('ktipo').value, fecha: TODAY, firmado: false }); save(); render(); },
  firmar: d => {
    modal('Firma del paciente', `<p class="muted" style="margin:0">El paciente firma con el dedo en la tablet de recepción.</p><canvas id="sig" width="500" height="180" style="width:100%;border:1px dashed var(--line);border-radius:12px;background:var(--surface-2);touch-action:none"></canvas>`, `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="firmaOk" data-id="${d.id}">Guardar firma</button>`);
    const c = modalEl.querySelector('#sig'), x = c.getContext('2d'); let on = false;
    x.lineWidth = 2.5; x.lineCap = 'round'; x.strokeStyle = '#2E3F94';
    const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.onpointerdown = e => { on = true; x.beginPath(); x.moveTo(...pt(e)); };
    c.onpointermove = e => { if (on) { x.lineTo(...pt(e)); x.stroke(); } };
    c.onpointerup = c.onpointerleave = () => on = false;
  },
  firmaOk: d => { S.consentimientos.find(k => k.id === d.id).firmado = true; save(); closeModal(); render(); toast('Consentimiento firmado y guardado en la ficha.', 'ph-signature'); },
  cupon: d => {
    const p = pac(d.id), first = p.nombre.split(' ')[0];
    const codigo = 'CUMPLE-' + first.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    S.cupones.push({ codigo, pacienteId: p.id, desc: S.marketing.descuento, vence: addDays(TODAY, 30), usado: false, enviado: TODAY });
    sendWA(p.id, 'Cumpleaños', `¡Feliz cumpleaños, ${first}! En Clínica Dental Díaz te regalamos ${S.marketing.descuento}% de descuento en tu próxima atención. Código ${codigo}, válido 30 días.`);
    save(); render(); toast(`Cupón ${codigo} enviado por WhatsApp.`, 'ph-gift', 'wa');
  },
  reactivar: () => {
    const ult = pid => S.citas.filter(c => c.pacienteId === pid && c.estado === 'atendida').map(c => c.fecha).sort().pop();
    const inact = S.pacientes.filter(p => { const u = ult(p.id); return !S.citas.some(c => c.pacienteId === p.id && c.fecha >= TODAY) && (!u || u < addDays(TODAY, -180)); });
    inact.filter(p => !S.mensajes.some(m => m.pacienteId === p.id && m.tipo === 'Reactivación')).forEach(p => sendWA(p.id, 'Reactivación', `Hola ${p.nombre.split(' ')[0]}, hace tiempo no te vemos. Tu control y limpieza te esperan en Clínica Dental Díaz. Reserva aquí: clinicadentaldiaz.pe/#reserva`));
    save(); render(); toast(`Invitación enviada a ${inact.length} pacientes.`, 'ph-whatsapp-logo', 'wa');
  },
  egreso: () => modal('Registrar gasto de caja chica', `<div class="f"><label for="ec">Concepto</label><input id="ec"></div><div class="f"><label for="em2">Monto (S/)</label><input id="em2" inputmode="decimal"></div><span class="err" id="eerr"></span>`, `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="egresoOk">Guardar</button>`),
  egresoOk: () => { const c = val('#ec'), m = Number(val('#em2')); if (!c || !(m > 0)) return modalEl.querySelector('#eerr').textContent = 'Completa concepto y monto.'; S.caja.egresos.push({ id: uid('x'), fecha: TODAY, hora: toH(nowMin()), concepto: c, monto: m }); save(); closeModal(); render(); },
  cierre: () => {
    const hoy = S.pagos.filter(p => p.fecha === TODAY), egr = S.caja.egresos.filter(e => e.fecha === TODAY).reduce((a, e) => a + e.monto, 0);
    modal('Cierre de caja', `<dl class="kv">${METODOS.map(m => `<dt>${m}</dt><dd class="num">${money(hoy.filter(p => p.metodo === m).reduce((a, p) => a + p.monto, 0))}</dd>`).join('')}<dt>Gastos</dt><dd class="num">-${money(egr)}</dd><dt>Apertura</dt><dd class="num">${money(S.caja.apertura)}</dd><dt><b>Efectivo a entregar</b></dt><dd class="num">${money(S.caja.apertura + hoy.filter(p => p.metodo === 'Efectivo').reduce((a, p) => a + p.monto, 0) - egr)}</dd></dl>`,
      S.caja.cerrada ? `<button class="btn" data-act="close">Cerrar</button>` : `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="cierreOk">Confirmar cierre</button>`);
  },
  cierreOk: () => { S.caja.cerrada = true; save(); closeModal(); render(); toast('Caja cerrada. El resumen se envió al administrador.'); },
  reenviar: d => { const c = S.comprobantes.find(x => x.id === d.id); c.estado = 'Enviando'; save(); render(); setTimeout(() => { c.estado = 'Aceptado'; save(); render(); toast(`SUNAT aceptó ${c.id}.`, 'ph-seal-check'); }, 1500); },
  verComp: d => {
    const c = S.comprobantes.find(x => x.id === d.id), p = pac(c.pacienteId), base = c.total / 1.18;
    modal(`${c.tipo} electrónica ${c.id}`, `<div class="rx print-area"><div class="rx-h">${logo(true)}<span style="flex:1"></span><span style="text-align:right;border:1px solid var(--brand);border-radius:8px;padding:6px 10px"><b>RUC 20601234567</b><br>${c.tipo.toUpperCase()} ELECTRÓNICA<br><b>${c.id}</b></span></div>
      <dl class="kv"><dt>Fecha de emisión</dt><dd>${fdate(c.fecha, { day: '2-digit', month: '2-digit', year: 'numeric' })}</dd><dt>Cliente</dt><dd>${esc(p.nombre)}</dd><dt>${c.ruc ? 'RUC' : 'DNI'}</dt><dd>${esc(c.ruc || p.dni || '-')}</dd></dl>
      <table><thead><tr><th>Descripción</th><th class="r">Importe</th></tr></thead><tbody><tr><td>${esc(c.concepto)}</td><td class="r num">${money(c.total)}</td></tr><tr><td class="r">Op. gravada</td><td class="r num">${money(base)}</td></tr><tr><td class="r">IGV 18%</td><td class="r num">${money(c.total - base)}</td></tr><tr><td class="r"><b>Total</b></td><td class="r num"><b>${money(c.total)}</b></td></tr></tbody></table>
      <small class="muted">Representación impresa de la ${c.tipo.toLowerCase()} electrónica. Estado SUNAT: ${c.estado}.</small></div>`, `<button class="btn" data-act="close">Cerrar</button><button class="btn pri" onclick="window.print()"><i class="ph ph-printer"></i>Imprimir</button>`, 'wide');
  },
  labNext: d => { const x = S.lab.find(l => l.id === d.id); x.estado = { enviado: 'proceso', proceso: 'recibido', recibido: 'instalado' }[x.estado]; save(); render(); },
  labNew: () => modal('Nueva orden de laboratorio', `<div class="f"><label for="lp">Paciente</label><select id="lp">${S.pacientes.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div><div class="f"><label for="lt">Trabajo</label><input id="lt" placeholder="Ej. Corona de zirconio, pieza 46"></div>
    <div class="frow"><div class="f"><label for="ll">Laboratorio</label><select id="ll"><option>Dental Lab Huacho</option><option>Ceramic Art Lima</option></select></div><div class="f"><label for="le">Fecha de entrega</label><input id="le" type="date" value="${addDays(TODAY, 10)}"></div></div><div class="f"><label for="lc">Costo (S/)</label><input id="lc" inputmode="decimal"></div><span class="err" id="lerr2"></span>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="labOk">Crear orden</button>`),
  labOk: () => { if (!val('#lt')) return modalEl.querySelector('#lerr2').textContent = 'Describe el trabajo.'; S.lab.push({ id: uid('l'), pacienteId: val('#lp'), trabajo: val('#lt'), lab: val('#ll'), enviado: TODAY, entrega: val('#le'), estado: 'enviado', costo: Number(val('#lc')) || 0 }); save(); closeModal(); render(); toast('Orden creada.'); },
  invMov: d => { const i = S.inventario.find(x => x.id === d.id); i.stock = Math.max(0, i.stock + Number(d.n)); save(); render(); if (i.stock < i.min) toast(`${i.nombre} quedó bajo el mínimo.`, 'ph-warning'); },
  invIn: d => { const i = S.inventario.find(x => x.id === d.id); modal('Ingreso de ' + esc(i.nombre), `<div class="f"><label for="iq">Cantidad (${esc(i.unidad)})</label><input id="iq" type="number" min="1" value="10"></div>`, `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="invInOk" data-id="${i.id}">Registrar</button>`); },
  invInOk: d => { const i = S.inventario.find(x => x.id === d.id); i.stock += Math.max(0, Number(val('#iq')) || 0); save(); closeModal(); render(); },
  invNew: () => modal('Nuevo insumo', `<div class="f"><label for="in">Nombre</label><input id="in"></div><div class="frow"><div class="f"><label for="ic">Categoría</label><input id="ic" value="Descartables"></div><div class="f"><label for="iu">Unidad</label><input id="iu" value="und"></div></div><div class="frow"><div class="f"><label for="is">Stock</label><input id="is" type="number" value="0"></div><div class="f"><label for="imin">Mínimo</label><input id="imin" type="number" value="5"></div></div><div class="f"><label for="ico">Costo unitario (S/)</label><input id="ico" inputmode="decimal"></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="invNewOk">Guardar</button>`),
  invNewOk: () => { if (!val('#in')) return; S.inventario.push({ id: uid('v'), nombre: val('#in'), cat: val('#ic'), unidad: val('#iu'), stock: Number(val('#is')) || 0, min: Number(val('#imin')) || 0, costo: Number(val('#ico')) || 0 }); save(); closeModal(); render(); },
  reset: () => { if (!confirm('¿Restablecer todos los datos de la demo?')) return; S = seed(); save(); render(); toast('Datos de ejemplo restablecidos.'); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.tagName === 'A' && el.dataset.act === 'close') { closeModal(); return; }
  if (el.tagName !== 'A') e.preventDefault();
  A[el.dataset.act]?.(el.dataset, el);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  const k = el.dataset.change;
  if (k === 'agDate' && el.value) { ui.agDay = el.value; render(); }
  if (k === 'mk') { S.marketing[el.dataset.k] = el.checked; save(); toast(el.checked ? 'Automatización activada.' : 'Automatización pausada.'); }
  if (k === 'mkDesc') { S.marketing.descuento = Number(el.value); save(); render(); }
  if (k === 'precio') { const t = trat(el.dataset.id), v = Number(el.value); if (v > 0) { t.precio = v; save(); toast(`Precio de ${t.nombre} actualizado.`); } else el.value = t.precio; }
});
document.addEventListener('input', e => {
  if (e.target.dataset.input === 'filtroP') { ui.q = e.target.value; const pos = e.target.selectionStart; render(); const i = document.querySelector('[data-input=filtroP]'); i.focus(); i.setSelectionRange(pos, pos); }
  if (e.target.id === 'q') {
    const q = e.target.value.trim().toLowerCase(), box = document.getElementById('qres');
    const res = q.length < 2 ? [] : S.pacientes.filter(p => (p.nombre + ' ' + p.dni + ' ' + p.tel).toLowerCase().includes(q)).slice(0, 6);
    box.hidden = !q || q.length < 2;
    box.innerHTML = res.map(p => `<a href="#/pacientes/${p.id}">${who(p, `DNI ${esc(p.dni) || '-'} · ${esc(p.tel)}`)}</a>`).join('') || '<div class="empty">Sin resultados</div>';
  }
});
document.addEventListener('focusout', e => { if (e.target.id === 'q') setTimeout(() => { const b = document.getElementById('qres'); if (b) b.hidden = true; }, 200); });
document.addEventListener('keydown', e => { if (e.target.id === 'q' && e.key === 'Enter') { const a = document.querySelector('#qres a'); if (a) location.hash = a.getAttribute('href'); } });
window.addEventListener('hashchange', () => { closeModal(); if (route()[0] === 'pacientes' && route()[1] && ui._pid !== route()[1]) { ui.tab = 'resumen'; ui._pid = route()[1]; } render(); });

load();
ui._pid = route()[1];
render();
