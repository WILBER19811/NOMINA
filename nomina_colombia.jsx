import { useState, useEffect, useMemo } from "react";

/* ============================================================
   LIBRO DE NÓMINA — Colombia 2026
   Ledger-style payroll + time tracking tool.
   ============================================================ */

/* ---------- 1. Parámetros normativos 2026 (única fuente de verdad) ---------- */
const REGLAS_2026 = {
  smmlv: 1750905,
  auxilioTransporte: 249095,
  topeAuxilioTransporteSMMLV: 2,
  uvt: 52374,
  divisorHoraMensual: 240, // Art. 158 CST, criterio UGPP / Corte Suprema
  recargos: {
    horaExtraDiurna: 0.25,
    horaExtraNocturna: 0.75,
    nocturnoOrdinario: 0.35,
    dominicalFestivo: 0.75,
  },
  seguridadSocial: {
    saludTotal: 0.125,
    saludEmpleado: 0.04,
    saludEmpleador: 0.085,
    pensionTotal: 0.16,
    pensionEmpleado: 0.04,
    pensionEmpleador: 0.12,
  },
  arlPorClase: { I: 0.00522, II: 0.01044, III: 0.02436, IV: 0.0435, V: 0.0696 },
  parafiscales: { caja: 0.04, sena: 0.02, icbf: 0.03 },
  prestaciones: {
    cesantias: 0.0833,
    interesesCesantias: 0.12, // anual, sobre saldo de cesantías
    prima: 0.0833,
    vacaciones: 0.0417,
  },
  umbralRetencionUVT: 95,
  vigenciaJornada42h: "2026-07-15",
};

const CLASES_RIESGO = ["I", "II", "III", "IV", "V"];

/* ---------- 2. Utilidades ---------- */
const fmt = (n) =>
  (isNaN(n) ? 0 : Math.round(n)).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const uid = () => Math.random().toString(36).slice(2, 10);

const mesesES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function valorHora(salarioMensual) {
  return salarioMensual / REGLAS_2026.divisorHoraMensual;
}

function aplicaExoneracionLey1607(salario, empresaExonerada) {
  return empresaExonerada && salario < REGLAS_2026.smmlv * 10;
}

