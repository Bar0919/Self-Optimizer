
import { TaskBoard } from "@/components/TaskBoard";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="py-4 px-8 border-b">
        <h1 className="text-2xl font-bold text-primary">Self-Optimizer</h1>
        <p className="text-muted-foreground">あなたの目標達成を最大化する</p>
      </header>
      <main className="flex-1 p-8">
        <TaskBoard />
      </main>
    </div>
  );
}
