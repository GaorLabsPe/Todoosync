import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  Activity, Database, RefreshCw, Settings, Plus, 
  AlertCircle, CheckCircle2, ChevronRight, Search,
  LayoutDashboard, Link as LinkIcon, History, Key, LogOut,
  Globe, Server, User as UserIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Paleta Odoo 19 Light ─────────────────────────────────────────────────────
const C = {
  bg:          '#F0EEF3',
  surface:     '#FFFFFF',
  border:      '#E4E0EB',
  borderMed:   '#CEC8D8',
  text:        '#1C1726',
  textSub:     '#5C5570',
  textMuted:   '#9B93AD',
  brand:       '#714B67',
  brandLight:  '#F5EFF3',
  brandMid:    '#9C6B8F',
  teal:        '#017E84',
  tealLight:   '#E5F4F5',
  orange:      '#E07316',
  orangeLight: '#FEF3E7',
  green:       '#1F7D53',
  greenLight:  '#E7F5EF',
  red:         '#C0392B',
  redLight:    '#FDEDEB',
  yellow:      '#D97706',
  yellowLight: '#FEF9E7',
}

// --- Types ---
interface Connection {
  id: string;
  name: string;
  base_url: string;
  database: string;
  username: string;
  odoo_version: number;
  status?: string;
}

