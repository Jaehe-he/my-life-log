import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export const PALETTE = ['#8a6539', '#3f7f6b', '#b8452f', '#4b6fa5', '#c49a3c', '#7b5a8c', '#5f8f3f', '#a8607a', '#6b7280', '#2f8f9d', '#b07a4a'];

type Series = { key: string; name: string; color?: string };
const axis = { fontSize: 11, fill: 'var(--muted)' };
const tip = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, color: 'var(--fg)' },
  labelStyle: { color: 'var(--muted)' },
  cursor: { fill: 'var(--accent-soft)', opacity: 0.5 },
};
const short = (n: number) => (Math.abs(n) >= 10000 ? `${Math.round(n / 1000) / 10}만` : String(n));

export function Bars({ data, x, series, height = 200, fmt, stacked }: {
  data: any[]; x: string; series: Series[]; height?: number; fmt?: (n: number) => string; stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={short} />
        <Tooltip {...tip} formatter={(v: any) => (fmt ? fmt(v) : v)} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color || PALETTE[i]} stackId={stacked ? 'a' : undefined} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, x, series, height = 200, fmt, target, domain }: {
  data: any[]; x: string; series: Series[]; height?: number; fmt?: (n: number) => string; target?: number | null; domain?: any;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={short} domain={domain || ['auto', 'auto']} />
        <Tooltip {...tip} cursor={{ stroke: 'var(--line)' }} formatter={(v: any) => (fmt ? fmt(v) : v)} />
        {target ? <ReferenceLine y={target} stroke="var(--pos)" strokeDasharray="4 4" label={{ value: '목표', fontSize: 11, fill: 'var(--pos)', position: 'insideTopRight' }} /> : null}
        {series.map((s, i) => (
          <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color || PALETTE[i]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, fmt, height = 200 }: { data: { name: string; value: number }[]; fmt?: (n: number) => string; height?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="donut">
      <div style={{ width: height, maxWidth: '100%', flex: 'none' }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="92%" paddingAngle={1} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...tip} formatter={(v: any) => (fmt ? fmt(v) : v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.name}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>{d.name}</span>
            <b>{fmt ? fmt(d.value) : d.value}</b>
            <em>{total ? Math.round((d.value / total) * 100) : 0}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
