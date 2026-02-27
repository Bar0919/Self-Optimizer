
"use client";

import { useState } from 'react';

// 仮のWBSデータ構造の型定義
interface WbsNode {
  id: string;
  name: string;
  children?: WbsNode[];
}

const renderWbsTree = (nodes: WbsNode[]) => {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  return (
    <ul>
      {nodes.map(node => (
        <li key={node.id}>
          {node.name}
          {node.children && renderWbsTree(node.children)}
        </li>
      ))}
    </ul>
  );
};


export const WbsChart = () => {
  const [kgi, setKgi] = useState('');
  const [wbsData, setWbsData] = useState<WbsNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateWbs = async () => {
    if (!kgi) {
      setError('KGIを入力してください。');
      return;
    }
    setIsLoading(true);
    setError(null);
    setWbsData(null);

    try {
      const response = await fetch('/api/wbs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kgi }),
      });

      if (!response.ok) {
        throw new Error('WBSの生成に失敗しました。');
      }

      const data = await response.json();
      setWbsData(data.wbs);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
      <h3>WBSチャート</h3>
      <div>
        <input
          type="text"
          value={kgi}
          onChange={(e) => setKgi(e.target.value)}
          placeholder="KGI（最終目的）を入力"
          style={{ width: '300px', marginRight: '8px' }}
        />
        <button onClick={handleGenerateWbs} disabled={isLoading}>
          {isLoading ? '生成中...' : 'WBSを生成'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {wbsData ? (
        renderWbsTree(wbsData)
      ) : (
        <p>（ここにWBSがツリー形式で表示されます）</p>
      )}
    </div>
  );
};