interface Cierre {
  id: string;
  fecha: string;
  total_monto: number;
  conteo_tickets: number;
  pos_id: number;
  pos_nombre: string;
  connection_id: string;
  connections: { name: string };
  pagos?: any;
  productos?: any;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const color = status === 'ok' || status === 'connected' ? C.green
    : status === 'warning' ? C.yellow : C.red;
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}88`, flexShrink: 0 }} />;
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color }}>{label}</span>;
}

function Card({ children, style = {}, className = "" }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(113,75,103,0.04)', ...style }}>
      {children}
    </div>
  );
}

const formatSoles = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 0 }).format(n);

// ─── Modal Nueva Conexión ─────────────────────────────────────────────────────
function ModalNuevaConexion({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [form, setForm] = useState({
    name: '', base_url: '', database: '', username: '', api_key: '', odoo_version: 17,
  });
  const [step, setStep] = useState<'form' | 'testing' | 'companies'>('form');
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/odoo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies);
        setSelectedCompanyIds(data.companies.map((c: any) => c.id));
        setStep('companies');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert('Error connecting to Odoo');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave({ ...form, company_ids: selectedCompanyIds });
      onClose();
    } catch (err) {
      alert('Error saving connection');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (id: number) => {
    setSelectedCompanyIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(28,23,38,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: C.surface, borderRadius: 18, padding: '32px', width: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, margin: 0 }}>
              {step === 'companies' ? 'Seleccionar Compañías' : 'Nueva Conexión Odoo'}
            </h2>
            <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>
              {step === 'companies' ? 'Elige qué compañías sincronizar' : 'Ingresa las credenciales de tu instancia'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleTest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', color: C.textSub, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Nombre de la conexión</label>
              <input
                required
                placeholder="Ej: Clínica San José"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${C.borderMed}`, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: C.textSub, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>URL de Odoo</label>
              <input
                required
                type="url"
                placeholder="https://miempresa.odoo.com"
                value={form.base_url}
                onChange={e => setForm(prev => ({ ...prev, base_url: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${C.borderMed}`, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', color: C.textSub, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Base de datos</label>
                <input
                  required
                  placeholder="miempresa_prod"
                  value={form.database}
                  onChange={e => setForm(prev => ({ ...prev, database: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${C.borderMed}`, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: C.textSub, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Versión</label>
                <select 
                  value={form.odoo_version}
                  onChange={e => setForm(prev => ({ ...prev, odoo_version: parseInt(e.target.value) }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${C.borderMed}`, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value={14}>Odoo 14</option>
                  <option value={17}>Odoo 17</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: C.textSub, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Usuario</label>
              <input
                required
                type="email"
                placeholder="admin@miempresa.com"
                value={form.username}
                onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${C.borderMed}`, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: C.textSub, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>API Key / Password</label>
              <input
                required
                type="password"
                placeholder="••••••••••••••••"
                value={form.api_key}
                onChange={e => setForm(prev => ({ ...prev, api_key: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${C.borderMed}`, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: C.bg, border: `1px solid ${C.borderMed}`, color: C.textSub, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg, ${C.brand}, ${C.brandMid})`, border: 'none', color: '#fff', cursor: 'pointer', boxShadow: `0 4px 12px ${C.brand}44`, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Verificando...' : 'Verificar y continuar →'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: C.greenLight, border: `1px solid ${C.green}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 className="w-5 h-5 text-green" />
              <div>
                <p style={{ color: C.green, fontWeight: 700, fontSize: 13, margin: 0 }}>Conexión exitosa</p>
                <p style={{ color: C.textMuted, fontSize: 12, margin: '2px 0 0' }}>Se encontraron {companies.length} compañías disponibles</p>
              </div>
            </div>

            <p style={{ color: C.textSub, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>SELECCIONA LAS COMPAÑÍAS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '250px', overflowY: 'auto', padding: '4px' }}>
              {companies.map(c => (
                <div key={c.id} onClick={() => toggleCompany(c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${selectedCompanyIds.includes(c.id) ? C.brand : C.border}`,
                  background: selectedCompanyIds.includes(c.id) ? C.brandLight : C.bg,
                  transition: 'all 0.12s',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 5,
                    border: `2px solid ${selectedCompanyIds.includes(c.id) ? C.brand : C.borderMed}`,
                    background: selectedCompanyIds.includes(c.id) ? C.brand : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, flexShrink: 0,
                  }}>{selectedCompanyIds.includes(c.id) ? '✓' : ''}</div>
                  <div>
                    <p style={{ color: C.text, fontWeight: 600, fontSize: 13, margin: 0 }}>{c.name}</p>
                    <p style={{ color: C.textMuted, fontSize: 11, margin: '2px 0 0' }}>ID: {c.id}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={() => setStep('form')} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: C.bg, border: `1px solid ${C.borderMed}`, color: C.textSub, cursor: 'pointer' }}>← Volver</button>
              <button onClick={handleSave} disabled={loading || selectedCompanyIds.length === 0} style={{ flex: 2, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg, ${C.brand}, ${C.brandMid})`, border: 'none', color: '#fff', cursor: 'pointer', boxShadow: `0 4px 12px ${C.brand}44`, opacity: (loading || selectedCompanyIds.length === 0) ? 0.7 : 1 }}>
                {loading ? 'Guardando...' : 'Guardar conexión ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  conexiones, selectedConn, setSelectedConn,
  activeSection, setActiveSection, onNuevaConexion, onLogout
}: {
  conexiones: Connection[]
  selectedConn: string | null; setSelectedConn: (id: string) => void
  activeSection: string; setActiveSection: (s: string) => void
  onNuevaConexion: () => void
  onLogout: () => void
}) {
  const sections = [
    { id: 'dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
    { id: 'sync',       icon: <RefreshCw className="w-4 h-4" />, label: 'Sync Jobs'  },
    { id: 'api',        icon: <Key className="w-4 h-4" />, label: 'API Keys'  },
  ];

  return (
    <aside style={{
      width: 260, minHeight: '100vh', flexShrink: 0,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      boxShadow: '2px 0 8px rgba(113,75,103,0.06)',
      overflowY: 'auto',
      fontFamily: 'var(--font-nunito)'
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.brand}, ${C.brandMid})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fff', boxShadow: `0 4px 10px ${C.brand}55` }}>⚡</div>
          <div>
            <p style={{ color: C.text, fontWeight: 800, fontSize: 14, margin: 0, letterSpacing: '-0.02em' }}>OdooSync</p>
            <p style={{ color: C.textMuted, fontSize: 10, margin: 0, letterSpacing: '0.1em', fontWeight: 600 }}>PLATFORM</p>
          </div>
        </div>
      </div>

      {/* Bases de datos / Conexiones */}
      <div style={{ padding: '14px 10px 6px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px', marginBottom: 8 }}>
          <p style={{ color: C.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', margin: 0 }}>CONEXIONES</p>
          <button onClick={onNuevaConexion} style={{ background: C.brandLight, border: `1px solid ${C.brand}33`, color: C.brand, borderRadius: 6, fontSize: 15, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, lineHeight: 1 }}>+</button>
        </div>

        {conexiones.map(conn => (
          <button
            key={conn.id}
            onClick={() => {
              setSelectedConn(conn.id);
              setActiveSection('dashboard');
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: selectedConn === conn.id && activeSection === 'dashboard' ? C.brandLight : 'transparent',
              borderLeft: `3px solid ${selectedConn === conn.id && activeSection === 'dashboard' ? C.brand : 'transparent'}`,
              transition: 'all 0.12s',
              marginBottom: 2
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: C.brandLight,
              border: `1px solid ${C.brand}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
            }}><Server className="w-3.5 h-3.5 text-brand" /></div>
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <p style={{ color: C.text, fontSize: 12, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conn.name}</p>
              <p style={{ color: C.textMuted, fontSize: 10, margin: 0 }}>v{conn.odoo_version} · {conn.database}</p>
            </div>
            <StatusDot status="connected" />
          </button>
        ))}

        {/* Separador */}
        <div style={{ height: 1, background: C.border, margin: '12px 6px' }} />

        {/* Secciones globales */}
        <p style={{ color: C.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '0 6px', marginBottom: 6 }}>MENÚ</p>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeSection === s.id ? C.brandLight : 'transparent',
            color: activeSection === s.id ? C.brand : C.textSub,
            fontWeight: activeSection === s.id ? 700 : 500, fontSize: 13, textAlign: 'left',
            borderLeft: `3px solid ${activeSection === s.id ? C.brand : 'transparent'}`,
            marginBottom: 2, transition: 'all 0.12s',
          }}>
            <span style={{ fontSize: 14, width: 18, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Footer Sidebar */}
      <div style={{ padding: '0 12px 18px', flexShrink: 0 }}>
        <button 
          onClick={onLogout}
          style={{
            width: '100%', padding: '10px', borderRadius: 10, background: C.redLight, border: `1px solid ${C.red}33`,
            color: C.red, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer'
          }}
        >
          <LogOut className="w-4 h-4" /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ conn, cierres, onSync }: { conn: Connection | null; cierres: Cierre[]; onSync: (id: string) => void }) {
  const filteredCierres = conn ? cierres.filter(c => c.connection_id === conn.id) : cierres;
  
  const totalVentas = filteredCierres.reduce((sum, c) => sum + c.total_monto, 0);
  const totalTickets = filteredCierres.reduce((sum, c) => sum + c.conteo_tickets, 0);

  // Chart data (last 7 days, grouped by date)
  const dailyData = filteredCierres.reduce((acc: any, curr) => {
    const existing = acc.find((a: any) => a.fecha === curr.fecha);
    if (existing) {
      existing.total_monto += curr.total_monto;
    } else {
      acc.push({ fecha: curr.fecha, total_monto: curr.total_monto });
    }
    return acc;
  }, []).slice(0, 7).reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontFamily: 'var(--font-nunito)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ color: C.text, fontSize: 21, fontWeight: 800, margin: 0 }}>
              {conn ? conn.name : 'Vista General'}
            </h1>
            {conn && <Badge label="Conectado" color={C.green} bg={C.greenLight} />}
          </div>
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
            {conn ? `${conn.base_url} · Odoo v${conn.odoo_version}` : 'Resumen de todas las instancias conectadas'}
          </p>
        </div>
        {conn && (
          <button 
            onClick={() => onSync(conn.id)}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg, ${C.brand}, ${C.brandMid})`, border: 'none', color: '#fff', cursor: 'pointer', boxShadow: `0 4px 12px ${C.brand}44`, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw className="w-4 h-4" /> Sincronizar ahora
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Card>
          <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Ventas Totales</p>
          <p style={{ color: C.text, fontSize: 26, fontWeight: 800, margin: 0 }}>{formatSoles(totalVentas)}</p>
          <p style={{ color: C.green, fontSize: 12, marginTop: 6, fontWeight: 700 }}>
            Sincronizado con Supabase
          </p>
        </Card>
        <Card>
          <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Total Tickets</p>
          <p style={{ color: C.text, fontSize: 26, fontWeight: 800, margin: 0 }}>{totalTickets}</p>
          <p style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>Prom. {formatSoles(totalTickets ? totalVentas / totalTickets : 0)}</p>
        </Card>
        <Card>
          <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Última Actividad</p>
          <p style={{ color: C.text, fontSize: 26, fontWeight: 800, margin: 0 }}>{filteredCierres[0]?.fecha || '—'}</p>
          <p style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>{filteredCierres.length} sedes registradas</p>
        </Card>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Card>
          <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: '0 0 16px' }}>Ventas de la Semana</p>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.brand} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={C.brand} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="fecha" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `S/${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: 'var(--font-nunito)' }} formatter={(v: any) => [formatSoles(v), 'Ventas']} />
              <Area type="monotone" dataKey="total_monto" stroke={C.brand} strokeWidth={2.5} fill="url(#g1)" dot={{ fill: C.brand, r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: C.brand, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: '0 0 16px' }}>Distribución por Sede</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie 
                data={filteredCierres.length > 0 ? filteredCierres.slice(0, 5) : [{ pos_nombre: 'Sin datos', total_monto: 1 }]} 
                cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="total_monto" nameKey="pos_nombre" paddingAngle={5} strokeWidth={0}
              >
                {filteredCierres.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={[C.brand, C.teal, C.orange, C.green, C.brandMid][index % 5]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => formatSoles(v)} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: 'var(--font-nunito)' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {filteredCierres.slice(0, 3).map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 3, background: [C.brand, C.teal, C.orange][i] }} />
                  <span style={{ color: C.textSub, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{d.pos_nombre}</span>
                </div>
                <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{formatSoles(d.total_monto)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Table */}
      <Card>
        <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: '0 0 16px' }}>Resumen por Sede (Último Cierre)</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredCierres.slice(0, 5).map((sede: any, idx: number) => (
            <div key={idx} style={{ padding: '16px', border: `1px solid ${C.border}`, borderRadius: '12px', background: C.bg + '22' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 800, color: C.brand, fontSize: 15 }}>{sede.pos_nombre}</span>
                <Badge label={`${sede.conteo_tickets} pedidos`} color={C.teal} bg={C.tealLight} />
              </div>
              
              <div style={{ gridTemplateColumns: '1fr 1fr', display: 'grid', gap: 16 }}>
                <div>
                  <p style={{ color: C.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Métodos de Pago</p>
                  {sede.pagos && Object.entries(sede.pagos).map(([method, amount]: [string, any]) => (
                    <div key={method} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: C.textSub }}>{method}</span>
                      <span style={{ fontWeight: 700 }}>{formatSoles(amount)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ color: C.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Top Productos</p>
                  {sede.productos && sede.productos.slice(0, 5).map((prod: any, pIdx: number) => (
                    <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{prod.nombre}</span>
                      <span style={{ fontWeight: 700 }}>{prod.qty} un.</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>Total Sede</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.brand }}>{formatSoles(sede.total_monto)}</span>
              </div>
            </div>
          ))}
          {filteredCierres.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: C.textMuted, fontSize: 14 }}>No hay detalles de sedes disponibles. Sincroniza para obtener datos.</div>
          )}
        </div>
      </Card>

      <Card>
        <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: '0 0 16px' }}>Historial de Cierres (Supabase)</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr', padding: '10px 16px', background: C.bg, borderRadius: '8px 8px 0 0' }}>
            <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>SEDE</span>
            <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>CONEXIÓN</span>
            <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>FECHA</span>
            <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textAlign: 'right' }}>TOTAL</span>
          </div>
          {filteredCierres.slice(0, 15).map((c, i) => (
            <div key={c.id} style={{
              display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr', padding: '12px 16px',
              borderBottom: i === filteredCierres.length - 1 ? 'none' : `1px solid ${C.border}`,
              background: i % 2 === 0 ? 'transparent' : `${C.bg}33`
            }}>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{c.pos_nombre}</span>
              <span style={{ color: C.textSub, fontSize: 13 }}>{c.connections?.name}</span>
              <span style={{ color: C.textSub, fontSize: 13 }}>{c.fecha}</span>
              <span style={{ color: C.brand, fontSize: 13, fontWeight: 800, textAlign: 'right' }}>{formatSoles(c.total_monto)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loginError, setLoginError] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [connRes, cierresRes] = await Promise.all([
        fetch('/api/connections'),
        fetch('/api/cierres')
      ]);

      if (connRes.ok && cierresRes.ok) {
        setConnections(await connRes.json());
        setCierres(await cierresRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        fetchData();
      } else {
        setLoginError('Credenciales inválidas');
      }
    } catch (err) {
      setLoginError('Error al iniciar sesión');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerSync = async (id: string) => {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: id })
      });
      if (res.ok) {
        alert('Sincronización iniciada correctamente');
        fetchData();
      }
    } catch (err) {
      alert('Error al iniciar sincronización');
    }
  };

  const saveConnection = async (data: any) => {
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      fetchData();
    } else {
      throw new Error('Failed to save');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4 font-nunito" style={{ fontFamily: 'var(--font-nunito)' }}>
        <Card className="w-full max-w-md">
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${C.brand}, ${C.brandMid})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}>⚡</div>
              <h1 className="text-xl font-bold tracking-tight">OdooSync Platform</h1>
            </div>
            <p className="text-sm opacity-60">Ingresa tus credenciales para acceder.</p>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label style={{ color: C.textSub, fontSize: 12, fontWeight: 700 }}>Usuario</label>
                <input 
                  name="username"
                  type="text" 
                  required
                  className="bg-bg border border-border p-3 rounded-lg text-sm outline-none focus:border-brand"
                  placeholder="admin"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label style={{ color: C.textSub, fontSize: 12, fontWeight: 700 }}>Contraseña</label>
                <input 
                  name="password"
                  type="password" 
                  required
                  className="bg-bg border border-border p-3 rounded-lg text-sm outline-none focus:border-brand"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {loginError && (
              <div className="text-red-500 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" /> {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="bg-brand text-white p-3 rounded-lg font-bold uppercase text-xs tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-brand/20"
            >
              Iniciar Sesión
            </button>
          </form>
        </Card>
      </div>
    );
  }

  const selectedConn = connections.find(c => c.id === selectedConnId) || null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-nunito)' }}>
      {showModal && <ModalNuevaConexion onClose={() => setShowModal(false)} onSave={saveConnection} />}

      <Sidebar
        conexiones={connections}
        selectedConn={selectedConnId}
        setSelectedConn={setSelectedConnId}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onNuevaConexion={() => setShowModal(true)}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
        {activeSection === 'dashboard' && (
          <Dashboard conn={selectedConn} cierres={cierres} onSync={triggerSync} />
        )}
        {activeSection === 'sync' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Sync Jobs</h1>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', padding: '12px 20px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted }}>FECHA</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted }}>ESTADO</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted }}>MENSAJE</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textAlign: 'right' }}>CONEXIÓN</span>
              </div>
              <div style={{ padding: '40px', textAlign: 'center', color: C.textMuted }}>
                <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>El historial de sincronización se mostrará aquí.</p>
              </div>
            </Card>
          </div>
        )}
        {activeSection === 'api' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, margin: 0 }}>API Keys</h1>
            <Card style={{ border: `2px dashed ${C.borderMed}`, boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, flexDirection: 'column', gap: 10 }}>
              <Key className="w-10 h-10 opacity-20" />
              <p style={{ color: C.textMuted, fontSize: 14 }}>Administra tus claves de acceso para n8n o WhatsApp.</p>
              <button className="bg-brand text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest mt-2">Generar Nueva Clave</button>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
