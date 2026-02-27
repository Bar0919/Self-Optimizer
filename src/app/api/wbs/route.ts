import { NextResponse } from 'next/server';
import { generateWbsFromKgi } from '@/lib/ai/gemini';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { kgi } = body;

    if (!kgi) {
      return NextResponse.json({ error: 'KGI is required' }, { status: 400 });
    }

    // Gemini API（現在はモック）を呼び出してWBSを生成
    const wbsData = await generateWbsFromKgi(kgi);

    // フロントエンドにWBSデータを返す
    return NextResponse.json({ wbs: [wbsData] }); // WbsChartは配列を期待しているため配列でラップ

  } catch (error) {
    console.error('WBS generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate WBS' }, { status: 500 });
  }
}
