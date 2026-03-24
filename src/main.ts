// ASMOS (Autonomous Self-Management OS)
// Core Application Logic & State Management

declare const markmap: any;
declare const d3: any;

// --- Types & Interfaces ---

type TimeSlotID = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'STOCK_MONTH' | 'STOCK_WEEK' | 'STOCK_DAY';
type Importance = 'High' | 'Mid' | 'Low';

interface TimeSlotConfig {
  id: string;
  timeRange: string;
  name: string;
  attribute: string;
  rule: string;
  startHour: number;
  endHour: number;
}

const TIME_SLOTS: Record<string, TimeSlotConfig> = {
  T1: { id: 'T1', timeRange: '05:00 - 09:00', name: 'Prime', attribute: '自己研鑽 / Jazz', rule: 'デジタルデトックス / 集中特化', startHour: 5, endHour: 9 },
  T2: { id: 'T2', timeRange: '09:00 - 12:00', name: 'Business AM', attribute: '業務（高負荷）', rule: '私用デバイス封印', startHour: 9, endHour: 12 },
  T3: { id: 'T3', timeRange: '12:00 - 13:00', name: 'Reset', attribute: '休憩 / 内省', rule: '業務連絡の完全遮断', startHour: 12, endHour: 13 },
  T4: { id: 'T4', timeRange: '13:00 - 18:15', name: 'Business PM', attribute: '業務（調整・ルーチン）', rule: '18:15以降の残業禁止フラグ', startHour: 13, endHour: 18.25 },
  T5: { id: 'T5', timeRange: '18:15 - 22:00', name: 'Private', attribute: '家族 / 翌日準備', rule: 'PCシャットダウン / 通知OFF', startHour: 18.25, endHour: 22 },
};

interface TaskCost {
  estimated_time: number;
  actual_time: number;
  hp_consumption: number;
  actual_hp: number;
}

interface TaskQuality {
  dod: string;
  success_criteria: string;
  actual_quality: number;
}

interface TaskRisk {
  potential_issue: string;
  mitigation: string;
  is_manifested: boolean;
}

interface TaskEntity {
  id: string;
  scope_id: string;
  title: string;
  slot: TimeSlotID;
  cost: TaskCost;
  quality: TaskQuality;
  risk: TaskRisk;
  is_planned: boolean;
  is_actual: boolean;
  importance: Importance;
  is_recovery: boolean;
  deadline?: string;
  goal_label?: string;
  note?: string;
}

interface AppState {
  tasks: TaskEntity[];
  userHP: number;
  mindMapMarkdown: string;
  memoGood: string;
  memoImprove: string;
  memoAnalysisMarkdown: string;
  memoNextActions: string;
  memoInsight: string;
}

// --- Storage Manager ---

class ASMOSStorage {
  private static STORAGE_KEY = 'ASMOS_STATE';

