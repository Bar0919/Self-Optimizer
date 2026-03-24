// ASMOS (Autonomous Self-Management OS)
// Core Application Logic & State Management

declare const markmap: any;
declare const d3: any;

// --- Types & Interfaces ---

type TimeSlotID = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'STOCK';

interface TimeSlotConfig {
  id: TimeSlotID;
  timeRange: string;
  name: string;
  attribute: string;
  rule: string;
}

const TIME_SLOTS: Record<string, TimeSlotConfig> = {
  T1: { id: 'T1', timeRange: '05:00 - 09:00', name: 'Prime', attribute: '自己研鑽 / Jazz', rule: 'デジタルデトックス / 集中特化' },
  T2: { id: 'T2', timeRange: '09:00 - 12:00', name: 'Business AM', attribute: '業務（高負荷）', rule: '私用デバイス封印' },
  T3: { id: 'T3', timeRange: '12:00 - 13:00', name: 'Reset', attribute: '休憩 / 内省', rule: '業務連絡の完全遮断' },
  T4: { id: 'T4', timeRange: '13:00 - 18:15', name: 'Business PM', attribute: '業務（調整・ルーチン）', rule: '18:15以降の残業禁止フラグ' },
  T5: { id: 'T5', timeRange: '18:15 - 22:00', name: 'Private', attribute: '家族 / 翌日準備', rule: 'PCシャットダウン / 通知OFF' },
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
        if (state.memoGood === undefined) state.memoGood = '';
        if (state.memoImprove === undefined) state.memoImprove = '';
        if (state.memoAnalysisMarkdown === undefined) state.memoAnalysisMarkdown = '# 問題分析（ロジックツリー）\n\n## 今日の課題\n- なぜ起きた？\n  - 原因A\n  - 原因B';
        if (state.memoNextActions === undefined) state.memoNextActions = '';
        if (state.memoInsight === undefined) state.memoInsight = '';
        return state;
      } catch (e) {
        console.error('Failed to parse ASMOS state:', e);
      }
    }
    return {
      tasks: [],
      userHP: 100,
      mindMapMarkdown: '# ASMOS Mind Map\n\n## 目的\n- 自己研鑽\n- 業務効率化\n\n## ステークホルダー\n- 家族\n- 同僚',
      memoGood: '',
      memoImprove: '',
      memoAnalysisMarkdown: '# 問題分析（ロジックツリー）\n\n## 今日の課題\n- なぜ起きた？\n  - 原因A\n  - 原因B',
      memoNextActions: '',
      memoInsight: '',
    };
  }

  static saveState(state: AppState) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  static exportState(state: AppState) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `asmos_backup_${new Date().toISOString().split('T')[0]}.json`);
    a.click();
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
  private mmGoal: any = null;
  private mmAnalysis: any = null;
  private selectedNode: any = null;
  private creationMode: 'task' | 'node' = 'task';
  private nodeEditMode: 'add' | 'edit' = 'add';
  private currentTargetSlot: TimeSlotID = 'T1';
  private currentTargetColumn: 'plan' | 'actual' | 'stock' = 'plan';

  constructor() {
    this.state = ASMOSStorage.loadState();
    this.initUI();
    this.initNavigation();
    this.initDragAndDrop();
    this.render();
  }

  private initUI() {
    const appDiv = document.getElementById('app');
    if (!appDiv) return;

    appDiv.innerHTML = `
      <!-- View 1: Fact (Dashboard) -->
      <div id="dashboard-view" class="app-view">
        <header class="view-header">
          <h1>事実 (Fact)</h1>
          <div class="hp-status">User HP: <span id="dash-hp-value">${this.state.userHP}</span>/100</div>
        </header>
        <div class="view-body">
          <div class="dashboard-container">
            <div class="summary-grid">
              <div class="summary-card standard-panel">
                <h3>予定時間</h3>
                <div class="value" id="dash-planned-time">0 min</div>
                <div class="label">Total Planned Effort</div>
              </div>
              <div class="summary-card success standard-panel">
                <h3>実行時間 (HP)</h3>
                <div class="value" id="dash-actual-time">0 units</div>
                <div class="label">Total Actual Consumption</div>
              </div>
              <div class="summary-card warning standard-panel">
                <h3>残タスク数</h3>
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

      <!-- View 2: Schedule & Task -->
      <div id="timezone-view" class="app-view" style="display:none">
        <div class="timezone-layout">
          <aside class="stock-sidebar">
            <div class="sidebar-header">
              <h3>📦 タスク・ストック</h3>
              <button class="btn primary" style="padding: 2px 10px;" onclick="window.app.handleAddTaskInline('STOCK', 'stock')">+</button>
            </div>
            <div id="tasks-stock" class="slot-column stock view-body" ondragover="event.preventDefault()" data-slot="STOCK" data-column="stock"></div>
          </aside>

          <main class="timeline-main">
            <header class="view-header">
              <h1>スケジュール&タスク管理</h1>
              <div class="controls">
                <button id="add-task-btn" class="btn primary">+ 新規タスク</button>
              </div>
            </header>
            <div class="view-body" style="padding: 0;">
              <div class="time-slots-container">
                <div class="timeline-headers">
                  <div class="header-time">時間枠</div>
                  <div class="header-plan">計画 (Plan)</div>
                  <div class="header-actual">実行 (Actual)</div>
                </div>
                ${(Object.keys(TIME_SLOTS).filter(k => k !== 'STOCK')).map(slotId => `
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

      <!-- View 3: Goal Management (Mind Map - Expanded) -->
      <div id="mindmap-view" class="app-view" style="display:none">
        <header class="view-header">
          <h1>目的管理 (Goal Management)</h1>
        </header>
        <div class="view-body" style="padding: 0;">
          <div class="mindmap-container expanded">
            <div class="mindmap-editor slim">
              <div class="mm-editor-header">
                <h3>Editor</h3>
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

      <!-- View 4: Reflection & Action (Combined) -->
      <div id="reflection-view" class="app-view" style="display:none">
        <header class="view-header">
          <h1>内省とアクション (Review & Action)</h1>
          <button id="download-review-btn" class="btn primary">📄 レポート出力</button>
        </header>
        <div class="view-body">
          <div class="memo-container enhanced">
            <div class="analysis-workflow">
              
              <!-- Section 1: Fact -->
              <section class="analysis-section">
                <div class="section-label">事実 (Fact)</div>
                <h3>本日の実績とタスクログ</h3>
                <div class="memo-section fact-summary-box standard-panel">
                  <div id="fact-summary" class="summary-text">算出中...</div>
                  <div class="fact-sub-label" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 15px; font-size: 0.8rem; color: var(--text-secondary);">完了タスクの振り返りメモ:</div>
                  <div id="fact-task-logs" class="task-log-list" style="margin-top: 10px;"></div>
                </div>
              </section>

              <!-- Section 2: Logic Tree -->
              <section class="analysis-section">
                <div class="section-label">論理分解 (Why)</div>
                <h3>問題分析ロジックツリー</h3>
                <div class="analysis-tree-container">
                  <textarea id="memo-analysis-markdown" class="standard-panel" placeholder="なぜ起きたか？を分解...">${this.state.memoAnalysisMarkdown}</textarea>
                  <div class="analysis-visualizer standard-panel">
                    <svg id="markmap-svg-analysis"></svg>
                  </div>
                </div>
              </section>

              <!-- Section 2: Good/Improvement -->
              <section class="analysis-section">
                <div class="section-label">状況整理</div>
                <div class="memo-grid-horizontal">
                  <div class="memo-section-box good">
                    <label>よかったところ (Good)</label>
                    <textarea id="memo-good" placeholder="成功要因...">${this.state.memoGood}</textarea>
                  </div>
                  <div class="memo-section-box improve">
                    <label>改善メモ (Improvement)</label>
                    <textarea id="memo-improve" placeholder="ボトルネック...">${this.state.memoImprove}</textarea>
                  </div>
                </div>
              </section>

              <!-- Section 3: Core Insight -->
              <section class="analysis-section insight-focus">
                <div class="section-label">本質的な解釈</div>
                <textarea id="memo-insight" placeholder="今回の分析から得られた、本質的な学びを一言で">${this.state.memoInsight}</textarea>
              </section>

              <!-- Section 4: Next Action -->
              <section class="analysis-section action-focus">
                <div class="section-label">判断 (Judgment)</div>
                <h3>明日へのアクションプラン</h3>
                <div class="memo-section action-section standard-panel">
                  <textarea id="memo-next-actions" placeholder="具体的な次の一手をリストアップ...">${this.state.memoNextActions}</textarea>
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
            <button id="tab-task" class="active">タスク追加</button>
            <button id="tab-node">ノード操作</button>
          </nav>
          <div id="form-task" class="modal-tab-content">
            <div class="input-grid">
              <div class="input-group"><label>タスク名</label><input type="text" id="task-title"></div>
              <div class="input-group">
                <label>スロット</label>
                <select id="task-slot">
                  <option value="STOCK">📦 STOCK (ストック)</option>
                  ${(Object.keys(TIME_SLOTS).filter(k => k !== 'STOCK')).map(id => `<option value="${id}">${id} - ${TIME_SLOTS[id].name}</option>`).join('')}
                </select>
              </div>
              <div class="input-group"><label>見積時間 (分)</label><input type="number" id="task-estimated" value="60"></div>
              <div class="input-group"><label>推定HP消費</label><input type="number" id="task-hp-est" value="10"></div>
            </div>
            <div class="input-group"><label>完了定義 (DoD)</label><textarea id="task-dod"></textarea></div>
            <div class="input-group"><label>品質基準 / リスク</label><textarea id="task-quality"></textarea></div>
          </div>
          <div id="form-node" class="modal-tab-content" style="display:none">
            <div class="input-group"><label id="node-label">ノード名</label><input type="text" id="node-text"></div>
          </div>
          <div class="modal-controls">
            <button id="creation-cancel" class="btn">キャンセル</button>
            <button id="creation-submit" class="btn primary">保存</button>
          </div>
        </div>
      </div>

      <div id="completion-modal" class="modal-overlay" style="display:none">
        <div class="modal-content">
          <h2>実績記録 (Fact-Check)</h2>
          <div class="input-group">
            <label>HP消費量</label>
            <div class="rating-group" id="hp-rating">
              <button data-value="25" class="btn">😫</button>
              <button data-value="20" class="btn">😩</button>
              <button data-value="15" class="btn">😐</button>
              <button data-value="10" class="btn">😊</button>
              <button data-value="5" class="btn">🤩</button>
            </div>
          </div>
          <div class="input-group">
            <label>品質評価</label>
            <div class="rating-group" id="quality-rating">
              <button data-value="1" class="btn">Low</button>
              <button data-value="2" class="btn">Mid</button>
              <button data-value="3" class="btn">High</button>
            </div>
          </div>
          <div class="input-group"><label><input type="checkbox" id="risk-check"> リスク顕在化</label></div>
          <div class="input-group"><label>内省ノート</label><textarea id="completion-note"></textarea></div>
          <div class="modal-controls">
            <button id="modal-cancel" class="btn">キャンセル</button>
            <button id="modal-submit" class="btn primary">実績保存</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    document.getElementById('add-task-btn')?.addEventListener('click', () => this.handleAddTask());
    const handleImport = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try { this.state = await ASMOSStorage.importState(file); ASMOSStorage.saveState(this.state); this.render(); }
        catch (err) { alert('読み込み失敗'); }
      }
    };
    document.getElementById('export-btn-dash')?.addEventListener('click', () => ASMOSStorage.exportState(this.state));
    document.getElementById('import-btn-dash')?.addEventListener('click', () => (document.getElementById('import-file-dash') as HTMLInputElement).click());
    document.getElementById('import-file-dash')?.addEventListener('change', handleImport);

    document.getElementById('modal-cancel')?.addEventListener('click', () => this.closeModal('completion-modal'));
    document.getElementById('modal-submit')?.addEventListener('click', () => this.handleModalSubmit());
    document.getElementById('creation-cancel')?.addEventListener('click', () => this.closeModal('creation-modal'));
    document.getElementById('creation-submit')?.addEventListener('click', () => this.handleCreationSubmit());
    document.getElementById('tab-task')?.addEventListener('click', () => this.switchCreationTab('task'));
    document.getElementById('tab-node')?.addEventListener('click', () => this.switchCreationTab('node'));
    
    document.getElementById('download-review-btn')?.addEventListener('click', () => this.downloadDailyReview());

    // Reflection & Action Inputs
    const memoGood = document.getElementById('memo-good') as HTMLTextAreaElement;
    const memoImprove = document.getElementById('memo-improve') as HTMLTextAreaElement;
    const memoAnalysis = document.getElementById('memo-analysis-markdown') as HTMLTextAreaElement;
    const memoNextActions = document.getElementById('memo-next-actions') as HTMLTextAreaElement;
    const memoInsight = document.getElementById('memo-insight') as HTMLTextAreaElement;

    memoGood?.addEventListener('input', (e) => { this.state.memoGood = (e.target as HTMLTextAreaElement).value; ASMOSStorage.saveState(this.state); });
    memoImprove?.addEventListener('input', (e) => { this.state.memoImprove = (e.target as HTMLTextAreaElement).value; ASMOSStorage.saveState(this.state); });
    memoAnalysis?.addEventListener('input', (e) => { 
      this.state.memoAnalysisMarkdown = (e.target as HTMLTextAreaElement).value; 
      ASMOSStorage.saveState(this.state); 
      this.updateMindMap('analysis');
    });
    memoNextActions?.addEventListener('input', (e) => { this.state.memoNextActions = (e.target as HTMLTextAreaElement).value; ASMOSStorage.saveState(this.state); });
    memoInsight?.addEventListener('input', (e) => { this.state.memoInsight = (e.target as HTMLTextAreaElement).value; ASMOSStorage.saveState(this.state); });

    this.setupRatingButtons('hp-rating');
    this.setupRatingButtons('quality-rating');

    const textarea = document.getElementById('mm-textarea') as HTMLTextAreaElement;
    textarea?.addEventListener('input', (e) => {
      this.state.mindMapMarkdown = (e.target as HTMLTextAreaElement).value;
      ASMOSStorage.saveState(this.state);
      this.updateMindMap('goal');
    });

    document.getElementById('mm-download-btn')?.addEventListener('click', () => this.downloadMindMap());
    document.getElementById('mm-upload-btn')?.addEventListener('click', () => (document.getElementById('mm-import-file') as HTMLInputElement).click());
    document.getElementById('mm-import-file')?.addEventListener('change', (e) => this.handleMindMapUpload(e));

    document.getElementById('mm-add-child')?.addEventListener('click', () => this.handleNodeAction('add'));
    document.getElementById('mm-edit-node')?.addEventListener('click', () => this.handleNodeAction('edit'));
    document.getElementById('mm-delete-node')?.addEventListener('click', () => this.guiDeleteNode());
    
    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.markmap-node') && !(e.target as HTMLElement).closest('.node-actions-menu')) this.hideNodeMenu();
    });
  }

  private initDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('task-card')) {
        e.dataTransfer?.setData('text/plain', target.id.replace('task-', ''));
        target.style.opacity = '0.5';
      }
    });
    document.addEventListener('dragend', (e) => {
      (e.target as HTMLElement).style.opacity = '1';
      document.querySelectorAll('.slot-column').forEach(el => el.classList.remove('drag-over'));
    });
    document.addEventListener('dragenter', (e) => {
      const target = (e.target as HTMLElement).closest('.slot-column');
      if (target) target.classList.add('drag-over');
    });
    document.addEventListener('dragleave', (e) => {
      const target = (e.target as HTMLElement).closest('.slot-column');
      if (target) target.classList.remove('drag-over');
    });
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest('.slot-column') as HTMLElement;
      const taskId = e.dataTransfer?.getData('text/plain');
      if (target && taskId) {
        const slotId = target.getAttribute('data-slot') as TimeSlotID;
        const columnType = target.getAttribute('data-column') as 'plan' | 'actual' | 'stock';
        this.handleTaskDrop(taskId, slotId, columnType);
      }
    });
  }

  private handleTaskDrop(taskId: string, slotId: TimeSlotID, columnType: 'plan' | 'actual' | 'stock') {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const wasActual = task.is_actual;
    task.slot = slotId;
    if (columnType === 'stock') {
      if (wasActual) this.state.userHP += task.cost.actual_hp;
      task.is_planned = false; task.is_actual = false; task.cost.actual_hp = 0;
    } else if (columnType === 'actual' && !wasActual) {
      this.currentTaskIdForModal = taskId;
      this.openCompletionModal();
      return;
    } else if (columnType === 'plan') {
      if (wasActual) { this.state.userHP += task.cost.actual_hp; task.is_actual = false; task.cost.actual_hp = 0; }
      task.is_planned = true;
    }
    ASMOSStorage.saveState(this.state);
    this.render();
  }

  public handleAddTaskInline(slot: TimeSlotID, column: 'plan' | 'actual' | 'stock') {
    this.currentTargetSlot = slot;
    this.currentTargetColumn = column;
    this.creationMode = 'task';
    this.openCreationModal();
    (document.getElementById('task-slot') as HTMLSelectElement).value = slot;
  }

  private handleAddTask() { this.creationMode = 'task'; this.openCreationModal(); }
  private handleNodeAction(action: 'add' | 'edit') { if (!this.selectedNode) return; this.creationMode = 'node'; this.nodeEditMode = action; this.openCreationModal(); }

  private openCreationModal() {
    const modal = document.getElementById('creation-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.switchCreationTab(this.creationMode);
      if (this.creationMode === 'task') (document.getElementById('task-title') as HTMLInputElement).value = '';
      else (document.getElementById('node-text') as HTMLInputElement).value = this.nodeEditMode === 'edit' ? this.selectedNode.content : '';
    }
  }

  private switchCreationTab(tab: 'task' | 'node') {
    this.creationMode = tab;
    document.getElementById('tab-task')?.classList.toggle('active', tab === 'task');
    document.getElementById('tab-node')?.classList.toggle('active', tab === 'node');
    document.getElementById('form-task')!.style.display = tab === 'task' ? 'block' : 'none';
    document.getElementById('form-node')!.style.display = tab === 'node' ? 'block' : 'none';
  }

  private handleCreationSubmit() {
    if (this.creationMode === 'task') this.submitTask();
    else if (this.nodeEditMode === 'add') this.guiAddChild();
    else this.guiEditNode();
  }

  private submitTask() {
    const title = (document.getElementById('task-title') as HTMLInputElement).value;
    const slot = (document.getElementById('task-slot') as HTMLSelectElement).value as TimeSlotID;
    if (!title) return;
    const newTask: TaskEntity = {
      id: crypto.randomUUID(), scope_id: 'WBS-001', title: title, slot: slot,
      cost: { estimated_time: 60, actual_time: 0, hp_consumption: 10, actual_hp: 0 },
      quality: { dod: '', success_criteria: '', actual_quality: 0 },
      risk: { potential_issue: '', mitigation: '', is_manifested: false },
      is_planned: slot !== 'STOCK', is_actual: false,
    };
    this.state.tasks.push(newTask);
    ASMOSStorage.saveState(this.state);
    this.render();
    this.closeModal('creation-modal');
  }

  private render() {
    this.renderDashboard();
    this.renderTimezone();
    this.renderReflectionFact();
  }

  private renderDashboard() {
    const plannedTasks = this.state.tasks.filter(t => t.is_planned);
    const actualTasks = this.state.tasks.filter(t => t.is_actual);
    const remainingCount = plannedTasks.filter(t => !t.is_actual).length;
    const totalPlannedMinutes = plannedTasks.reduce((sum, t) => sum + t.cost.estimated_time, 0);
    const totalActualHP = actualTasks.reduce((sum, t) => sum + t.cost.actual_hp, 0);

    document.getElementById('dash-hp-value')!.innerText = this.state.userHP.toString();
    document.getElementById('dash-planned-time')!.innerText = `${totalPlannedMinutes} min`;
    document.getElementById('dash-actual-time')!.innerText = `${totalActualHP} units`;
    document.getElementById('dash-remaining-tasks')!.innerText = remainingCount.toString();
  }

  private renderTimezone() {
    const stockCol = document.getElementById('tasks-stock');
    if (stockCol) {
      stockCol.innerHTML = this.state.tasks.filter(t => t.slot === 'STOCK').map(t => this.createTaskCardHTML(t, 'stock')).join('');
    }
    (Object.keys(TIME_SLOTS).filter(k => k !== 'STOCK')).forEach(slotId => {
      const planColumn = document.getElementById(`tasks-plan-${slotId}`);
      const actualColumn = document.getElementById(`tasks-actual-${slotId}`);
      if (planColumn && actualColumn) {
        const slotTasks = this.state.tasks.filter(t => t.slot === slotId);
        planColumn.innerHTML = `<button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'plan')">+</button>` + 
                               slotTasks.filter(t => t.is_planned).map(t => this.createTaskCardHTML(t, 'plan')).join('');
        actualColumn.innerHTML = `<button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'actual')">+</button>` + 
                                 slotTasks.filter(t => t.is_actual).map(t => this.createTaskCardHTML(t, 'actual')).join('');
      }
    });
  }

  private renderReflectionFact() {
    const factSummary = document.getElementById('fact-summary');
    const taskLogList = document.getElementById('fact-task-logs');
    
    if (factSummary) {
      const actuals = this.state.tasks.filter(t => t.is_actual);
      const totalHP = actuals.reduce((sum, t) => sum + (t.cost.actual_hp || 0), 0);
      factSummary.innerHTML = `実行タスク： ${actuals.length}<br>総HP消費量： ${totalHP}`;

      if (taskLogList) {
        if (actuals.length === 0) {
          taskLogList.innerHTML = '<div class="hint">完了済みのタスクはありません</div>';
        } else {
          taskLogList.innerHTML = actuals.map(t => `
            <div class="task-log-item" style="margin-bottom: 12px; border-left: 2px solid var(--accent-color); padding-left: 12px;">
              <div style="font-weight: 600; font-size: 0.9rem;">${t.title}</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${t.note || '(内省メモなし)'}</div>
            </div>
          `).join('');
        }
      }
    }
  }

  private createTaskCardHTML(task: TaskEntity, type: string): string {
    const isBoth = task.is_planned && task.is_actual;
    const isUnplanned = !task.is_planned && task.is_actual;
    const modifier = isBoth ? 'success' : (isUnplanned ? 'unplanned' : '');
    return `<div class="task-card ${modifier}" id="task-${task.id}" draggable="true">
      <div class="task-title">${task.title}</div>
      <div class="task-meta">
        <span>HP: ${task.is_actual ? '-' + task.cost.actual_hp : '予 ' + task.cost.hp_consumption}</span>
        <button onclick="window.app.toggleTask('${task.id}')" class="btn subtle">${task.is_actual ? '戻す' : '完了'}</button>
      </div>
    </div>`;
  }

  public toggleTask(id: string) {
    const task = this.state.tasks.find(t => t.id === id);
    if (!task) return;
    if (task.is_actual) {
      this.state.userHP += task.cost.actual_hp;
      task.is_actual = false; task.cost.actual_hp = 0;
      ASMOSStorage.saveState(this.state);
      this.render();
    } else {
      this.currentTaskIdForModal = id;
      this.openCompletionModal();
    }
  }

  private openCompletionModal() {
    const modal = document.getElementById('completion-modal');
    if (modal) modal.style.display = 'flex';
  }

  private handleModalSubmit() {
    if (!this.currentTaskIdForModal) return;
    const hpRating = document.getElementById('hp-rating')?.querySelector('button.selected')?.getAttribute('data-value');
    if (!hpRating) return alert('HPを選択してください');
    const task = this.state.tasks.find(t => t.id === this.currentTaskIdForModal);
    if (task) {
      task.cost.actual_hp = parseInt(hpRating);
      task.is_actual = true; this.state.userHP -= task.cost.actual_hp;
      ASMOSStorage.saveState(this.state);
      this.closeModal('completion-modal');
      this.render();
    }
  }

  private initNavigation() {
    document.getElementById('nav-dashboard')?.addEventListener('click', () => this.switchView('dashboard'));
    document.getElementById('nav-timezone')?.addEventListener('click', () => this.switchView('timezone'));
    document.getElementById('nav-mindmap')?.addEventListener('click', () => this.switchView('mindmap'));
    document.getElementById('nav-reflection')?.addEventListener('click', () => this.switchView('reflection'));
  }

  private switchView(view: string) {
    document.querySelectorAll('.app-view').forEach(el => (el as HTMLElement).style.display = 'none');
    document.getElementById(`${view}-view`)!.style.display = 'flex';
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`nav-${view}`)?.classList.add('active');
    if (view === 'mindmap') this.initMindMap('goal');
    if (view === 'reflection') this.initMindMap('analysis');
    this.hideNodeMenu();
  }

  private initMindMap(type: 'goal' | 'analysis') {
    const selector = type === 'goal' ? '#markmap-svg-goal' : '#markmap-svg-analysis';
    const instanceKey = type === 'goal' ? 'mmGoal' : 'mmAnalysis';
    if ((this as any)[instanceKey]) {
      this.updateMindMap(type);
      return;
    }
    (this as any)[instanceKey] = (window as any).markmap.Markmap.create(selector, { paddingX: 32 });
    this.updateMindMap(type);
  }

  private updateMindMap(type: 'goal' | 'analysis') {
    const instance = type === 'goal' ? this.mmGoal : this.mmAnalysis;
    if (!instance) return;
    const md = type === 'goal' ? this.state.mindMapMarkdown : this.state.memoAnalysisMarkdown;
    const { root } = new (window as any).markmap.Transformer().transform(md);
    instance.setData(root);
    instance.fit();
    if (type === 'goal') {
      setTimeout(() => {
        d3.selectAll('#markmap-svg-goal .markmap-node').on('click', (event: any, d: any) => { event.stopPropagation(); this.handleNodeClick(event, d); });
      }, 100);
    }
  }

  private handleNodeClick(event: any, nodeData: any) {
    this.selectedNode = nodeData;
    const menu = document.getElementById('mm-node-actions');
    if (menu) { menu.style.display = 'block'; menu.style.left = `${event.pageX + 10}px`; menu.style.top = `${event.pageY - 20}px`; }
  }

  private hideNodeMenu() {
    const menu = document.getElementById('mm-node-actions');
    if (menu) menu.style.display = 'none';
    this.selectedNode = null;
  }

  private guiAddChild() {
    const newName = (document.getElementById('node-text') as HTMLInputElement).value;
    if (!newName) return;
    const lines = this.state.mindMapMarkdown.split('\n');
    const idx = lines.findIndex(l => l.includes(this.selectedNode.content));
    if (idx === -1) return;
    const prefix = lines[idx].startsWith('#') ? lines[idx].match(/^#+/)?.[0] + '# ' : lines[idx].match(/^ */)?.[0] + '  - ';
    lines.splice(idx + 1, 0, prefix + newName);
    this.updateMarkdownState(lines.join('\n'));
    this.closeModal('creation-modal');
  }

  private guiEditNode() {
    const newName = (document.getElementById('node-text') as HTMLInputElement).value;
    if (!newName) return;
    const lines = this.state.mindMapMarkdown.split('\n');
    const idx = lines.findIndex(l => l.includes(this.selectedNode.content));
    if (idx === -1) return;
    lines[idx] = lines[idx].replace(this.selectedNode.content, newName);
    this.updateMarkdownState(lines.join('\n'));
    this.closeModal('creation-modal');
  }

  private guiDeleteNode() {
    if (!confirm(`「${this.selectedNode.content}」を削除しますか？`)) return;
    const lines = this.state.mindMapMarkdown.split('\n');
    const idx = lines.findIndex(l => l.includes(this.selectedNode.content));
    if (idx === -1) return;
    let count = 1;
    const level = this.getLineLevel(lines[idx]);
    for (let i = idx + 1; i < lines.length; i++) if (this.getLineLevel(lines[i]) > level) count++; else break;
    lines.splice(idx, count);
    this.updateMarkdownState(lines.join('\n'));
    this.hideNodeMenu();
  }

  private getLineLevel(line: string) {
    if (line.trim() === '') return 999;
    if (line.startsWith('#')) return line.match(/^#+/)?.[0].length || 0;
    return (line.match(/^ */)?.[0].length || 0) + 10;
  }

  private updateMarkdownState(newMd: string) {
    this.state.mindMapMarkdown = newMd;
    (document.getElementById('mm-textarea') as HTMLTextAreaElement).value = newMd;
    ASMOSStorage.saveState(this.state);
    this.updateMindMap('goal');
  }

  private setupRatingButtons(groupId: string) {
    const group = document.getElementById(groupId);
    group?.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { group.querySelectorAll('button').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }));
  }

  private closeModal(id: string) { document.getElementById(id)!.style.display = 'none'; if (id === 'creation-modal') this.hideNodeMenu(); }

  private downloadMindMap() {
    const blob = new Blob([this.state.mindMapMarkdown], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `asmos_mindmap_${new Date().toISOString().split('T')[0]}.md`; a.click();
  }

  private handleMindMapUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => this.updateMarkdownState(ev.target?.result as string); reader.readAsText(file); }
  }

  private downloadDailyReview() {
    const date = new Date().toISOString().split('T')[0];
    const fact = document.getElementById('fact-summary')?.innerText || '';
    const content = `# ASMOS Daily Reflection - ${date}

## 1. 事実 (Fact)
${fact}

## 2. 解釈 (Interpretation)
### よかったところ (Good)
${this.state.memoGood}

### 改善メモ (Improvement)
${this.state.memoImprove}

### 論理分析 (Logic Tree)
\`\`\`markdown
${this.state.memoAnalysisMarkdown}
\`\`\`

### 本質的な解釈 (Core Insight)
${this.state.memoInsight}

## 3. 判断 (Judgment)
### Next Actions
${this.state.memoNextActions}
`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `asmos_daily_reflection_${date}.md`; a.click();
  }
}

const app = new ASMOSApp();
(window as any).app = app;
