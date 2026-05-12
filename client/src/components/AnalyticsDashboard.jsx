import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// How many sample points we keep on each chart
const MAX_POINTS = 50;

// Reads the live bodies and plots two rolling line charts:
// average velocity and total kinetic energy.
export default function AnalyticsDashboard({ bodies, onHistoryUpdate }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (onHistoryUpdate) onHistoryUpdate(history);
  }, [history, onHistoryUpdate]);

  useEffect(() => {
    if (!bodies) return;

    // We only care about dynamic (non-static) bodies for energy/velocity
    const dynamic = bodies.filter((b) => !b.isStatic);

    // Total KE = sum( 0.5 * m * v^2 )
    const totalKE = dynamic.reduce((sum, b) => {
      const vSq = b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y;
      return sum + 0.5 * b.mass * vSq;
    }, 0);

    // Average speed across dynamic bodies
    const avgSpeed = dynamic.length
      ? dynamic.reduce(
          (sum, b) => sum + Math.hypot(b.velocity.x, b.velocity.y),
          0
        ) / dynamic.length
      : 0;

    setHistory((prev) => {
      const t = prev.length ? prev[prev.length - 1].t + 1 : 0;
      const next = [
        ...prev,
        { t, v: +avgSpeed.toFixed(2), ke: +totalKE.toFixed(2) }
      ];
      // Keep only the most recent MAX_POINTS samples
      return next.slice(-MAX_POINTS);
    });
  }, [bodies]);

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Analytics
      </h3>

      {history.length < 2 ? (
        <div className="rounded border border-dashed border-gray-800 bg-gray-950 p-4 text-center text-xs text-gray-500">
          Add a body and press <span className="text-gray-300">Play</span> to start
          collecting velocity and energy data.
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-400 mb-1">Average velocity (px/tick)</div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid #374151',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="text-xs text-gray-400 mt-3 mb-1">Total kinetic energy</div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid #374151',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line
                type="monotone"
                dataKey="ke"
                stroke="#f472b6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
