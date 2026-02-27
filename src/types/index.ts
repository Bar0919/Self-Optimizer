export type Task = {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type Resource = {
  id: string;
  name: string;
  value: number;
  maxValue: number;
  unit: string;
};
