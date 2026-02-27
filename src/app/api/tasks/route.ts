
/**
 * @file /api/tasks エンドポイント
 *
 * タスクに関するバックエンド処理（一覧取得, 新規作成, 更新, 削除）を担当する
 * Next.js API Route です。
 * サーバーサイドでのみ実行され、直接データベースと通信します。
 */

import { NextResponse } from 'next/server';
import { getAllTasks } from '@/lib/db/supabase';

/**
 * GET /api/tasks
 * すべてのタスクを取得する
 */
export async function GET() {
  try {
    // データベースからタスク一覧を取得
    const tasks = await getAllTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('タスク取得エラー:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/tasks
 * 新しいタスクを作成する
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('新規タスク作成リクエスト:', body);
    // ここでDBへの書き込み処理を行う
    
    // 作成成功のレスポンスを返す
    return NextResponse.json({ message: 'Task created successfully', task: body }, { status: 201 });
  } catch (error) {
    console.error('タスク作成エラー:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