/* Cálculo de un empleado para un periodo (mes) dado sus registros de tiempo */
function liquidarEmpleado(empleado, entradasDelMes, empresaExonerada) {
  const salario = Number(empleado.salario) || 0;
  const vh = valorHora(salario);
  const r = REGLAS_2026.recargos;

  let totalExtraDiurna = 0, totalExtraNocturna = 0, totalNocturno = 0, totalDomFest = 0, diasAusencia = 0;

  entradasDelMes.forEach((e) => {
    totalExtraDiurna += (e.horasExtraDiurna || 0) * vh * (1 + r.horaExtraDiurna);
    totalExtraNocturna += (e.horasExtraNocturna || 0) * vh * (1 + r.horaExtraNocturna);
    totalNocturno += (e.horasRecargoNocturno || 0) * vh * r.nocturnoOrdinario;
    totalDomFest += (e.horasDominicalFestivo || 0) * vh * r.dominicalFestivo;
    if (e.ausente) diasAusencia += 1;
  });

  const descuentoAusencias = diasAusencia * (salario / 30);
  const tieneAuxilio = salario <= REGLAS_2026.smmlv * REGLAS_2026.topeAuxilioTransporteSMMLV;
  const auxilioTransporte = tieneAuxilio ? REGLAS_2026.auxilioTransporte : 0;

  const totalExtrasYRecargos = totalExtraDiurna + totalExtraNocturna + totalNocturno + totalDomFest;
  const totalDevengado = salario - descuentoAusencias + totalExtrasYRecargos + auxilioTransporte;

  const ibc = Math.max(salario - descuentoAusencias + totalExtrasYRecargos, REGLAS_2026.smmlv);
  const ss = REGLAS_2026.seguridadSocial;
  const saludEmpleado = ibc * ss.saludEmpleado;
  const pensionEmpleado = ibc * ss.pensionEmpleado;

  // Retención en la fuente — chequeo de umbral (cálculo simplificado de bandera, no la tabla progresiva completa)
  const baseDepuradaAprox = totalDevengado - saludEmpleado - pensionEmpleado - (totalDevengado * 0.25);
  const baseEnUVT = baseDepuradaAprox / REGLAS_2026.uvt;
  const superaUmbralRetencion = baseEnUVT > REGLAS_2026.umbralRetencionUVT;

  const netoPagar = totalDevengado - saludEmpleado - pensionEmpleado;

  // Costos patronales (informativos)
  const exonerado = aplicaExoneracionLey1607(salario, empresaExonerada);
  const saludEmpleador = exonerado ? 0 : ibc * ss.saludEmpleador;
  const pensionEmpleador = ibc * ss.pensionEmpleador;
  const arl = ibc * (REGLAS_2026.arlPorClase[empleado.claseRiesgo || "I"] || REGLAS_2026.arlPorClase.I);
  const caja = ibc * REGLAS_2026.parafiscales.caja;
  const sena = exonerado ? 0 : ibc * REGLAS_2026.parafiscales.sena;
  const icbf = exonerado ? 0 : ibc * REGLAS_2026.parafiscales.icbf;

  const p = REGLAS_2026.prestaciones;
  const provisionCesantias = (salario + auxilioTransporte) * p.cesantias;
  const provisionInteresesCesantias = provisionCesantias * p.interesesCesantias;
  const provisionPrima = salario * p.prima;
  const provisionVacaciones = salario * p.vacaciones;

  const costoTotalEmpleador =
    totalDevengado + saludEmpleador + pensionEmpleador + arl + caja + sena + icbf +
    provisionCesantias + provisionInteresesCesantias + provisionPrima + provisionVacaciones;

  return {
    salario, auxilioTransporte, totalExtraDiurna, totalExtraNocturna, totalNocturno, totalDomFest,
    descuentoAusencias, diasAusencia, totalDevengado, ibc, saludEmpleado, pensionEmpleado,
    superaUmbralRetencion, netoPagar, saludEmpleador, pensionEmpleador, arl, caja, sena, icbf,
    provisionCesantias, provisionInteresesCesantias, provisionPrima, provisionVacaciones,
    costoTotalEmpleador, exonerado,
  };
}

/* ---------- 3. Estilos (ficha de estilo tipo "libro contable") ---------- */
const COLORS = {
  paper: "#EDEAE1",
  paperLine: "#C9C2B0",
  ink: "#20281F",
  inkSoft: "#5B5F4F",
  ledgerGreen: "#33513A",
  ledgerGreenSoft: "#E4E9DE",
  rust: "#8C3A2B",
  rustSoft: "#F1DDD6",
  gold: "#9C7A29",
  panel: "#F7F5EE",
  white: "#FFFDF8",
};

