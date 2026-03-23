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
    <select
      value={selectedProjectId}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        padding: 'var(--space-xs) var(--space-md)',
        border: '1px solid var(--border)',
        background: 'var(--white)',
        fontSize: '13px',
        minWidth: 220,
      }}
    >
      <option value="">Project 선택</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  );
}
