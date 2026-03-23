import type { MixpanelProject } from '../types';

interface ProjectSelectorProps {
  projects: MixpanelProject[];
  selectedProjectId: string;
  onChange: (projectId: string) => void;
  disabled?: boolean;
}

export default function ProjectSelector({
  projects,
  selectedProjectId,
  onChange,
  disabled,
}: ProjectSelectorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#666',
        whiteSpace: 'nowrap',
      }}>
        프로젝트 선택
      </span>
      <select
        value={selectedProjectId}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: '6px 12px',
          border: '2px solid #ddd',
          borderRadius: 6,
          background: disabled ? '#fafafa' : '#fff',
          fontSize: '13px',
          fontWeight: 500,
          minWidth: 220,
          outline: 'none',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <option value="">-- 프로젝트를 선택하세요 --</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