const css = `
.lb-root { font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; color: ${COLORS.ink}; background: ${COLORS.paper}; min-height: 100%; padding: 0; }
.lb-mono { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-variant-numeric: tabular-nums; }
.lb-header { padding: 28px 32px 18px; border-bottom: 2px solid ${COLORS.ink}; display:flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
.lb-title { font-family: Georgia, 'Times New Roman', serif; font-size: 26px; letter-spacing: 0.2px; margin: 0; }
.lb-sub { color: ${COLORS.inkSoft}; font-size: 13px; margin-top: 4px; }
.lb-tabs { display: flex; gap: 2px; padding: 0 32px; border-bottom: 1px solid ${COLORS.paperLine}; background: ${COLORS.panel}; flex-wrap: wrap; }
.lb-tab { padding: 12px 18px; font-size: 13.5px; cursor: pointer; border: none; background: transparent; color: ${COLORS.inkSoft}; border-bottom: 3px solid transparent; font-family: inherit; }
.lb-tab.active { color: ${COLORS.ink}; border-bottom: 3px solid ${COLORS.ledgerGreen}; font-weight: 600; }
.lb-body { padding: 26px 32px 60px; max-width: 1100px; }
.lb-panel { background: ${COLORS.white}; border: 1px solid ${COLORS.paperLine}; border-radius: 3px; padding: 20px 22px; margin-bottom: 20px; }
.lb-panel h3 { margin: 0 0 14px; font-family: Georgia, serif; font-size: 16px; border-bottom: 1px solid ${COLORS.paperLine}; padding-bottom: 8px; }
.lb-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.lb-field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: ${COLORS.inkSoft}; flex: 1; min-width: 140px; }
.lb-field input, .lb-field select { font-family: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid ${COLORS.paperLine}; border-radius: 2px; background: ${COLORS.white}; color: ${COLORS.ink}; }
.lb-field input:focus, .lb-field select:focus { outline: 2px solid ${COLORS.ledgerGreen}; outline-offset: 1px; }
.lb-btn { font-family: inherit; font-size: 13.5px; padding: 9px 16px; border-radius: 2px; border: 1px solid ${COLORS.ink}; background: ${COLORS.ink}; color: ${COLORS.white}; cursor: pointer; }
.lb-btn:hover { background: ${COLORS.ledgerGreen}; border-color: ${COLORS.ledgerGreen}; }
.lb-btn.secondary { background: transparent; color: ${COLORS.ink}; }
.lb-btn.secondary:hover { background: ${COLORS.ledgerGreenSoft}; }
.lb-btn.danger { background: transparent; color: ${COLORS.rust}; border-color: ${COLORS.rust}; }
.lb-btn.danger:hover { background: ${COLORS.rustSoft}; }
.lb-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.lb-table th { text-align: left; font-weight: 600; padding: 8px 10px; border-bottom: 2px solid ${COLORS.ink}; color: ${COLORS.inkSoft}; font-size: 11.5px; letter-spacing: 0.3px; }
.lb-table td { padding: 9px 10px; border-bottom: 1px solid ${COLORS.paperLine}; }
.lb-table tr:hover td { background: ${COLORS.panel}; }
.lb-num { text-align: right; }
.lb-tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.lb-tag.ok { background: ${COLORS.ledgerGreenSoft}; color: ${COLORS.ledgerGreen}; }
.lb-tag.warn { background: ${COLORS.rustSoft}; color: ${COLORS.rust}; }
.lb-empty { text-align: center; padding: 40px 20px; color: ${COLORS.inkSoft}; font-size: 14px; }
.lb-guide-step { display: flex; gap: 14px; padding: 16px 0; border-bottom: 1px solid ${COLORS.paperLine}; }
.lb-guide-num { font-family: Georgia, serif; font-size: 20px; color: ${COLORS.ledgerGreen}; min-width: 28px; }
.lb-guide-step h4 { margin: 0 0 6px; font-size: 14.5px; }
.lb-guide-step p { margin: 0; font-size: 13.5px; color: ${COLORS.inkSoft}; line-height: 1.55; }
.lb-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 12px; margin-bottom: 18px; }
.lb-summary-card { background: ${COLORS.panel}; border: 1px solid ${COLORS.paperLine}; border-radius: 3px; padding: 14px 16px; }
.lb-summary-card .lbl { font-size: 11px; color: ${COLORS.inkSoft}; text-transform: uppercase; letter-spacing: 0.4px; }
.lb-summary-card .val { font-family: 'IBM Plex Mono', monospace; font-size: 19px; margin-top: 4px; }
.lb-banner { background: ${COLORS.ledgerGreenSoft}; border: 1px solid ${COLORS.ledgerGreen}; padding: 10px 14px; border-radius: 3px; font-size: 13px; margin-bottom: 18px; color: ${COLORS.ledgerGreen}; }
.lb-checkbox { display:flex; align-items:center; gap:8px; font-size: 13px; color: ${COLORS.inkSoft}; }
`;

