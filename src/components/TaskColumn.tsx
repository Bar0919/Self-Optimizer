'use client';

import { useDroppable } from '@dnd-kit/core';
import { Task, TaskStatus } from '@/types';
import { TaskCard } from './TaskCard';

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
}

export function TaskColumn({ status, title, tasks }: TaskColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 rounded-lg bg-secondary/50 p-4"
    >
      <h2 className="text-lg font-semibold mb-4 text-center">{title}</h2>
      <div className="space-y-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
