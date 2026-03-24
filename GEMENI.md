「凄腕エンジニア」としての開発効率と、PMBOKの論理的構造を両立させるための設計図として、`gemini.md` を作成しました。これをプロジェクトのルートディレクトリに配置し、設計の「憲法」として活用してください。

---

# Project: Autonomous Self-Management OS (ASMOS)
> **Mission:** 圧倒的な成長を遂げ、他者も自分も満たす「システム」の構築。
> **Concept:** PMBOK × High-Resolution Self-Control × Local First.

---

## 1. 非機能要件 (Non-Functional Requirements)
* **Zero Infrastructure:** `index.html` をブラウザで開くだけで動作。
* **Privacy First:** データは全て `LocalStorage` / `IndexedDB` に保存。外部送信禁止。
* **Portability:** JSON形式でのインポート/エクスポート機能を統合管理。
* **Performance:** Vanilla JS または CDN Vue.js による軽量動作。

---

## 2. タイムスロット定義 (Time Resource Allocation)
各スロットには「境界ルール」を適用し、役割の混濁を防ぐ。

| ID | 時間枠 | 名称 | 属性 | 境界管理ルール |
| :--- | :--- | :--- | :--- | :--- |
| T1 | 05:00 - 09:00 | **Prime** | 自己研鑽 / Jazz | デジタルデトックス / 集中特化 |
| T2 | 09:00 - 12:00 | **Business AM** | 業務（高負荷） | 私用デバイス封印 |
| T3 | 12:00 - 13:00 | **Reset** | 休憩 / 内省 | 業務連絡の完全遮断 |
| T4 | 13:00 - 18:15 | **Business PM** | 業務（調整・ルーチン）| 18:15以降の残業禁止フラグ |
| T5 | 18:15 - 22:00 | **Private** | 家族 / 翌日準備 | PCシャットダウン / 通知OFF |

---

## 3. タスク・エンティティ構造 (Task Data Schema)
PMBOKの「コスト・品質・リスク」を内包したデータ構造。

```json
{
  "id": "uuid",
  "scope_id": "WBS_ref_id",
  "title": "Task Name",
  "slot": "T1",
  "cost": {
    "estimated_time": 60,
    "actual_time": 0,
    "hp_consumption": 20,
    "budget": 0
  },
  "quality": {
    "dod": "Done Definition (Result)",
    "success_criteria": "Quality Metric (Process)"
  },
  "risk": {
    "potential_issue": "Technical debt / Interruption",
    "mitigation": "Backup plan / Buffer",
    "is_manifested": false
  },
  "status": "todo|doing|done"
}
```

---

## 4. 統合ダッシュボード要件 (Integration Dashboard)

### 4.1 監視・コントロール (Monitoring)
* **Plan vs Actual:** タイムスロットごとの予実を2軸（棒グラフと線グラフ）で可視化。
* **HP Trajectory:** 1日のHP（内的資源）の消費と回復をグラフ化。

### 4.2 フィードバックループ (Daily Review)
1.  **事実 (Fact):** 完了タスク一覧、計画との乖離時間の自動算出。
2.  **解釈 (Interpretation):** 乖離の理由（リスクの顕在化、見積の甘さ等）の記述。
3.  **判断 (Judgment):** 翌日の計画への反映（テンプレート修正）。

---

## 5. 抽象化された学び (Abstract Insights)
* **「タスク」は「投資」である:** 時間とHPを投下し、スキル（資産）や成果物（価値）に変換する行為。
* **「境界」は「守護」である:** 集中と回復を分かつことで、エンジニアとしての持続可能性を担保する。
* **「コピー」は「資産化」である:** 成功した1日の型を再利用し、意思決定コストをゼロに近づける。

---

## 6. 今後の課題 (Backlog)
- [ ] マインドマップ（ステークホルダー）の動的描画（Markmap統合）。
- [ ] リスク的中時の「振り返りレコメンド」ロジック実装。
- [ ] 家族との時間を確保するための「18:15アラート」の実装。

---

### 次のステップへの提案
この `gemini.md` に基づき、**最初の `index.html` の骨組み（LocalStorageへの保存機能付き）**の実装コードを作成しましょうか？