/* ---------- 4. Componente principal ---------- */
export default function App() {
  const [tab, setTab] = useState("empleados");
  const [empleados, setEmpleados] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [empresaExonerada, setEmpresaExonerada] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("libro-nomina-data", false);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          setEmpleados(data.empleados || []);
          setEntradas(data.entradas || []);
          setEmpresaExonerada(data.empresaExonerada ?? true);
        }
      } catch (e) {
        // no data yet
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        await window.storage.set(
          "libro-nomina-data",
          JSON.stringify({ empleados, entradas, empresaExonerada }),
          false
        );
        setSaveMsg("Guardado");
        setTimeout(() => setSaveMsg(""), 1500);
      } catch (e) {
        setSaveMsg("Error al guardar");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [empleados, entradas, empresaExonerada, loaded]);

  function exportarBackup() {
    const data = { empleados, entradas, empresaExonerada, exportadoEl: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `backup-nomina-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importarBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        setEmpleados(data.empleados || []);
        setEntradas(data.entradas || []);
        setEmpresaExonerada(data.empresaExonerada ?? true);
      } catch {
        alert("El archivo no tiene un formato válido.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="lb-root">
      <style>{css}</style>
      <div className="lb-header">
        <div>
          <p className="lb-title">Libro de Nómina — Colombia 2026</p>
          <p className="lb-sub">Empleados · Registro de horas · Liquidación · Guía de uso</p>
        </div>
        <div style={{ fontSize: 12, color: COLORS.inkSoft }}>{saveMsg}</div>
      </div>

      <div className="lb-tabs">
        {[
          ["empleados", "Empleados"],
          ["horas", "Registro de horas"],
          ["liquidacion", "Liquidar nómina"],
          ["respaldo", "Respaldo de datos"],
          ["guia", "Guía de uso"],
        ].map(([key, label]) => (
          <button key={key} className={`lb-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="lb-body">
        {tab === "empleados" && (
          <EmpleadosTab
            empleados={empleados} setEmpleados={setEmpleados}
            empresaExonerada={empresaExonerada} setEmpresaExonerada={setEmpresaExonerada}
          />
        )}
        {tab === "horas" && (
          <HorasTab empleados={empleados} entradas={entradas} setEntradas={setEntradas} />
        )}
        {tab === "liquidacion" && (
          <LiquidacionTab empleados={empleados} entradas={entradas} empresaExonerada={empresaExonerada} />
        )}
        {tab === "respaldo" && (
          <RespaldoTab onExportar={exportarBackup} onImportar={importarBackup} empleados={empleados} entradas={entradas} />
        )}
        {tab === "guia" && <GuiaTab />}
      </div>
    </div>
  );
}