  static loadState(): AppState {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      try {
        const state = JSON.parse(data);
        if (!state.mindMapMarkdown) state.mindMapMarkdown = '# ASMOS Mind Map\n\n## 目的\n- 自己研鑽\n- 業務効率化\n\n## ステークホルダー\n- 家族\n- 同僚';
        if (state.memoAnalysisMarkdown === undefined) state.memoAnalysisMarkdown = '# 問題分析（ロジックツリー）\n\n## 今日の課題\n- なぜ起きた？\n  - 原因A\n  - 原因B';
        
        state.tasks = state.tasks.map((t: any) => {
          if (t.slot === 'STOCK') t.slot = 'STOCK_DAY';
          if (t.importance === undefined) t.importance = 'Mid';
          if (t.is_recovery === undefined) t.is_recovery = false;
          if (t.goal_label === undefined) t.goal_label = '';
          return t;
        });

        return state;
      } catch (e) {
        console.error('Failed to parse ASMOS state:', e);
      }
    }
    return {
      tasks: [],
      userHP: 100,
      mindMapMarkdown: '# ASMOS Mind Map\n\n## 目的\n- 自己研鑽\n- 業務効率化\n\n## ステークホルダー\n- 家族\n- 同僚',
      memoGood: '', memoImprove: '', 
      memoAnalysisMarkdown: '# 問題分析（ロジックツリー）\n\n## 今日の課題\n- なぜ起きた？\n  - 原因A\n  - 原因B',
      memoNextActions: '', memoInsight: ''
    };
  }

  static saveState(state: AppState) { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state)); }
  
  static exportState(state: AppState) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `asmos_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  static importState(file: File): Promise<AppState> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try { resolve(JSON.parse(e.target?.result as string)); }
        catch (err) { reject(err); }
      };
      reader.readAsText(file);
    });
  }
}

// --- Application Controller ---

class ASMOSApp {
  private state: AppState;
  private currentTaskIdForModal: string | null = null;
  private editingTaskId: string | null = null;
  private mmGoal: any = null;
  private mmAnalysis: any = null;
  private selectedNode: any = null;
  private creationMode: 'task' | 'node' = 'task';
  private nodeEditMode: 'add' | 'edit' = 'add';
  private currentTargetSlot: TimeSlotID = 'STOCK_DAY';
  private currentTargetColumn: 'plan' | 'actual' | 'stock' = 'stock';

  constructor() {
    this.state = ASMOSStorage.loadState();
    this.initUI();
    this.initNavigation();
    this.initDragAndDrop();
    this.startClock();
    this.render();
  }

  private startClock() {
    setInterval(() => {
      this.updateTimeIndicator();
      this.render();
    }, 60000);
  }

  private initUI() {
    const appDiv = document.getElementById('app');
    if (!appDiv) return;

    appDiv.innerHTML = `
      <!-- View 1: Integrated Dashboard (Fact) -->
      <div id="dashboard-view" class="app-view">
        <header class="view-header">
          <h1>📊 統合ダッシュボード</h1>
          <div class="hp-container standard-panel" style="padding: 10px 20px; display: flex; align-items: center; gap: 15px;">
            <span class="hp-status">User HP: <span id="dash-hp-value">${this.state.userHP}</span>/100</span>
            <div class="hp-bar-bg">
              <div id="hp-bar-fill" style="width: ${this.state.userHP}%;"></div>
            </div>
          </div>
        </header>
        <div class="view-body">
          <div class="dashboard-container">
            <div class="summary-grid">
              <div class="summary-card standard-panel">
                <h3>📅 予定時間</h3>
                <div class="value" id="dash-planned-time">0 min</div>
                <div class="label">Total Planned Effort</div>
              </div>
              <div class="summary-card success standard-panel">
                <h3>⚡ 実行時間 (HP)</h3>
                <div class="value" id="dash-actual-time">0 units</div>
                <div class="label">Total Actual Consumption</div>
              </div>
              <div class="summary-card warning standard-panel">
                <h3>📝 残タスク数</h3>
                <div class="value" id="dash-remaining-tasks">0</div>
                <div class="label">Unfinished Plans</div>
              </div>
            </div>
            <div class="dashboard-controls">
              <button id="export-btn-dash" class="btn">💾 データ一括出力 (JSON)</button>
              <button id="import-btn-dash" class="btn">📂 データ読込</button>
              <input type="file" id="import-file-dash" style="display:none" accept=".json">
            </div>
          </div>
        </div>
      </div>

      <!-- View 2: Goal Management -->
      <div id="mindmap-view" class="app-view" style="display:none">
        <header class="view-header">
          <h1>🎯 目的管理 (Goal Management)</h1>
        </header>
        <div class="view-body" style="padding: 0;">
          <div class="mindmap-container expanded">
            <div class="mindmap-editor slim">
              <div class="mm-editor-header">
                <h3>✍️ エディタ</h3>
                <div class="mm-controls">
                  <button id="mm-download-btn" class="btn subtle">⬇️</button>
                  <button id="mm-upload-btn" class="btn subtle">⬆️</button>
                  <input type="file" id="mm-import-file" style="display:none" accept=".md">
                </div>
              </div>
              <textarea id="mm-textarea" spellcheck="false">${this.state.mindMapMarkdown}</textarea>
            </div>
            <div class="mindmap-visualizer full">
              <svg id="markmap-svg-goal"></svg>
              <div id="mm-node-actions" class="node-actions-menu" style="display:none">
                <button id="mm-add-child" class="btn">➕</button>
                <button id="mm-edit-node" class="btn">📝</button>
                <button id="mm-delete-node" class="btn">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- View 3: Execution (Schedule) -->
      <div id="timezone-view" class="app-view" style="display:none">
        <div class="timezone-layout">
          <aside class="stock-sidebar hierarchical">
            <div class="sidebar-header main">
              <h3>📦 タスク・ストック</h3>
            </div>
            <section class="stock-level month">
              <div class="level-header"><span>🗓️ 月間 (Month)</span><button class="add-inline-btn" onclick="window.app.handleAddTaskInline('STOCK_MONTH', 'stock')">+</button></div>
              <div id="tasks-stock-month" class="slot-column stock" ondragover="event.preventDefault()" data-slot="STOCK_MONTH" data-column="stock"></div>
            </section>
            <section class="stock-level week">
              <div class="level-header"><span>📅 週間 (Week)</span><button class="add-inline-btn" onclick="window.app.handleAddTaskInline('STOCK_WEEK', 'stock')">+</button></div>
              <div id="tasks-stock-week" class="slot-column stock" ondragover="event.preventDefault()" data-slot="STOCK_WEEK" data-column="stock"></div>
            </section>
            <section class="stock-level day today">
              <div class="level-header"><span>🚀 本日 (Day)</span><button class="add-inline-btn" onclick="window.app.handleAddTaskInline('STOCK_DAY', 'stock')">+</button></div>
              <div id="tasks-stock-day" class="slot-column stock" ondragover="event.preventDefault()" data-slot="STOCK_DAY" data-column="stock"></div>
            </section>
          </aside>

          <main class="timeline-main">
            <header class="view-header">
              <h1>⏳ 実行管理</h1>
              <div class="controls">
                <button id="add-task-btn" class="btn primary">+ 新規タスク</button>
              </div>
            </header>
            <div class="view-body" style="padding: 0; position: relative;">
              <div id="time-indicator"><span>NOW</span></div>
              <div class="time-slots-container">
                <div class="timeline-headers">
                  <div class="header-time">時間枠</div>
                  <div class="header-plan">🗓️ 計画 (Plan)</div>
                  <div class="header-actual">✅ 実行 (Actual)</div>
                </div>
                ${Object.keys(TIME_SLOTS).map(slotId => `
                  <div class="time-slot" id="slot-${slotId}">
                    <div class="slot-header">
                      <span class="slot-id">${slotId}</span>
                      <span class="slot-name">${TIME_SLOTS[slotId].name}</span>
                      <span class="slot-time">${TIME_SLOTS[slotId].timeRange}</span>
                    </div>
                    <div class="slot-column plan" id="tasks-plan-${slotId}" ondragover="event.preventDefault()" data-slot="${slotId}" data-column="plan">
                      <button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'plan')">+</button>
                    </div>
                    <div class="slot-column actual" id="tasks-actual-${slotId}" ondragover="event.preventDefault()" data-slot="${slotId}" data-column="actual">
                      <button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'actual')">+</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </main>
        </div>
      </div>

      <!-- View 4: Reflection & Action (Review) -->
      <div id="reflection-view" class="app-view" style="display:none">
        <header class="view-header">
          <h1>🧠 内省とアクション (Review)</h1>
          <button id="download-review-btn" class="btn primary">📄 レポート出力</button>
        </header>
        <div class="view-body">
          <div class="memo-container enhanced">
            <div class="analysis-workflow">
              
              <!-- Section 1: Fact -->
              <section class="analysis-section">
                <div class="section-label">事実 (Fact)</div>
                <div class="box-header"><span class="icon">🔍</span><h3>本日の実績とタスクログ</h3></div>
                <div class="memo-section fact-summary-box standard-panel">
                  <div id="fact-summary" class="summary-text">算出中...</div>
                  <div class="fact-sub-label" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 15px; font-size: 0.8rem; color: var(--text-secondary);">完了タスクの振り返りメモ:</div>
                  <div id="fact-task-logs" class="task-log-list" style="margin-top: 10px;"></div>
                </div>
              </section>

              <!-- Section 2: Context -->
              <section class="analysis-section">
                <div class="section-label">状況整理 (Context)</div>
                <div class="memo-grid-horizontal">
                  <div class="memo-section-box good standard-panel">
                    <div class="box-header"><span class="icon">✅</span><h4>よかったところ (Good)</h4></div>
                    <textarea id="memo-good" placeholder="成功要因...">${this.state.memoGood}</textarea>
                  </div>
                  <div class="memo-section-box improve standard-panel">
                    <div class="box-header"><span class="icon">🛠️</span><h4>改善メモ (Improvement)</h4></div>
                    <textarea id="memo-improve" placeholder="課題、ボトルネック...">${this.state.memoImprove}</textarea>
                  </div>
                </div>
              </section>

              <!-- Section 3: Logic Tree -->
              <section class="analysis-section">
                <div class="section-label">論理分解 (Why)</div>
                <div class="box-header"><span class="icon">🌳</span><h3>問題分析ロジックツリー</h3></div>
                <div class="analysis-tree-container">
                  <textarea id="memo-analysis-markdown" class="standard-panel" placeholder="なぜ起きたか？を分解...">${this.state.memoAnalysisMarkdown}</textarea>
                  <div class="analysis-visualizer standard-panel">
                    <svg id="markmap-svg-analysis"></svg>
                  </div>
                </div>
              </section>

              <!-- Section 4: Core Insight -->
              <section class="analysis-section insight-focus">
                <div class="section-label">本質的な解釈 (Insight)</div>
                <div class="box-header"><span class="icon">💡</span><h3>The Core Insight</h3></div>
                <textarea id="memo-insight" placeholder="本質的な学びを一言で">${this.state.memoInsight}</textarea>
              </section>

              <!-- Section 5: Next Action -->
              <section class="analysis-section action-focus">
                <div class="section-label">判断 (Judgment)</div>
                <div class="box-header"><span class="icon">🚀</span><h3>明日へのアクションプラン</h3></div>
                <div class="memo-section action-section standard-panel">
                  <textarea id="memo-next-actions" placeholder="具体的なアクション...">${this.state.memoNextActions}</textarea>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <div id="creation-modal" class="modal-overlay" style="display:none">
        <div class="modal-content large">
          <nav class="modal-tabs">
            <button id="tab-task" class="active">✨ タスク追加</button>
            <button id="tab-node">🏗️ ノード操作</button>
          </nav>
          <div id="form-task" class="modal-tab-content">
            <div class="input-grid">
              <div class="input-group"><label>タスク名</label><input type="text" id="task-title"></div>
              <div class="input-group"><label>スロット</label><select id="task-slot">
                <option value="STOCK_MONTH">🗓️ 月間ストック</option>
                <option value="STOCK_WEEK">📅 週間ストック</option>
                <option value="STOCK_DAY">🚀 本日ストック</option>
                ${Object.keys(TIME_SLOTS).map(id => `<option value="${id}">${id} - ${TIME_SLOTS[id].name}</option>`).join('')}
              </select></div>
              <div class="input-group"><label>重要度</label><select id="task-importance"><option value="High">🔴 高</option><option value="Mid" selected>🟡 中</option><option value="Low">🔵 低</option></select></div>
              <div class="input-group"><label>目的ラベル</label><input type="text" id="task-goal-label"></div>
              <div class="input-group"><label>締め切り時刻</label><input type="time" id="task-deadline"></div>
              <div class="input-group"><label>見積時間 (分)</label><input type="number" id="task-estimated" value="60"></div>
              <div class="input-group"><label>モード</label><select id="task-mode"><option value="normal">⚡ 消費</option><option value="recovery">🌿 回復</option></select></div>
              <div class="input-group"><label>推定HP消費</label><input type="number" id="task-hp-est" value="10"></div>
            </div>
            <div class="input-group"><label>完了定義 (DoD)</label><textarea id="task-dod"></textarea></div>
          </div>
          <div id="form-node" class="modal-tab-content" style="display:none"><div class="input-group"><label id="node-label">ノード名</label><input type="text" id="node-text"></div></div>
          <div class="modal-controls">
            <button id="creation-delete" class="btn danger" style="display:none; margin-right: auto;">🗑️ 削除</button>
            <button id="creation-cancel" class="btn">キャンセル</button>
            <button id="creation-submit" class="btn primary">保存</button>
          </div>
        </div>
      </div>

      <div id="completion-modal" class="modal-overlay" style="display:none">
        <div class="modal-content">
          <div class="box-header"><span class="icon">🏁</span><h2>実績記録 (Fact-Check)</h2></div>
          <div class="input-group"><label>HP変動量</label>
            <div class="rating-group" id="hp-rating"><button data-value="25" class="btn">😫</button><button data-value="20" class="btn">😩</button><button data-value="15" class="btn">😐</button><button data-value="10" class="btn">😊</button><button data-value="5" class="btn">🤩</button></div>
          </div>
          <div class="input-group"><label>品質評価</label>
            <div class="rating-group" id="quality-rating"><button data-value="1" class="btn">Low</button><button data-value="2" class="btn">Mid</button><button data-value="3" class="btn">High</button></div>
          </div>
          <div class="input-group"><label><input type="checkbox" id="risk-check"> リスク顕在化</label></div>
          <div class="input-group"><label>内省ノート</label><textarea id="completion-note"></textarea></div>
          <div class="modal-controls"><button id="modal-cancel" class="btn">キャンセル</button><button id="modal-submit" class="btn primary">実績保存</button></div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    document.getElementById('add-task-btn')?.addEventListener('click', () => this.handleAddTask());
    document.getElementById('export-btn-dash')?.addEventListener('click', () => ASMOSStorage.exportState(this.state));
    document.getElementById('import-btn-dash')?.addEventListener('click', () => (document.getElementById('import-file-dash') as HTMLInputElement).click());
    document.getElementById('import-file-dash')?.addEventListener('change', async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) { try { this.state = await ASMOSStorage.importState(f); ASMOSStorage.saveState(this.state); this.render(); } catch (err) { alert('失敗'); } }
    });

    document.getElementById('modal-cancel')?.addEventListener('click', () => this.closeModal('completion-modal'));
    document.getElementById('modal-submit')?.addEventListener('click', () => this.handleModalSubmit());
    document.getElementById('creation-cancel')?.addEventListener('click', () => this.closeModal('creation-modal'));
    document.getElementById('creation-submit')?.addEventListener('click', () => this.handleCreationSubmit());
    document.getElementById('creation-delete')?.addEventListener('click', () => this.handleDeleteTask());
    document.getElementById('tab-task')?.addEventListener('click', () => this.switchCreationTab('task'));
    document.getElementById('tab-node')?.addEventListener('click', () => this.switchCreationTab('node'));
    document.getElementById('download-review-btn')?.addEventListener('click', () => this.downloadDailyReview());

    ['memo-good', 'memo-improve', 'memo-insight', 'memo-next-actions'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        (this.state as any)[id.replace('memo-', 'memo')] = (e.target as HTMLTextAreaElement).value;
        ASMOSStorage.saveState(this.state);
      });
    });
    document.getElementById('memo-analysis-markdown')?.addEventListener('input', (e) => {
      this.state.memoAnalysisMarkdown = (e.target as HTMLTextAreaElement).value;
      ASMOSStorage.saveState(this.state);
      this.updateMindMap('analysis');
    });

    this.setupRatingButtons('hp-rating');
    this.setupRatingButtons('quality-rating');

    document.getElementById('mm-textarea')?.addEventListener('input', (e) => { this.state.mindMapMarkdown = (e.target as HTMLTextAreaElement).value; ASMOSStorage.saveState(this.state); this.updateMindMap('goal'); });
    document.getElementById('mm-download-btn')?.addEventListener('click', () => this.downloadMindMap());
    document.getElementById('mm-upload-btn')?.addEventListener('click', () => (document.getElementById('mm-import-file') as HTMLInputElement).click());
    document.getElementById('mm-import-file')?.addEventListener('change', (e) => this.handleMindMapUpload(e));

    document.getElementById('mm-add-child')?.addEventListener('click', () => this.handleNodeAction('add'));
    document.getElementById('mm-edit-node')?.addEventListener('click', () => this.handleNodeAction('edit'));
    document.getElementById('mm-delete-node')?.addEventListener('click', () => this.guiDeleteNode());
    
    document.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('.markmap-node') && !(e.target as HTMLElement).closest('.node-actions-menu')) this.hideNodeMenu(); });
  }

  private initDragAndDrop() {
    document.addEventListener('dragstart', (e) => { const target = e.target as HTMLElement; if (target.classList.contains('task-card')) { e.dataTransfer?.setData('text/plain', target.id.replace('task-', '')); target.style.opacity = '0.5'; } });
    document.addEventListener('dragend', (e) => { (e.target as HTMLElement).style.opacity = '1'; document.querySelectorAll('.slot-column').forEach(el => el.classList.remove('drag-over')); });
    document.addEventListener('dragenter', (e) => { const target = (e.target as HTMLElement).closest('.slot-column'); if (target) target.classList.add('drag-over'); });
    document.addEventListener('dragleave', (e) => { const target = (e.target as HTMLElement).closest('.slot-column'); if (target) target.classList.remove('drag-over'); });
    document.addEventListener('drop', (e) => { e.preventDefault(); const target = (e.target as HTMLElement).closest('.slot-column') as HTMLElement; const taskId = e.dataTransfer?.getData('text/plain'); if (target && taskId) { const slotId = target.getAttribute('data-slot') as TimeSlotID; const col = target.getAttribute('data-column') as any; this.handleTaskDrop(taskId, slotId, col); } });
  }

  private handleTaskDrop(taskId: string, slotId: TimeSlotID, column: 'plan' | 'actual' | 'stock') {
    const task = this.state.tasks.find(t => t.id === taskId); if (!task) return;
    const wasActual = task.is_actual; task.slot = slotId;
    if (column === 'stock') { if (wasActual) this.state.userHP += (task.is_recovery ? -task.cost.actual_hp : task.cost.actual_hp); task.is_planned = false; task.is_actual = false; task.cost.actual_hp = 0; }
    else if (column === 'actual' && !wasActual) { this.currentTaskIdForModal = taskId; this.openCompletionModal(); return; }
    else if (column === 'plan') { if (wasActual) { this.state.userHP += (task.is_recovery ? -task.cost.actual_hp : task.cost.actual_hp); task.is_actual = false; task.cost.actual_hp = 0; } task.is_planned = true; }
    ASMOSStorage.saveState(this.state); this.render();
  }

  private calculateUrgency(deadline?: string): { score: number, label: string } {
    if (!deadline) return { score: 0, label: '' };
    const now = new Date(); const [h, m] = deadline.split(':').map(Number);
    const deadDate = new Date(); deadDate.setHours(h, m, 0);
    const diffMin = (deadDate.getTime() - now.getTime()) / 60000;
    if (diffMin < 0) return { score: 100, label: 'OVER' };
    if (diffMin > 180) return { score: 10, label: '' };
    const score = Math.floor(100 - (diffMin / 180) * 100);
    return { score, label: diffMin < 30 ? 'SOON' : '' };
  }

  private getImportanceValue(imp: Importance): number { return imp === 'High' ? 3 : (imp === 'Mid' ? 2 : 1); }
  private getTaskScore(task: TaskEntity): number { return this.getImportanceValue(task.importance) * this.calculateUrgency(task.deadline).score; }

  private render() {
    this.renderDashboard();
    this.renderTimezone();
    this.renderReflectionFact();
    this.updateTimeIndicator();
  }

  private renderDashboard() {
    const plannedTasks = this.state.tasks.filter(t => t.is_planned);
    const actualTasks = this.state.tasks.filter(t => t.is_actual);
    const remainingCount = plannedTasks.filter(t => !t.is_actual).length;
    const totalPlannedMinutes = plannedTasks.reduce((sum, t) => sum + t.cost.estimated_time, 0);
    const totalActualHP = actualTasks.reduce((sum, t) => sum + (t.is_recovery ? -t.cost.actual_hp : t.cost.actual_hp), 0);

    const hpDashValue = document.getElementById('dash-hp-value');
    if (hpDashValue) hpDashValue.innerText = this.state.userHP.toString();
    const hpBarFill = document.getElementById('hp-bar-fill');
    if (hpBarFill) hpBarFill.style.width = `${Math.min(100, Math.max(0, this.state.userHP))}%`;
    
    document.getElementById('dash-planned-time')!.innerText = `${totalPlannedMinutes} min`;
    document.getElementById('dash-actual-time')!.innerText = `${totalActualHP} units`;
    document.getElementById('dash-remaining-tasks')!.innerText = remainingCount.toString();
  }

  private renderTimezone() {
    ['STOCK_MONTH', 'STOCK_WEEK', 'STOCK_DAY'].forEach(lvl => {
      const col = document.getElementById(`tasks-stock-${lvl.split('_')[1].toLowerCase()}`);
      if (col) {
        let tasks = this.state.tasks.filter(t => t.slot === lvl);
        if (lvl === 'STOCK_DAY') tasks.sort((a, b) => this.getTaskScore(b) - this.getTaskScore(a));
        col.innerHTML = tasks.map(t => this.createTaskCardHTML(t, 'stock')).join('');
      }
    });

    Object.keys(TIME_SLOTS).forEach(slotId => {
      const pCol = document.getElementById(`tasks-plan-${slotId}`); 
      const aCol = document.getElementById(`tasks-actual-${slotId}`); 
      const el = document.getElementById(`slot-${slotId}`);
      if (pCol && aCol && el) {
        const cfg = TIME_SLOTS[slotId]; const cap = (cfg.endHour - cfg.startHour) * 60;
        const tasks = this.state.tasks.filter(t => t.slot === slotId); 
        const plTasks = tasks.filter(t => t.is_planned);
        const total = plTasks.reduce((s, t) => s + t.cost.estimated_time, 0); 
        const over = total > cap;

        const head = el.querySelector('.slot-header'); 
        if (head) { 
          const old = head.querySelector('.slot-time-usage'); 
          if (old) old.remove(); 
          head.insertAdjacentHTML('beforeend', `<div class="slot-time-usage ${over ? 'error' : ''}">${total}/${cap} min ${over ? `<span class="over-label">⚠️ OVER</span>` : ''}</div>`); 
        }
        el.classList.toggle('over-capacity', over);
        pCol.innerHTML = `<button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'plan')">+</button>` + plTasks.map(t => this.createTaskCardHTML(t, 'plan')).join('');
        aCol.innerHTML = `<button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'actual')">+</button>` + tasks.filter(t => t.is_actual).map(t => this.createTaskCardHTML(t, 'actual')).join('');
      }
    });
    const hpVal = document.getElementById('hp-value'); if (hpVal) hpVal.innerText = this.state.userHP.toString();
  }

  private renderReflectionFact() {
    const fact = document.getElementById('fact-summary'); const logs = document.getElementById('fact-task-logs');
    if (fact) {
      const acts = this.state.tasks.filter(t => t.is_actual); const hp = acts.reduce((s, t) => s + (t.is_recovery ? -t.cost.actual_hp : t.cost.actual_hp), 0);
      fact.innerHTML = `実行タスク： ${acts.length}<br>総HP消費量： ${hp}`;
      if (logs) { 
        if (acts.length === 0) logs.innerHTML = '<div class="hint">完了済みのタスクはありません</div>'; 
        else logs.innerHTML = acts.map(t => `<div class="task-log-item" style="margin-bottom: 12px; border-left: 2px solid var(--accent-color); padding-left: 12px;"><div style="font-weight: 600; font-size: 0.9rem;">${t.title}</div><div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${t.note || '(内省メモなし)'}</div></div>`).join(''); 
      }
    }
  }

  private createTaskCardHTML(t: TaskEntity, type: string): string {
    const isBoth = t.is_planned && t.is_actual; const isUn = !t.is_planned && t.is_actual;
    const urg = this.calculateUrgency(t.deadline); const score = this.getTaskScore(t);
    let mod = isBoth ? 'success' : (isUn ? 'unplanned' : ''); if (t.is_recovery) mod += ' recovery';
    return `<div class="task-card ${mod}" id="task-${t.id}" draggable="true" onclick="window.app.handleEditTask('${t.id}')"><div class="card-badges">${t.importance === 'High' ? '<span class="badge high">高</span>' : ''}${t.goal_label ? `<span class="badge goal">${t.goal_label}</span>` : ''}${score > 0 && t.slot === 'STOCK_DAY' ? `<span class="badge score">pts: ${score}</span>` : ''}${urg.score > 70 ? '<span class="badge urgency">🔥</span>' : ''}</div><div class="task-title">${t.title}</div><div class="task-meta"><span class="duration">⏱️ ${t.cost.estimated_time}m</span><span class="cost">${t.is_actual ? (t.is_recovery ? '+' : '-') + t.cost.actual_hp : (t.is_recovery ? '🌿 ' : '予 ') + t.cost.hp_consumption}</span><button onclick="event.stopPropagation(); window.app.toggleTask('${t.id}')" class="btn subtle">${t.is_actual ? '戻す' : '完了'}</button></div></div>`;
  }

  public handleAddTaskInline(slot: TimeSlotID, column: 'plan' | 'actual' | 'stock') { this.currentTargetSlot = slot; this.currentTargetColumn = column; this.creationMode = 'task'; this.openCreationModal(); (document.getElementById('task-slot') as HTMLSelectElement).value = slot; }
  public handleEditTask(id: string) { const t = this.state.tasks.find(x => x.id === id); if (t) { this.editingTaskId = id; this.creationMode = 'task'; this.openCreationModal(t); } }
  private handleDeleteTask() { if (this.editingTaskId && confirm('削除しますか？')) { this.state.tasks = this.state.tasks.filter(t => t.id !== this.editingTaskId); ASMOSStorage.saveState(this.state); this.render(); this.closeModal('creation-modal'); } }
  private handleAddTask() { this.editingTaskId = null; this.creationMode = 'task'; this.openCreationModal(); }
  private handleNodeAction(action: 'add' | 'edit') { if (this.selectedNode) { this.editingTaskId = null; this.creationMode = 'node'; this.nodeEditMode = action; this.openCreationModal(); } }

  private openCreationModal(task?: TaskEntity) {
    const modal = document.getElementById('creation-modal'); if (!modal) return; modal.style.display = 'flex'; this.switchCreationTab(this.creationMode);
    const delBtn = document.getElementById('creation-delete'); const subBtn = document.getElementById('creation-submit');
    if (this.creationMode === 'task') {
      if (delBtn) delBtn.style.display = task ? 'block' : 'none'; if (subBtn) subBtn.innerText = task ? '更新' : '保存';
      (document.getElementById('task-title') as HTMLInputElement).value = task ? task.title : '';
      (document.getElementById('task-slot') as HTMLSelectElement).value = task ? task.slot : this.currentTargetSlot;
      (document.getElementById('task-importance') as HTMLSelectElement).value = task ? task.importance : 'Mid';
      (document.getElementById('task-goal-label') as HTMLInputElement).value = task ? (task.goal_label || '') : '';
      (document.getElementById('task-deadline') as HTMLInputElement).value = task ? (task.deadline || '') : '';
      (document.getElementById('task-estimated') as HTMLInputElement).value = task ? task.cost.estimated_time.toString() : '60';
      (document.getElementById('task-mode') as HTMLSelectElement).value = task ? (task.is_recovery ? 'recovery' : 'normal') : 'normal';
      (document.getElementById('task-hp-est') as HTMLInputElement).value = task ? task.cost.hp_consumption.toString() : '10';
      (document.getElementById('task-dod') as HTMLTextAreaElement).value = task ? task.quality.dod : '';
    } else {
      if (delBtn) delBtn.style.display = 'none'; if (subBtn) subBtn.innerText = '保存';
      (document.getElementById('node-text') as HTMLInputElement).value = this.nodeEditMode === 'edit' ? this.selectedNode.content : '';
    }
  }

  private switchCreationTab(tab: 'task' | 'node') {
    this.creationMode = tab; document.getElementById('tab-task')?.classList.toggle('active', tab === 'task'); document.getElementById('tab-node')?.classList.toggle('active', tab === 'node');
    document.getElementById('form-task')!.style.display = tab === 'task' ? 'block' : 'none'; document.getElementById('form-node')!.style.display = tab === 'node' ? 'block' : 'none';
  }

  private handleCreationSubmit() {
    if (this.creationMode === 'task') {
      const title = (document.getElementById('task-title') as HTMLInputElement).value; if (!title) return;
      const slot = (document.getElementById('task-slot') as HTMLSelectElement).value as TimeSlotID;
      const imp = (document.getElementById('task-importance') as HTMLSelectElement).value as Importance;
      const dead = (document.getElementById('task-deadline') as HTMLInputElement).value;
      const goal = (document.getElementById('task-goal-label') as HTMLInputElement).value;
      const mode = (document.getElementById('task-mode') as HTMLSelectElement).value;
      const hp = parseInt((document.getElementById('task-hp-est') as HTMLInputElement).value);
      const est = parseInt((document.getElementById('task-estimated') as HTMLInputElement).value);
      const dod = (document.getElementById('task-dod') as HTMLTextAreaElement).value;

      if (this.editingTaskId) {
        const t = this.state.tasks.find(x => x.id === this.editingTaskId);
        if (t) { t.title = title; t.slot = slot; t.importance = imp; t.deadline = dead; t.goal_label = goal; t.is_recovery = mode === 'recovery'; t.cost.hp_consumption = hp; t.cost.estimated_time = est; t.quality.dod = dod; }
      } else {
        this.state.tasks.push({ id: crypto.randomUUID(), scope_id: 'WBS-001', title, slot, cost: { estimated_time: est, actual_time: 0, hp_consumption: hp, actual_hp: 0 }, quality: { dod, success_criteria: '', actual_quality: 0 }, risk: { potential_issue: '', mitigation: '', is_manifested: false }, is_planned: !slot.startsWith('STOCK'), is_actual: false, importance: imp, deadline: dead, goal_label: goal, is_recovery: mode === 'recovery' });
      }
      ASMOSStorage.saveState(this.state); this.render(); this.closeModal('creation-modal');
    } else { if (this.nodeEditMode === 'add') this.guiAddChild(); else this.guiEditNode(); }
  }

  private switchView(view: string) {
    document.querySelectorAll('.app-view').forEach(el => (el as HTMLElement).style.display = 'none');
    document.getElementById(`${view}-view`)!.style.display = 'flex';
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active')); document.getElementById(`nav-${view}`)?.classList.add('active');
    if (view === 'mindmap') this.initMindMap('goal'); if (view === 'reflection') this.initMindMap('analysis'); this.hideNodeMenu();
  }

  private initNavigation() {
    ['dashboard', 'mindmap', 'timezone', 'reflection'].forEach(v => document.getElementById(`nav-${v}`)?.addEventListener('click', () => this.switchView(v)));
  }

  private initMindMap(type: 'goal' | 'analysis') {
    const sel = type === 'goal' ? '#markmap-svg-goal' : '#markmap-svg-analysis';
    const key = type === 'goal' ? 'mmGoal' : 'mmAnalysis';
    if ((this as any)[key]) { this.updateMindMap(type); return; }
    (this as any)[key] = (window as any).markmap.Markmap.create(sel, type === 'goal' ? { paddingX: 32 } : { paddingX: 20, autoFit: true, duration: 0 });
    this.updateMindMap(type);
  }

  private updateMindMap(type: 'goal' | 'analysis') {
    const inst = type === 'goal' ? this.mmGoal : this.mmAnalysis; if (!inst) return;
    const md = type === 'goal' ? this.state.mindMapMarkdown : this.state.memoAnalysisMarkdown;
    const { root } = new (window as any).markmap.Transformer().transform(md); inst.setData(root);
    setTimeout(() => inst.fit(), type === 'analysis' ? 50 : 0);
    if (type === 'goal') setTimeout(() => d3.selectAll('#markmap-svg-goal .markmap-node').on('click', (ev: any, d: any) => { ev.stopPropagation(); this.handleNodeClick(ev, d); }), 100);
  }

  private handleNodeClick(ev: any, d: any) { this.selectedNode = d; const menu = document.getElementById('mm-node-actions'); if (menu) { menu.style.display = 'block'; menu.style.left = `${ev.pageX + 10}px`; menu.style.top = `${ev.pageY - 20}px`; } }
  private hideNodeMenu() { const menu = document.getElementById('mm-node-actions'); if (menu) menu.style.display = 'none'; this.selectedNode = null; }
  private updateMarkdownState(md: string) { this.state.mindMapMarkdown = md; (document.getElementById('mm-textarea') as HTMLTextAreaElement).value = md; ASMOSStorage.saveState(this.state); this.updateMindMap('goal'); }
  private setupRatingButtons(gid: string) { const g = document.getElementById(gid); g?.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { g.querySelectorAll('button').forEach(x => x.classList.remove('selected')); b.classList.add('selected'); })); }
  private closeModal(id: string) { document.getElementById(id)!.style.display = 'none'; if (id === 'creation-modal') this.hideNodeMenu(); }
  private downloadMindMap() { const b = new Blob([this.state.mindMapMarkdown], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `asmos_mindmap_${new Date().toISOString().split('T')[0]}.md`; a.click(); }
  private handleMindMapUpload(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => this.updateMarkdownState(ev.target?.result as string); r.readAsText(f); } }
  
  private guiAddChild() {
    const newName = (document.getElementById('node-text') as HTMLInputElement).value; if (!newName) return;
    const lines = this.state.mindMapMarkdown.split('\n');
    const idx = lines.findIndex(l => l.includes(this.selectedNode.content)); if (idx === -1) return;
    const prefix = lines[idx].startsWith('#') ? lines[idx].match(/^#+/)?.[0] + '# ' : lines[idx].match(/^ */)?.[0] + '  - ';
    lines.splice(idx + 1, 0, prefix + newName); this.updateMarkdownState(lines.join('\n')); this.closeModal('creation-modal');
  }

  private guiEditNode() {
    const newName = (document.getElementById('node-text') as HTMLInputElement).value; if (!newName) return;
    const lines = this.state.mindMapMarkdown.split('\n');
    const idx = lines.findIndex(l => l.includes(this.selectedNode.content)); if (idx === -1) return;
    lines[idx] = lines[idx].replace(this.selectedNode.content, newName); this.updateMarkdownState(lines.join('\n')); this.closeModal('creation-modal');
  }

  private guiDeleteNode() {
    if (!confirm(`削除しますか？`)) return;
    const lines = this.state.mindMapMarkdown.split('\n');
    const idx = lines.findIndex(l => l.includes(this.selectedNode.content)); if (idx === -1) return;
    let count = 1; const level = this.getLineLevel(lines[idx]);
    for (let i = idx + 1; i < lines.length; i++) if (this.getLineLevel(lines[i]) > level) count++; else break;
    lines.splice(idx, count); this.updateMarkdownState(lines.join('\n')); this.hideNodeMenu();
  }

  private getLineLevel(line: string) { if (line.trim() === '') return 999; if (line.startsWith('#')) return line.match(/^#+/)?.[0].length || 0; return (line.match(/^ */)?.[0].length || 0) + 10; }

  private updateTimeIndicator() {
    const ind = document.getElementById('time-indicator'); if (!ind) return;
    const now = new Date(); const current = now.getHours() + now.getMinutes() / 60;
    if (current < 5 || current > 22) { ind.style.display = 'none'; return; }
    ind.style.display = 'block';
    let target = ''; for (const id in TIME_SLOTS) if (current >= TIME_SLOTS[id].startHour && current < TIME_SLOTS[id].endHour) { target = id; break; }
    if (target) { const el = document.getElementById(`slot-${target}`); if (el) { const cfg = TIME_SLOTS[target]; const pct = (current - cfg.startHour) / (cfg.endHour - cfg.startHour); ind.style.top = `${el.offsetTop + (el.offsetHeight * pct)}px`; } }
  }
  private openCompletionModal() { const modal = document.getElementById('completion-modal'); if (modal) modal.style.display = 'flex'; }
  private handleModalSubmit() {
    if (!this.currentTaskIdForModal) return;
    const hpRating = document.getElementById('hp-rating')?.querySelector('button.selected')?.getAttribute('data-value');
    if (!hpRating) return alert('HPを選択してください');
    const task = this.state.tasks.find(t => t.id === this.currentTaskIdForModal);
    if (task) {
      task.cost.actual_hp = parseInt(hpRating); task.is_actual = true; 
      this.state.userHP += (task.is_recovery ? task.cost.actual_hp : -task.cost.actual_hp);
      ASMOSStorage.saveState(this.state); this.closeModal('completion-modal'); this.render();
    }
  }
  private downloadDailyReview() {
    const d = new Date().toISOString().split('T')[0]; const fact = document.getElementById('fact-summary')?.innerText || '';
    const c = `# ASMOS Reflection - ${d}\n\n## Fact\n${fact}\n\n## Interpretation\n### Good\n${this.state.memoGood}\n### Improvement\n${this.state.memoImprove}\n### Logic Tree\n${this.state.memoAnalysisMarkdown}\n### Insight\n${this.state.memoInsight}\n\n## Judgment\n${this.state.memoNextActions}`;
    const b = new Blob([c], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `asmos_reflection_${d}.md`; a.click();
  }
}

const app = new ASMOSApp();
(window as any).app = app;
