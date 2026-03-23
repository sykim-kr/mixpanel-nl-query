import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartData } from '../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

interface ChartPanelProps {
  chart: ChartData;
}

const COLORS = ['#000000', '#FF0000', '#666666', '#999999', '#333333'];

export default function ChartPanel({ chart }: ChartPanelProps) {
  const data = {
    labels: chart.labels,
    datasets: chart.datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: chart.type === 'bar'
        ? COLORS[i % COLORS.length]
        : 'transparent',
      borderWidth: 2,
      pointRadius: 3,
      tension: 0,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: { family: 'Helvetica Neue, Helvetica, Arial, sans-serif', size: 12 },
          boxWidth: 12,
          padding: 16,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        grid: { color: '#E0E0E0' },
        ticks: { font: { size: 11 } },
      },
    },
  };

  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
        차트
      </h3>
      <div style={{ height: '300px' }}>
        {chart.type === 'line' ? <Line data={data} options={options} /> : <Bar data={data} options={options} />}
      </div>
    </div>
  );
}
