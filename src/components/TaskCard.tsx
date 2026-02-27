'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Task } from '@/types';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="mb-4 cursor-grab active:cursor-grabbing">
        <CardHeader className="p-4">
          <CardTitle className="text-base">{task.title}</CardTitle>
        </CardHeader>
        {task.description && (
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">{task.description}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
