
/**
 * @file Supabaseとの連携ロジック
 *
 * Supabaseクライアントの初期化、およびデータベース操作（CRUD）に関する
 * すべての関数をこのファイルで管理します。
 *
 * Next.jsのサーバーコンポーネント、クライアントコンポーネント、APIルートなど、
 * どこからでも安全にDB操作を呼び出せるように設計します。
 */

// import { createClient } from '@supabase/supabase-js'
// import type { Database } from '@/types/supabase' // Supabaseが自動生成した型定義

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * 例：すべてのタスクを取得する関数
 */
export async function getAllTasks() {
  console.log('すべてのタスクを取得するリクエスト');
  // const { data: tasks, error } = await supabase.from('tasks').select('*');
  // if (error) throw error;
  // return tasks;

  // モックデータ
  return [
    { id: 'task-1', title: '要件定義書を作成する', status: 'done' },
    { id: 'task-2', title: 'ディレクトリ構造を設計する', status: 'done' },
    { id: 'task-3', title: 'ソースファイルを作成する', status: 'inprogress' },
  ];
}
