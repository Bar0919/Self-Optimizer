'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { Task, TaskStatus } from '@/types';
import { TaskColumn } from './TaskColumn';

// Dummy data for initial setup
const initialTasks: Task[] = [
  { id: 'task-1', title: 'UIデザインを設計する', description: 'Figmaでプロトタイプを作成', status: 'TODO' },
  { id: 'task-2', title: 'Tailwind CSSを設定する', status: 'TODO' },
  { id: 'task-3', title: 'カンバンボードのコンポーネントを作成', description: 'TaskCard, TaskColumn, TaskBoard', status: 'IN_PROGRESS' },
  { id: 'task-4', title: 'D&D機能を実装する', description: 'dnd-kitライブラリを使用', status: 'IN_PROGRESS' },
  { id: 'task-5', title: 'Next.jsのAPI Routeをセットアップ', status: 'DONE' },
];

const columns: { id: TaskStatus; title: string }[] = [
  { id: 'TODO', title: '未着手 (To Do)' },
  { id: 'IN_PROGRESS', title: '進行中 (In Progress)' },
  { id: 'DONE', title: '完了 (Done)' },
];

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeTask = tasks.find((t) => t.id === active.id);
      const overColumnStatus = over.id as TaskStatus;

      if (activeTask && activeTask.status !== overColumnStatus) {
        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.id === active.id ? { ...t, status: overColumnStatus } : t
          )
        );
      }
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex space-x-6">
        {columns.map((col) => (
          <TaskColumn
            key={col.id}
            status={col.id}
            title={col.title}
            tasks={tasks.filter((task) => task.status === col.id)}
          />
        ))}
      </div>
    </DndContext>
  );
}
