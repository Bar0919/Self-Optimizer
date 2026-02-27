
/**
 * @file ユーザー資源（HP/MPなど）を管理するカスタムフック
 *
 * 資源のリアルタイムな増減、閾値の監視、セーフティ機能の発動などを担当します。
 * Reactのクライアントコンポーネントから手軽に資源状態を扱えるようにします。
 */

import { useState, useEffect } from 'react';
import type { Resource } from '@/types';

const initialResources: Resource[] = [
  { id: 'hp', name: 'HP', value: 80, maxValue: 100, unit: 'pt' },
  { id: 'mp', name: 'MP', value: 65, maxValue: 100, unit: 'pt' },
];

export function useResource(taskId: string | null) {
  const [resources, setResources] = useState(initialResources);

  useEffect(() => {
    if (!taskId) {
      // タスクが実行中でなければ何もしない
      return;
    }

    // 1秒ごとにMPを1消費するタイマー（デモ用）
    const timer = setInterval(() => {
      setResources(prev => prev.map(r => {
        if (r.id === 'mp' && r.value > 0) {
          const newValue = r.value - 1;
          
          // 閾値に達したらセーフティを発動
          if (newValue <= 0) {
            alert('MPが枯渇しました！タスクを強制中断し、リスケジュールします。');
            // ここでリスケジュールAPIを叩くなどの処理を行う
            clearInterval(timer);
          }
          return { ...r, value: newValue };
        }
        return r;
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [taskId]);

  return { resources };
}
