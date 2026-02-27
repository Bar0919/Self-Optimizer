
/**
 * @file Google Calendar APIとの連携ロジック
 *
 * 認証処理、カレンダーからの予定取得、タスクのリスケジュール登録など、
 * Google Calendarに関するすべての処理をこのファイルで管理します。
 * TimeTree APIとの連携もここで行う可能性があります。
 */

/**
 * 指定した期間の「動かせない予定」を取得する
 * @param startDate - 取得開始日
 * @param endDate - 取得終了日
 * @returns 予定の配列
 */
export async function getFixedEvents(startDate: Date, endDate: Date) {
  console.log(`${startDate}から${endDate}までの固定予定を取得します。`);

  // ここにGoogle Calendar APIへの接続・データ取得ロジックを実装
  
  // モックデータを返す
  return [
    {
      title: '【確定】クライアントMTG',
      start: new Date('2024-07-23T10:00:00'),
      end: new Date('2024-07-23T11:00:00'),
      source: 'Google Calendar',
    },
    {
      title: '歯医者',
      start: new Date('2024-07-24T15:00:00'),
      end: new Date('2024-07-24T15:30:00'),
      source: 'TimeTree',
    },
  ];
}
