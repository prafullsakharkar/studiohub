import React from 'react';
import { DashboardWidgetConfig } from '@/types/intelligence';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface WidgetCardProps {
  widget: DashboardWidgetConfig;
}

const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];

export const WidgetCard: React.FC<WidgetCardProps> = ({ widget }) => {
  const getSpanClass = () => {
    switch (widget.span) {
      case 'col-1':
        return 'col-span-1';
      case 'col-2':
        return 'col-span-1 lg:col-span-2';
      case 'col-3':
        return 'col-span-1 lg:col-span-3';
      case 'full':
        return 'col-span-full';
      default:
        return 'col-span-1 lg:col-span-2';
    }
  };

  const renderChart = () => {
    switch (widget.chart_type) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={widget.height || 260}>
            <AreaChart data={widget.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {(widget.data_keys || []).map((dk, idx) => (
                  <linearGradient key={dk.name} id={`grad-${widget.id}-${dk.name}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={dk.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={dk.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {(widget.data_keys || []).map((dk, idx) => (
                <Area
                  key={dk.name}
                  type="monotone"
                  dataKey={dk.name}
                  name={dk.label || dk.name}
                  stroke={dk.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                  fillOpacity={1}
                  fill={`url(#grad-${widget.id}-${dk.name})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={widget.height || 260}>
            <BarChart data={widget.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {(widget.data_keys || []).map((dk, idx) => (
                <Bar
                  key={dk.name}
                  dataKey={dk.name}
                  name={dk.label || dk.name}
                  fill={dk.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'horizontal_bar':
        return (
          <ResponsiveContainer width="100%" height={widget.height || 260}>
            <BarChart layout="vertical" data={widget.data} margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              {(widget.data_keys || []).map((dk, idx) => (
                <Bar
                  key={dk.name}
                  dataKey={dk.name}
                  name={dk.label || dk.name}
                  fill={dk.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                  radius={[0, 4, 4, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={widget.height || 260}>
            <LineChart data={widget.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {(widget.data_keys || []).map((dk, idx) => (
                <Line
                  key={dk.name}
                  type="monotone"
                  dataKey={dk.name}
                  name={dk.label || dk.name}
                  stroke={dk.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'donut':
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={widget.height || 260}>
            <PieChart>
              <Pie
                data={widget.data}
                cx="50%"
                cy="50%"
                innerRadius={widget.chart_type === 'donut' ? 60 : 0}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                nameKey="label"
              >
                {widget.data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="text-xs text-slate-400">Chart renderer pending</div>;
    }
  };

  return (
    <div
      id={`widget-${widget.id}`}
      className={`p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between space-y-3 ${getSpanClass()}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">{widget.title}</h4>
          {widget.subtitle && <p className="text-[11px] text-slate-400">{widget.subtitle}</p>}
        </div>
      </div>

      <div className="w-full flex-1 pt-1">{renderChart()}</div>
    </div>
  );
};
