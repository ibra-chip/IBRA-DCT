import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';

import type { ValidationTask } from '../../lib/api-types';
import { EmptyState } from '../ui/EmptyState';

interface ValidationQueueProps {
  tasks: ValidationTask[];
}

export function ValidationQueue({ tasks }: ValidationQueueProps) {
  if (!tasks.length) {
    return <EmptyState title="Aucune validation à afficher." description="Les contrôles nécessitant votre attention apparaîtront ici." icon={<CheckCircle2 size={20} />} />;
  }

  return (
    <div className="validation-queue">
      {tasks.slice(0, 6).map((task) => (
        <Link className="validation-row" href={`/projects/${encodeURIComponent(task.projectId)}/quality`} key={task.id}>
          <span className="validation-marker" aria-hidden="true" />
          <span>
            <strong>{task.title}</strong>
            <small>{task.projectName}{task.assignedTo ? ` · ${task.assignedTo}` : ''}</small>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