/* ---------- 5. Tab: Empleados ---------- */
function EmpleadosTab({ empleados, setEmpleados, empresaExonerada, setEmpresaExonerada }) {
  const [form, setForm] = useState(null);

  function nuevo() {
    setForm({ id: uid(), nombre: "", cedula: "", salario: "", claseRiesgo: "I", fechaIngreso: "" });
  }
  function guardar() {
    if (!form.nombre || !form.salario) return;
    setEmpleados((prev) => {
      const existe = prev.some((e) => e.id === form.id);
      return existe ? prev.map((e) => (e.id === form.id ? form : e)) : [...prev, form];
    });
    setForm(null);
  }
  function eliminar(id) {
    if (confirm("¿Eliminar este empleado? Esto no borra sus registros de horas ya guardados.")) {
      setEmpleados((prev) => prev.filter((e) => e.id !== id));
    }
  }

  return (
    <>
      <div className="lb-banner">
        La empresa está {empresaExonerada ? "marcada" : "NO marcada"} como exonerada de aportes (Ley 1607 de 2012) para empleados que ganan menos de 10 SMMLV. Verifica esta condición con tu contador si no estás seguro.
        <label className="lb-checkbox" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={empresaExonerada} onChange={(e) => setEmpresaExonerada(e.target.checked)} />
          Mi empresa aplica la exoneración Ley 1607
        </label>
      </div>

      <div className="lb-panel">
        <h3>Empleados registrados</h3>
        {empleados.length === 0 ? (
          <div className="lb-empty">Aún no hay empleados. Agrega el primero para empezar a registrar horas.</div>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th>Nombre</th><th>Cédula</th><th>Clase riesgo ARL</th><th className="lb-num">Salario mensual</th><th></th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((e) => (
                <tr key={e.id}>
                  <td>{e.nombre}</td>
                  <td>{e.cedula || "—"}</td>
                  <td>{e.claseRiesgo}</td>
                  <td className="lb-num lb-mono">{fmt(Number(e.salario))}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="lb-btn secondary" onClick={() => setForm(e)}>Editar</button>
                    <button className="lb-btn danger" onClick={() => eliminar(e.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 14 }}>
          <button className="lb-btn" onClick={nuevo}>+ Agregar empleado</button>
        </div>
      </div>

      {form && (
        <div className="lb-panel">
          <h3>{empleados.some((e) => e.id === form.id) ? "Editar empleado" : "Nuevo empleado"}</h3>
          <div className="lb-row">
            <div className="lb-field">
              <label>Nombre completo</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="lb-field">
              <label>Cédula</label>
              <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
            </div>
          </div>
          <div className="lb-row">
            <div className="lb-field">
              <label>Salario mensual (COP)</label>
              <input type="number" value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} />
            </div>
            <div className="lb-field">
              <label>Clase de riesgo ARL</label>
              <select value={form.claseRiesgo} onChange={(e) => setForm({ ...form, claseRiesgo: e.target.value })}>
                {CLASES_RIESGO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="lb-field">
              <label>Fecha de ingreso</label>
              <input type="date" value={form.fechaIngreso} onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="lb-btn" onClick={guardar}>Guardar</button>
            <button className="lb-btn secondary" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- 6. Tab: Registro de horas ---------- */
function HorasTab({ empleados, entradas, setEntradas }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [empId, setEmpId] = useState(empleados[0]?.id || "");
  const [f, setF] = useState({
    fecha: hoy, horasExtraDiurna: "", horasExtraNocturna: "",
    horasRecargoNocturno: "", horasDominicalFestivo: "", ausente: false,
  });

  useEffect(() => {
    if (!empId && empleados[0]) setEmpId(empleados[0].id);
  }, [empleados]);

  function agregar() {
    if (!empId) return;
    const nueva = {
      id: uid(), empleadoId: empId, fecha: f.fecha,
      horasExtraDiurna: Number(f.horasExtraDiurna) || 0,
      horasExtraNocturna: Number(f.horasExtraNocturna) || 0,
      horasRecargoNocturno: Number(f.horasRecargoNocturno) || 0,
      horasDominicalFestivo: Number(f.horasDominicalFestivo) || 0,
      ausente: f.ausente,
    };
    setEntradas((prev) => [...prev, nueva]);
    setF({ ...f, horasExtraDiurna: "", horasExtraNocturna: "", horasRecargoNocturno: "", horasDominicalFestivo: "", ausente: false });
  }

  function eliminar(id) {
    setEntradas((prev) => prev.filter((e) => e.id !== id));
  }

  const entradasEmpleado = entradas
    .filter((e) => e.empleadoId === empId)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  if (empleados.length === 0) {
    return <div className="lb-empty">Primero agrega al menos un empleado en la pestaña "Empleados".</div>;
  }

  return (
    <>
      <div className="lb-panel">
        <h3>Registrar novedad de tiempo</h3>
        <div className="lb-row">
          <div className="lb-field">
            <label>Empleado</label>
            <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div className="lb-field">
            <label>Fecha</label>
            <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </div>
        </div>
        <div className="lb-row">
          <div className="lb-field">
            <label>Horas extra diurnas (+25%)</label>
            <input type="number" min="0" value={f.horasExtraDiurna} onChange={(e) => setF({ ...f, horasExtraDiurna: e.target.value })} />
          </div>
          <div className="lb-field">
            <label>Horas extra nocturnas (+75%)</label>
            <input type="number" min="0" value={f.horasExtraNocturna} onChange={(e) => setF({ ...f, horasExtraNocturna: e.target.value })} />
          </div>
          <div className="lb-field">
            <label>Horas recargo nocturno ordinario (+35%)</label>
            <input type="number" min="0" value={f.horasRecargoNocturno} onChange={(e) => setF({ ...f, horasRecargoNocturno: e.target.value })} />
          </div>
          <div className="lb-field">
            <label>Horas dominical/festivo (+75%)</label>
            <input type="number" min="0" value={f.horasDominicalFestivo} onChange={(e) => setF({ ...f, horasDominicalFestivo: e.target.value })} />
          </div>
        </div>
        <label className="lb-checkbox" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={f.ausente} onChange={(e) => setF({ ...f, ausente: e.target.checked })} />
          Este día fue una ausencia no remunerada (descuenta 1 día de salario)
        </label>
        <button className="lb-btn" onClick={agregar}>Agregar registro</button>
      </div>

      <div className="lb-panel">
        <h3>Historial — {empleados.find((e) => e.id === empId)?.nombre}</h3>
        {entradasEmpleado.length === 0 ? (
          <div className="lb-empty">Sin registros todavía para este empleado.</div>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th>Fecha</th><th className="lb-num">Extra diurna</th><th className="lb-num">Extra nocturna</th>
                <th className="lb-num">Recargo noct.</th><th className="lb-num">Dom/Festivo</th><th>Ausencia</th><th></th>
              </tr>
            </thead>
            <tbody>
              {entradasEmpleado.map((e) => (
                <tr key={e.id}>
                  <td>{e.fecha}</td>
                  <td className="lb-num lb-mono">{e.horasExtraDiurna || "—"}</td>
                  <td className="lb-num lb-mono">{e.horasExtraNocturna || "—"}</td>
                  <td className="lb-num lb-mono">{e.horasRecargoNocturno || "—"}</td>
                  <td className="lb-num lb-mono">{e.horasDominicalFestivo || "—"}</td>
                  <td>{e.ausente ? <span className="lb-tag warn">Ausente</span> : "—"}</td>
                  <td><button className="lb-btn danger" onClick={() => eliminar(e.id)}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ---------- 7. Tab: Liquidación ---------- */
function LiquidacionTab({ empleados, entradas, empresaExonerada }) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [anio, setAnio] = useState(now.getFullYear());
  const [expandido, setExpandido] = useState(null);

  const resultados = useMemo(() => {
    return empleados.map((emp) => {
      const entradasMes = entradas.filter((e) => {
        const d = new Date(e.fecha + "T00:00:00");
        return e.empleadoId === emp.id && d.getMonth() === mes && d.getFullYear() === anio;
      });
      return { empleado: emp, calculo: liquidarEmpleado(emp, entradasMes, empresaExonerada) };
    });
  }, [empleados, entradas, mes, anio, empresaExonerada]);

  const totales = resultados.reduce(
    (acc, r) => ({
      neto: acc.neto + r.calculo.netoPagar,
      costoEmpleador: acc.costoEmpleador + r.calculo.costoTotalEmpleador,
    }),
    { neto: 0, costoEmpleador: 0 }
  );

  if (empleados.length === 0) {
    return <div className="lb-empty">Agrega empleados y registra sus horas antes de liquidar.</div>;
  }

  return (
    <>
      <div className="lb-row">
        <div className="lb-field">
          <label>Mes a liquidar</label>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {mesesES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>
        <div className="lb-field">
          <label>Año</label>
          <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </div>
      </div>

      <div className="lb-summary-grid">
        <div className="lb-summary-card">
          <div className="lbl">Empleados liquidados</div>
          <div className="val">{empleados.length}</div>
        </div>
        <div className="lb-summary-card">
          <div className="lbl">Total neto a pagar</div>
          <div className="val lb-mono">{fmt(totales.neto)}</div>
        </div>
        <div className="lb-summary-card">
          <div className="lbl">Costo total empleador</div>
          <div className="val lb-mono">{fmt(totales.costoEmpleador)}</div>
        </div>
      </div>

      <div className="lb-panel">
        <h3>Detalle por empleado — {mesesES[mes]} {anio}</h3>
        <table className="lb-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th className="lb-num">Devengado</th>
              <th className="lb-num">Deducciones</th>
              <th className="lb-num">Neto a pagar</th>
              <th>Retención</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {resultados.map(({ empleado, calculo }) => (
              <>
                <tr key={empleado.id}>
                  <td>{empleado.nombre}</td>
                  <td className="lb-num lb-mono">{fmt(calculo.totalDevengado)}</td>
                  <td className="lb-num lb-mono">{fmt(calculo.saludEmpleado + calculo.pensionEmpleado)}</td>
                  <td className="lb-num lb-mono">{fmt(calculo.netoPagar)}</td>
                  <td>
                    {calculo.superaUmbralRetencion
                      ? <span className="lb-tag warn">Revisar tabla Art. 383</span>
                      : <span className="lb-tag ok">No aplica</span>}
                  </td>
                  <td>
                    <button className="lb-btn secondary" onClick={() => setExpandido(expandido === empleado.id ? null : empleado.id)}>
                      {expandido === empleado.id ? "Ocultar" : "Ver detalle"}
                    </button>
                  </td>
                </tr>
                {expandido === empleado.id && (
                  <tr key={empleado.id + "-detalle"}>
                    <td colSpan={6}>
                      <DetalleLiquidacion c={calculo} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DetalleLiquidacion({ c }) {
  const Fila = ({ label, val }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
      <span style={{ color: COLORS.inkSoft }}>{label}</span>
      <span className="lb-mono">{fmt(val)}</span>
    </div>
  );
  return (
    <div style={{ background: COLORS.panel, padding: 16, borderRadius: 3, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>DEVENGADO DEL EMPLEADO</div>
        <Fila label="Salario base" val={c.salario} />
        <Fila label="Auxilio de transporte" val={c.auxilioTransporte} />
        <Fila label="Extras diurnas" val={c.totalExtraDiurna} />
        <Fila label="Extras nocturnas" val={c.totalExtraNocturna} />
        <Fila label="Recargo nocturno" val={c.totalNocturno} />
        <Fila label="Dominical/festivo" val={c.totalDomFest} />
        <Fila label={`Ausencias (${c.diasAusencia} día(s))`} val={-c.descuentoAusencias} />
        <Fila label="Salud empleado (4%)" val={-c.saludEmpleado} />
        <Fila label="Pensión empleado (4%)" val={-c.pensionEmpleado} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>COSTO DEL EMPLEADOR (informativo)</div>
        <Fila label={`Salud empleador ${c.exonerado ? "(exonerado)" : "(8,5%)"}`} val={c.saludEmpleador} />
        <Fila label="Pensión empleador (12%)" val={c.pensionEmpleador} />
        <Fila label="ARL" val={c.arl} />
        <Fila label="Caja de compensación (4%)" val={c.caja} />
        <Fila label={`SENA ${c.exonerado ? "(exonerado)" : "(2%)"}`} val={c.sena} />
        <Fila label={`ICBF ${c.exonerado ? "(exonerado)" : "(3%)"}`} val={c.icbf} />
        <Fila label="Provisión cesantías" val={c.provisionCesantias} />
        <Fila label="Provisión int. cesantías" val={c.provisionInteresesCesantias} />
        <Fila label="Provisión prima" val={c.provisionPrima} />
        <Fila label="Provisión vacaciones" val={c.provisionVacaciones} />
      </div>
    </div>
  );
}

/* ---------- 8. Tab: Respaldo ---------- */
function RespaldoTab({ onExportar, onImportar, empleados, entradas }) {
  return (
    <div className="lb-panel">
      <h3>Respaldo de datos</h3>
      <p style={{ fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 1.6 }}>
        Tus datos ({empleados.length} empleado(s), {entradas.length} registro(s) de horas) se guardan automáticamente
        cada vez que haces un cambio. Además, descarga un respaldo periódicamente y súbelo a tu Google Drive como
        copia de seguridad independiente — así tienes tus datos disponibles incluso si algo falla aquí.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button className="lb-btn" onClick={onExportar}>Descargar respaldo (.json)</button>
        <label className="lb-btn secondary" style={{ cursor: "pointer" }}>
          Restaurar desde respaldo
          <input type="file" accept="application/json" onChange={onImportar} style={{ display: "none" }} />
        </label>
      </div>
      <div className="lb-banner" style={{ marginTop: 18 }}>
        Recomendación: después de descargar el archivo, arrástralo a la carpeta de tu Google Drive (por ejemplo
        "Nómina/Backups/") desde tu navegador o la app de Drive. Hazlo cada vez que liquides un mes.
      </div>
    </div>
  );
}

/* ---------- 9. Tab: Guía ---------- */
function GuiaTab() {
  const pasos = [
    { t: "1. Configura tu empresa", d: "En la pestaña Empleados, revisa el aviso superior y marca la casilla de exoneración Ley 1607 solo si tu contador confirma que aplica a tu empresa." },
    { t: "2. Registra a tus empleados", d: "Agrega cada empleado con su salario mensual y clase de riesgo ARL (pregunta a tu ARL cuál corresponde a la actividad de cada cargo si no la sabes)." },
    { t: "3. Registra novedades de tiempo durante el mes", d: "Cada vez que un empleado tenga horas extra, recargos nocturnos, trabajo dominical/festivo o una ausencia, agrégalo el mismo día en la pestaña Registro de horas. No necesitas registrar los días normales sin novedad." },
    { t: "4. Liquida al final del mes", d: "En Liquidar nómina, elige el mes y revisa el detalle de cada empleado. La columna 'Retención' te avisa si algún salario superó el umbral y necesitas aplicar la tabla de retención en la fuente manualmente o con tu contador." },
    { t: "5. Descarga tu respaldo", d: "Después de cada liquidación, ve a Respaldo de datos y descarga el archivo .json. Súbelo a una carpeta en tu Google Drive. Esto te protege si necesitas restaurar la información." },
  ];
  return (
    <div className="lb-panel">
      <h3>Cómo administrar este sistema</h3>
      {pasos.map((p) => (
        <div className="lb-guide-step" key={p.t}>
          <div className="lb-guide-num">{p.t.split(".")[0]}</div>
          <div>
            <h4>{p.t.split(". ")[1]}</h4>
            <p>{p.d}</p>
          </div>
        </div>
      ))}
      <div className="lb-banner" style={{ marginTop: 18 }}>
        Importante: este sistema aplica las reglas generales del Código Sustantivo del Trabajo y la normativa vigente
        en 2026, pero no reemplaza la revisión de un contador o abogado laboral para casos particulares (salario
        integral, contratos especiales, convenciones colectivas, incapacidades, licencias).
      </div>
    </div>
  );
}
