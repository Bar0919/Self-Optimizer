"use strict";
// ASMOS (Autonomous Self-Management OS)
// Core Application Logic & State Management
const TIME_SLOTS = {
    T1: { id: 'T1', timeRange: '05:00 - 09:00', name: 'Prime', attribute: '自己研鑽 / Jazz', rule: 'デジタルデトックス / 集中特化', startHour: 5, endHour: 9 },
    T2: { id: 'T2', timeRange: '09:00 - 12:00', name: 'Business AM', attribute: '業務（高負荷）', rule: '私用デバイス封印', startHour: 9, endHour: 12 },
    T3: { id: 'T3', timeRange: '12:00 - 13:00', name: 'Reset', attribute: '休憩 / 内省', rule: '業務連絡の完全遮断', startHour: 12, endHour: 13 },
    T4: { id: 'T4', timeRange: '13:00 - 18:15', name: 'Business PM', attribute: '業務（調整・ルーチン）', rule: '18:15以降の残業禁止フラグ', startHour: 13, endHour: 18.25 },
    T5: { id: 'T5', timeRange: '18:15 - 22:00', name: 'Private', attribute: '家族 / 翌日準備', rule: 'PCシャットダウン / 通知OFF', startHour: 18.25, endHour: 22 },
};
// --- Storage Manager ---
class ASMOSStorage {
    static loadState() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
            try {
                const state = JSON.parse(data);
                if (!state.mindMapMarkdown)
                    state.mindMapMarkdown = '# ASMOS Mind Map\n\n## 目的\n- 自己研鑽\n- 業務効率化\n\n## ステークホルダー\n- 家族\n- 同僚';
                if (state.memoAnalysisMarkdown === undefined)
                    state.memoAnalysisMarkdown = '# 問題分析（ロジックツリー）\n\n## 今日の課題\n- なぜ起きた？\n  - 原因A\n  - 原因B';
                if (state.ifThenPlans === undefined)
                    state.ifThenPlans = [];
                if (state.moodHistory === undefined)
                    state.moodHistory = [{ timestamp: new Date().toISOString(), value: 100, emoji: '🤩' }];
                // Project Migration
                if (state.projects === undefined) {
                    state.projects = [{ id: 'default-project', title: 'メインプロジェクト', markdown: state.mindMapMarkdown || '# New Project' }];
                    state.selectedProjectId = 'default-project';
                }
                if (state.selectedProjectId === undefined)
                    state.selectedProjectId = state.projects[0]?.id || null;
                state.tasks = state.tasks.map((t) => {
                    if (t.importance === undefined)
                        t.importance = 'Mid';
                    if (t.is_recovery === undefined)
                        t.is_recovery = false;
                    if (t.goal_label === undefined)
                        t.goal_label = '';
                    if (t.cost && t.cost.actual_time === undefined)
                        t.cost.actual_time = 0;
                    return t;
                });
                return state;
            }
            catch (e) {
                console.error('Failed to parse ASMOS state:', e);
            }
        }
        const defaultMarkdown = '# Default Project\n\n## 目的\n- 自己研鑽\n- 業務効率化';
        return {
            tasks: [],
            ifThenPlans: [],
            moodHistory: [{ timestamp: new Date().toISOString(), value: 100, emoji: '🤩' }],
            projects: [{ id: 'default-project', title: 'メインプロジェクト', markdown: defaultMarkdown }],
            selectedProjectId: 'default-project',
            mindMapMarkdown: defaultMarkdown,
            memoGood: '', memoImprove: '',
            memoAnalysisMarkdown: '# 問題分析\n\n## 今日の課題\n- なぜ起きた？',
            memoNextActions: '', memoInsight: ''
        };
    }
    static saveState(state) { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state)); }
    static exportState(state) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", `asmos_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    static importState(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    resolve(JSON.parse(e.target?.result));
                }
                catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }
}
ASMOSStorage.STORAGE_KEY = 'ASMOS_STATE';
// --- Application Controller ---
class ASMOSApp {
    constructor() {
        this.currentTaskIdForModal = null;
        this.editingTaskId = null;
        this.editingIfThenId = null;
        this.mmGoal = null;
        this.mmAnalysis = null;
        this.creationMode = 'task';
        this.currentTargetSlot = 'STOCK_DAY';
        this.currentTargetColumn = 'stock';
        this.state = ASMOSStorage.loadState();
        this.initUI();
        this.initNavigation();
        this.initDragAndDrop();
        this.startClock();
        this.render();
    }
    startClock() {
        setInterval(() => {
            this.updateTimeIndicator();
            this.render();
        }, 60000);
    }
    initUI() {
        const appDiv = document.getElementById('app');
        if (!appDiv)
            return;
        appDiv.innerHTML = `
      <!-- View 1: Integrated Dashboard -->
      <div id="dashboard-view" class="app-view">
        <header class="view-header">
          <h1>📊 統合ダッシュボード</h1>
          <div class="hp-container standard-panel" style="padding: 10px 20px; display: flex; align-items: center; gap: 15px;">
            <span class="hp-status" id="current-mood-status">Status: ${this.state.moodHistory[this.state.moodHistory.length - 1]?.emoji || '🤩'}</span>
            <span class="hp-status">Vitals Score: <span id="dash-hp-value">100</span></span>
          </div>
        </header>
        <div class="view-body">
          <div class="dashboard-container">
            <div class="summary-grid">
              <div class="summary-card standard-panel" style="grid-column: 1 / -1; height: 250px;">
                <h3>📈 Vital & Mood Trend</h3>
                <div id="mood-chart-dash" style="width: 100%; height: 180px;"></div>
              </div>
              <div class="summary-card standard-panel"><h3>📅 予定時間</h3><div class="value" id="dash-planned-time">0 min</div><div class="label">Planned Effort (adj)</div></div>
              <div class="summary-card success standard-panel"><h3>⚡ 実測時間</h3><div class="value" id="dash-actual-time">0 min</div><div class="label">Total Actual Consumption</div></div>
              <div class="summary-card warning standard-panel"><h3>📝 残タスク数</h3><div class="value" id="dash-remaining-tasks">0</div><div class="label">Unfinished Plans</div></div>
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
        <header class="view-header"><h1>🎯 目的管理 (Goal Management)</h1></header>
        <div class="view-body" style="padding: 0;">
          <div class="mindmap-container expanded">
            <div class="project-sidebar">
              <button id="add-project-btn" class="btn primary">+ 新規プロジェクト</button>
              <div id="project-list" style="margin-top: 15px;"></div>
            </div>
            <div class="mindmap-editor slim">
              <div class="mm-editor-header"><h3>✍️ エディタ</h3><div class="mm-controls"><button id="mm-download-btn" class="btn subtle">⬇️</button><button id="mm-upload-btn" class="btn subtle">⬆️</button><input type="file" id="mm-import-file" style="display:none" accept=".md"></div></div>
              <textarea id="mm-textarea" spellcheck="false"></textarea>
            </div>
            <div class="mindmap-visualizer full"><svg id="markmap-svg-goal"></svg></div>
          </div>
        </div>
      </div>

      <!-- View 3: If-Then Planning -->
      <div id="ifthen-view" class="app-view" style="display:none">
        <header class="view-header"><h1>💡 if-thenプランニング</h1><div class="controls"><button id="add-ifthen-btn" class="btn primary">+ 新規プラン追加</button></div></header>
        <div class="view-body"><div class="dashboard-container"><div id="ifthen-list"></div></div></div>
      </div>

      <!-- View 4: Execution -->
      <div id="timezone-view" class="app-view" style="display:none">
        <div class="timezone-layout">
          <aside class="stock-sidebar hierarchical">
            <div class="sidebar-header main"><h3>📦 タスク・ストック</h3></div>
            <section class="stock-level month"><div class="level-header"><span>🗓️ 月間</span><button class="add-inline-btn" onclick="window.app.handleAddTaskInline('STOCK_MONTH', 'stock')">+</button></div><div id="tasks-stock-month" class="slot-column stock" ondragover="event.preventDefault()" data-slot="STOCK_MONTH" data-column="stock"></div></section>
            <section class="stock-level week"><div class="level-header"><span>📅 週間</span><button class="add-inline-btn" onclick="window.app.handleAddTaskInline('STOCK_WEEK', 'stock')">+</button></div><div id="tasks-stock-week" class="slot-column stock" ondragover="event.preventDefault()" data-slot="STOCK_WEEK" data-column="stock"></div></section>
            <section class="stock-level day today"><div class="level-header"><span>🚀 本日</span><button class="add-inline-btn" onclick="window.app.handleAddTaskInline('STOCK_DAY', 'stock')">+</button></div><div id="tasks-stock-day" class="slot-column stock" ondragover="event.preventDefault()" data-slot="STOCK_DAY" data-column="stock"></div></section>
          </aside>
          <main class="timeline-main">
            <header class="view-header"><h1>⏳ 実行管理</h1><div class="controls"><button id="auto-schedule-btn" class="btn warning">⚡ 自動スケジューリング</button><button id="add-task-btn" class="btn primary">+ 新規タスク</button></div></header>
            <div class="view-body" style="padding: 0; position: relative;">
              <div id="time-indicator"><span>NOW</span></div>
              <div class="time-slots-container">
                <div class="timeline-headers"><div class="header-time">時間枠</div><div class="header-plan">🗓️ 計画 (Plan)</div><div class="header-actual">✅ 実行 (Actual)</div></div>
                ${Object.keys(TIME_SLOTS).map(slotId => `<div class="time-slot" id="slot-${slotId}"><div class="slot-header"><span class="slot-id">${slotId}</span><span class="slot-name">${TIME_SLOTS[slotId].name}</span><span class="slot-time">${TIME_SLOTS[slotId].timeRange}</span></div><div class="slot-column plan" id="tasks-plan-${slotId}" ondragover="event.preventDefault()" data-slot="${slotId}" data-column="plan"><button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'plan')">+</button></div><div class="slot-column actual" id="tasks-actual-${slotId}" ondragover="event.preventDefault()" data-slot="${slotId}" data-column="actual"><button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'actual')">+</button></div></div>`).join('')}
              </div>
            </div>
          </main>
        </div>
      </div>

      <!-- View 5: Reflection -->
      <div id="reflection-view" class="app-view" style="display:none">
        <header class="view-header"><h1>🧠 内省とアクション (Review)</h1><button id="download-review-btn" class="btn primary">📄 レポート出力</button></header>
        <div class="view-body">
          <div class="memo-container enhanced">
            <div class="analysis-workflow">
              <section class="analysis-section">
                <div class="section-label">事実 (Fact)</div>
                <div class="box-header"><span class="icon">🔍</span><h3>本日の実績とタスクログ</h3></div>
                <div class="memo-section fact-summary-box standard-panel">
                  <div id="fact-summary" class="summary-text">算出中...</div>
                  <div style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                    <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">📉 Vital Variation Analysis</h4>
                    <div id="mood-chart-review" style="width: 100%; height: 150px;"></div>
                  </div>
                  <div class="fact-sub-label" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 15px; font-size: 0.8rem; color: var(--text-secondary);">完了タスクの振り返りメモ:</div>
                  <div id="fact-task-logs" class="task-log-list" style="margin-top: 10px;"></div>
                </div>
              </section>
              <section class="analysis-section"><div class="section-label">状況整理 (Context)</div><div class="memo-grid-horizontal"><div class="memo-section-box good standard-panel"><div class="box-header"><span class="icon">✅</span><h4>成功要因 (Good)</h4></div><textarea id="memo-good">${this.state.memoGood}</textarea></div><div class="memo-section-box improve standard-panel"><div class="box-header"><span class="icon">🛠️</span><h4>改善メモ (Improvement)</h4></div><textarea id="memo-improve">${this.state.memoImprove}</textarea></div></div></section>
              <section class="analysis-section"><div class="section-label">論理分解 (Why)</div><div class="box-header"><span class="icon">🌳</span><h3>問題分析ロジックツリー</h3></div><div class="analysis-tree-container"><textarea id="memo-analysis-markdown" class="standard-panel">${this.state.memoAnalysisMarkdown}</textarea><div class="analysis-visualizer standard-panel"><svg id="markmap-svg-analysis"></svg></div></div></section>
              <section class="analysis-section insight-focus"><div class="section-label">本質的な解釈 (Insight)</div><div class="box-header"><span class="icon">💡</span><h3>The Core Insight</h3></div><textarea id="memo-insight" placeholder="本質的な学びを一言で">${this.state.memoInsight}</textarea></section>
              <section class="analysis-section action-focus"><div class="section-label">判断 (Judgment)</div><div class="box-header"><span class="icon">🚀</span><h3>明日へのアクションプラン</h3></div><div class="memo-section action-section standard-panel"><textarea id="memo-next-actions">${this.state.memoNextActions}</textarea></div></section>
            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <div id="creation-modal" class="modal-overlay" style="display:none">
        <div class="modal-content large">
          <nav class="modal-tabs"><button id="tab-task" class="active">✨ タスク設定</button><button id="tab-ifthen">💡 if-then設定</button></nav>
          <div id="form-task" class="modal-tab-content">
            <div class="input-grid">
              <div class="input-group"><label>タスク名</label><input type="text" id="task-title"></div>
              <div class="input-group"><label>スロット</label><select id="task-slot"><option value="STOCK_MONTH">🗓️ 月間ストック</option><option value="STOCK_WEEK">📅 週間ストック</option><option value="STOCK_DAY">🚀 本日ストック</option>${Object.keys(TIME_SLOTS).map(id => `<option value="${id}">${id} - ${TIME_SLOTS[id].name}</option>`).join('')}</select></div>
              <div class="input-group"><label>重要度</label><select id="task-importance"><option value="High">🔴 高</option><option value="Mid" selected>🟡 中</option><option value="Low">🔵 低</option></select></div>
              <div class="input-group"><label>プロジェクト</label><select id="task-project-id"><option value="">(なし)</option></select></div>
              <div class="input-group"><label>締め切り時刻</label><input type="time" id="task-deadline"></div>
              <div class="input-group"><label>見積時間 (分)</label><input type="number" id="task-estimated" value="60"></div>
              <div class="input-group"><label>モード</label><select id="task-mode"><option value="normal">⚡ 消費</option><option value="recovery">🌿 回復</option></select></div>
            </div>
            <div class="input-group"><label>完了定義 (DoD) <span style="color: var(--danger-color); font-weight: bold;">(必須)</span></label><textarea id="task-dod" placeholder="例: 報告書のドラフトを受領確認まで"></textarea></div>
          </div>
          <div id="form-ifthen" class="modal-tab-content" style="display:none"><div class="input-grid"><div class="input-group"><label>もし〜なら (Condition)</label><input type="text" id="ifthen-condition" placeholder="例: 18:15になったら"></div><div class="input-group"><label>そのとき〜する (Action)</label><input type="text" id="ifthen-action" placeholder="例: PCをシャットダウン"></div><div class="input-group"><label>カテゴリ</label><select id="ifthen-category"><option value="Habit">🏃 習慣</option><option value="Risk">🛡️ リスク回避</option><option value="Work">💼 業務</option></select></div></div></div>
          <div class="modal-controls"><button id="creation-delete" class="btn danger" style="display:none; margin-right: auto;">🗑️ 削除</button><button id="creation-cancel" class="btn">キャンセル</button><button id="creation-submit" class="btn primary">保存</button></div>
        </div>
      </div>

      <div id="completion-modal" class="modal-overlay" style="display:none">
        <div class="modal-content">
          <div class="box-header"><span class="icon">🏁</span><h2>実績記録</h2></div>
          <div class="input-group"><label>今の気分・状態</label><div class="rating-group" id="mood-rating"><button data-value="-100" class="btn">😫</button><button data-value="-50" class="btn">😩</button><button data-value="0" class="btn">😐</button><button data-value="50" class="btn">😊</button><button data-value="100" class="btn">🤩</button></div></div>
          <div class="input-group"><label>品質評価</label><div class="rating-group" id="quality-rating"><button data-value="1" class="btn">Low</button><button data-value="2" class="btn">Mid</button><button data-value="3" class="btn">High</button></div></div>
          <div class="input-group"><label>実際にかかった時間 (分)</label><input type="number" id="completion-actual-time" value="60"></div>
          <div class="input-group"><label><input type="checkbox" id="risk-check"> リスク顕在化</label></div>
          <div class="input-group"><label>内省ノート</label><textarea id="completion-note"></textarea></div>
          <div class="modal-controls"><button id="modal-cancel" class="btn">キャンセル</button><button id="modal-submit" class="btn primary">実績保存</button></div>
        </div>
      </div>
    `;
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('add-task-btn')?.addEventListener('click', () => this.handleAddTask());
        document.getElementById('auto-schedule-btn')?.addEventListener('click', () => this.autoScheduleTasks());
        document.getElementById('export-btn-dash')?.addEventListener('click', () => ASMOSStorage.exportState(this.state));
        document.getElementById('import-btn-dash')?.addEventListener('click', () => document.getElementById('import-file-dash').click());
        document.getElementById('import-file-dash')?.addEventListener('change', async (e) => {
            const f = e.target.files?.[0];
            if (f) {
                try {
                    this.state = await ASMOSStorage.importState(f);
                    ASMOSStorage.saveState(this.state);
                    this.render();
                }
                catch (err) {
                    alert('失敗');
                }
            }
        });
        document.getElementById('modal-cancel')?.addEventListener('click', () => this.closeModal('completion-modal'));
        document.getElementById('modal-submit')?.addEventListener('click', () => this.handleModalSubmit());
        document.getElementById('creation-cancel')?.addEventListener('click', () => this.closeModal('creation-modal'));
        document.getElementById('creation-submit')?.addEventListener('click', () => this.handleCreationSubmit());
        document.getElementById('creation-delete')?.addEventListener('click', () => this.handleDeleteEntry());
        document.getElementById('tab-task')?.addEventListener('click', () => this.switchCreationTab('task'));
        document.getElementById('tab-ifthen')?.addEventListener('click', () => this.switchCreationTab('ifthen'));
        document.getElementById('add-ifthen-btn')?.addEventListener('click', () => this.handleAddIfThen());
        document.getElementById('download-review-btn')?.addEventListener('click', () => this.downloadDailyReview());
        ['memo-good', 'memo-improve', 'memo-insight', 'memo-next-actions'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', (e) => {
                this.state[id.replace('memo-', 'memo')] = e.target.value;
                ASMOSStorage.saveState(this.state);
            });
        });
        document.getElementById('memo-analysis-markdown')?.addEventListener('input', (e) => {
            this.state.memoAnalysisMarkdown = e.target.value;
            ASMOSStorage.saveState(this.state);
            this.updateMindMap('analysis');
        });
        this.setupRatingButtons('mood-rating');
        this.setupRatingButtons('quality-rating');
        document.getElementById('mm-textarea')?.addEventListener('input', (e) => {
            const proj = this.state.projects.find(p => p.id === this.state.selectedProjectId);
            if (proj) {
                proj.markdown = e.target.value;
                ASMOSStorage.saveState(this.state);
                this.updateMindMap('goal');
            }
        });
        document.getElementById('mm-download-btn')?.addEventListener('click', () => this.downloadMindMap());
        document.getElementById('mm-upload-btn')?.addEventListener('click', () => document.getElementById('mm-import-file').click());
        document.getElementById('mm-import-file')?.addEventListener('change', (e) => this.handleMindMapUpload(e));
        document.getElementById('add-project-btn')?.addEventListener('click', () => this.addProject());
    }
    renderProjects() {
        const list = document.getElementById('project-list');
        if (!list)
            return;
        list.innerHTML = this.state.projects.map(p => `
      <div class="project-item ${p.id === this.state.selectedProjectId ? 'active' : ''}" onclick="window.app.selectProject('${p.id}')">
        <span>${p.title}</span>
        <button class="delete-btn btn subtle" onclick="event.stopPropagation(); window.app.deleteProject('${p.id}')">🗑️</button>
      </div>
    `).join('');
    }
    addProject() {
        const title = prompt('プロジェクト名を入力してください');
        if (!title)
            return;
        const newProject = { id: crypto.randomUUID(), title: title, markdown: `# ${title}\n\n## 目的\n- ` };
        this.state.projects.push(newProject);
        this.state.selectedProjectId = newProject.id;
        ASMOSStorage.saveState(this.state);
        this.renderProjects();
        this.updateMindMap('goal');
    }
    deleteProject(id) {
        if (this.state.projects.length <= 1)
            return alert('最後のプロジェクトは削除できません');
        if (!confirm('プロジェクトを削除しますか？'))
            return;
        this.state.projects = this.state.projects.filter(p => p.id !== id);
        if (this.state.selectedProjectId === id)
            this.state.selectedProjectId = this.state.projects[0].id;
        ASMOSStorage.saveState(this.state);
        this.renderProjects();
        this.updateMindMap('goal');
    }
    selectProject(id) {
        const current = this.state.projects.find(p => p.id === this.state.selectedProjectId);
        if (current)
            current.markdown = document.getElementById('mm-textarea').value;
        this.state.selectedProjectId = id;
        const next = this.state.projects.find(p => p.id === id);
        if (next)
            document.getElementById('mm-textarea').value = next.markdown;
        ASMOSStorage.saveState(this.state);
        this.renderProjects();
        this.updateMindMap('goal');
    }
    initDragAndDrop() {
        document.addEventListener('dragstart', (e) => { const target = e.target; if (target.classList.contains('task-card')) {
            e.dataTransfer?.setData('text/plain', target.id.replace('task-', ''));
            target.style.opacity = '0.5';
        } });
        document.addEventListener('dragend', (e) => { e.target.style.opacity = '1'; document.querySelectorAll('.slot-column').forEach(el => el.classList.remove('drag-over')); });
        document.addEventListener('dragenter', (e) => { const target = e.target.closest('.slot-column'); if (target)
            target.classList.add('drag-over'); });
        document.addEventListener('dragleave', (e) => { const target = e.target.closest('.slot-column'); if (target)
            target.classList.remove('drag-over'); });
        document.addEventListener('drop', (e) => { e.preventDefault(); const target = e.target.closest('.slot-column'); const taskId = e.dataTransfer?.getData('text/plain'); if (target && taskId) {
            const slotId = target.getAttribute('data-slot');
            const col = target.getAttribute('data-column');
            this.handleTaskDrop(taskId, slotId, col);
        } });
    }
    handleTaskDrop(taskId, slotId, column) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task)
            return;
        const wasActual = task.is_actual;
        task.slot = slotId;
        if (column === 'stock') {
            task.is_planned = false;
            task.is_actual = false;
            task.cost.actual_time = 0;
        }
        else if (column === 'actual' && !wasActual) {
            this.currentTaskIdForModal = taskId;
            this.openCompletionModal(task);
            return;
        }
        else if (column === 'plan') {
            task.is_actual = false;
            task.cost.actual_time = 0;
            task.is_planned = true;
        }
        ASMOSStorage.saveState(this.state);
        this.render();
    }
    calculateUrgency(deadline) {
        if (!deadline)
            return { score: 0, label: '' };
        const now = new Date();
        const [h, m] = deadline.split(':').map(Number);
        const deadDate = new Date();
        deadDate.setHours(h, m, 0);
        const diffMin = (deadDate.getTime() - now.getTime()) / 60000;
        if (diffMin < 0)
            return { score: 100, label: 'OVER' };
        if (diffMin > 180)
            return { score: 10, label: '' };
        return { score: Math.floor(100 - (diffMin / 180) * 100), label: diffMin < 30 ? 'SOON' : '' };
    }
    getImportanceValue(imp) { return imp === 'High' ? 3 : (imp === 'Mid' ? 2 : 1); }
    getTaskScore(task) { return this.getImportanceValue(task.importance) * this.calculateUrgency(task.deadline).score; }
    getAdjustedTime(minutes) { return Math.ceil(minutes * 1.5); }
    autoScheduleTasks() {
        const unassignedTasks = this.state.tasks.filter(t => t.slot === 'STOCK_DAY' && !t.is_actual);
        if (unassignedTasks.length === 0)
            return;
        unassignedTasks.sort((a, b) => {
            if (a.goal_label !== b.goal_label)
                return (a.goal_label || '').localeCompare(b.goal_label || '');
            return this.getTaskScore(b) - this.getTaskScore(a);
        });
        const slotCapacities = {};
        Object.keys(TIME_SLOTS).forEach(slotId => {
            const cfg = TIME_SLOTS[slotId];
            const totalCap = (cfg.endHour - cfg.startHour) * 60;
            const usableCap = totalCap * 0.8;
            const currentUsage = this.state.tasks.filter(t => t.slot === slotId && t.is_planned).reduce((sum, t) => sum + this.getAdjustedTime(t.cost.estimated_time), 0);
            slotCapacities[slotId] = usableCap - currentUsage;
        });
        const GLOBAL_LIMIT = 480;
        let currentTotalPlanned = this.state.tasks.filter(t => t.is_planned && !t.slot.startsWith('STOCK')).reduce((s, t) => s + this.getAdjustedTime(t.cost.estimated_time), 0);
        let allocationCount = 0;
        for (const task of unassignedTasks) {
            const adjustedTime = this.getAdjustedTime(task.cost.estimated_time);
            if (currentTotalPlanned + adjustedTime > GLOBAL_LIMIT)
                continue;
            for (const slotId of Object.keys(TIME_SLOTS)) {
                if (slotCapacities[slotId] >= adjustedTime) {
                    task.slot = slotId;
                    task.is_planned = true;
                    slotCapacities[slotId] -= adjustedTime;
                    currentTotalPlanned += adjustedTime;
                    allocationCount++;
                    break;
                }
            }
        }
        if (allocationCount > 0) {
            ASMOSStorage.saveState(this.state);
            this.render();
            alert(`⚡ ${allocationCount}件を最適配置。`);
        }
        else {
            alert('⚠️ 配置可能な枠がありません。');
        }
    }
    render() {
        this.renderDashboard();
        this.renderTimezone();
        this.renderProjects(); // Render project list in sidebar
        this.renderIfthen();
        this.renderReflectionFact();
        this.updateTimeIndicator();
    }
    renderDashboard() {
        const plannedTasks = this.state.tasks.filter(t => t.is_planned);
        const actualTasks = this.state.tasks.filter(t => t.is_actual);
        const lastMood = this.state.moodHistory[this.state.moodHistory.length - 1];
        const hpStatus = document.getElementById('current-mood-status');
        if (hpStatus)
            hpStatus.innerText = `Status: ${lastMood?.emoji || '🤩'}`;
        const dashHP = document.getElementById('dash-hp-value');
        if (dashHP)
            dashHP.innerText = (lastMood?.value || 100).toString();
        document.getElementById('dash-planned-time').innerText = `${plannedTasks.reduce((s, t) => s + this.getAdjustedTime(t.cost.estimated_time), 0)} min`;
        document.getElementById('dash-actual-time').innerText = `${actualTasks.reduce((s, t) => s + t.cost.actual_time, 0)} min`;
        document.getElementById('dash-remaining-tasks').innerText = plannedTasks.filter(t => !t.is_actual).length.toString();
        this.drawMoodChart('mood-chart-dash', this.state.moodHistory);
    }
    renderTimezone() {
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        ['STOCK_MONTH', 'STOCK_WEEK', 'STOCK_DAY'].forEach(lvl => {
            const col = document.getElementById(`tasks-stock-${lvl.split('_')[1].toLowerCase()}`);
            if (col) {
                let tasks = this.state.tasks.filter(t => t.slot === lvl);
                if (lvl === 'STOCK_DAY')
                    tasks.sort((a, b) => this.getTaskScore(b) - this.getTaskScore(a));
                col.innerHTML = tasks.map(t => this.createTaskCardHTML(t, 'stock')).join('');
            }
        });
        Object.keys(TIME_SLOTS).forEach(slotId => {
            const pCol = document.getElementById(`tasks-plan-${slotId}`);
            const aCol = document.getElementById(`tasks-actual-${slotId}`);
            const el = document.getElementById(`slot-${slotId}`);
            if (pCol && aCol && el) {
                const cfg = TIME_SLOTS[slotId];
                const totalCap = (cfg.endHour - cfg.startHour) * 60;
                const usableCap = Math.floor(totalCap * 0.8);
                const tasks = this.state.tasks.filter(t => t.slot === slotId);
                const plTasks = tasks.filter(t => t.is_planned);
                const totalAdjustedUsage = plTasks.reduce((s, t) => s + this.getAdjustedTime(t.cost.estimated_time), 0);
                const overUsable = totalAdjustedUsage > usableCap;
                const isOverdue = currentHour > cfg.endHour;
                const head = el.querySelector('.slot-header');
                if (head) {
                    const old = head.querySelector('.slot-time-usage');
                    if (old)
                        old.remove();
                    head.insertAdjacentHTML('beforeend', `<div class="slot-time-usage ${overUsable ? 'error' : ''}">${totalAdjustedUsage}/${usableCap}m (adj) ${overUsable ? `<span class="over-label">⚠️ NO SLACK</span>` : ''}<div style="font-size: 0.6rem; opacity: 0.6; margin-top: 2px;">Slack Reserved: ${totalCap - usableCap}m</div></div>`);
                }
                el.classList.toggle('over-capacity', overUsable);
                const hasUnfinished = plTasks.some(t => !t.is_actual);
                el.style.backgroundColor = (isOverdue && hasUnfinished) ? 'rgba(218, 54, 51, 0.08)' : '';
                pCol.innerHTML = `<button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'plan')">+</button>` + plTasks.map(t => this.createTaskCardHTML(t, 'plan')).join('');
                aCol.innerHTML = `<button class="add-inline-btn" onclick="window.app.handleAddTaskInline('${slotId}', 'actual')">+</button>` + tasks.filter(t => t.is_actual).map(t => this.createTaskCardHTML(t, 'actual')).join('');
            }
        });
    }
    renderIfthen() {
        const listContainer = document.getElementById('ifthen-list');
        if (!listContainer)
            return;
        if (this.state.ifThenPlans.length === 0) {
            listContainer.innerHTML = '<div class="hint" style="text-align: center; padding: 40px;">まだプランがありません</div>';
            return;
        }
        const categories = [{ id: 'Habit', name: '🏃 習慣' }, { id: 'Risk', name: '🛡️ リスク回避' }, { id: 'Work', name: '💼 業務' }];
        listContainer.innerHTML = categories.map(cat => {
            const plans = this.state.ifThenPlans.filter(p => p.category === cat.id);
            if (plans.length === 0)
                return '';
            return `<section class="ifthen-genre-section"><h3 class="genre-title">${cat.name}</h3><div class="ifthen-grid">${plans.map(p => `<div class="ifthen-card standard-panel" onclick="window.app.handleEditIfThenPlan('${p.id}')"><div class="ifthen-logic"><div class="condition"><strong>If:</strong> ${p.condition}</div><div class="arrow">➔</div><div class="action"><strong>Then:</strong> ${p.action}</div></div></div>`).join('')}</div></section>`;
        }).join('');
    }
    renderReflectionFact() {
        const fact = document.getElementById('fact-summary');
        const logs = document.getElementById('fact-task-logs');
        if (fact) {
            const acts = this.state.tasks.filter(t => t.is_actual);
            const totalPlanned = acts.reduce((s, t) => s + this.getAdjustedTime(t.cost.estimated_time), 0);
            const totalActual = acts.reduce((s, t) => s + t.cost.actual_time, 0);
            const totalDiff = totalActual - totalPlanned;
            fact.innerHTML = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div><strong>実行タスク：</strong> ${acts.length}</div><div><strong>予定時間 (adj)：</strong> ${totalPlanned}m<br><strong>実測時間：</strong> ${totalActual}m <span style="color: ${totalDiff > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">(${totalDiff > 0 ? '+' : ''}${totalDiff}m)</span></div></div>`;
            if (logs)
                logs.innerHTML = acts.length === 0 ? '<div class="hint">なし</div>' : acts.map(t => {
                    const p = this.getAdjustedTime(t.cost.estimated_time);
                    const a = t.cost.actual_time;
                    const d = a - p;
                    return `<div class="task-log-item" style="margin-bottom: 15px; border-left: 3px solid var(--accent-color); padding-left: 15px;"><div style="display: flex; justify-content: space-between; align-items: baseline;"><div style="font-weight: 600; font-size: 0.95rem;">${t.title}</div><div style="font-size: 0.8rem; font-family: monospace;">${p}m (adj) ➔ ${a}m <strong style="color: ${d > 0 ? 'var(--danger-color)' : (d < 0 ? 'var(--success-color)' : 'var(--text-secondary)')};">(${d > 0 ? '+' : ''}${d}m)</strong></div></div><div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${t.note || '(なし)'}</div></div>`;
                }).join('');
            this.drawMoodChart('mood-chart-review', this.state.moodHistory);
        }
    }
    createTaskCardHTML(t, type) {
        const isBoth = t.is_planned && t.is_actual;
        const isUn = !t.is_planned && t.is_actual;
        const urg = this.calculateUrgency(t.deadline);
        const score = this.getTaskScore(t);
        let mod = isBoth ? 'success' : (isUn ? 'unplanned' : '');
        if (t.is_recovery)
            mod += ' recovery';
        const project = this.state.projects.find(p => p.id === t.goal_label);
        const projLabel = project ? project.title : '';
        return `<div class="task-card ${mod}" id="task-${t.id}" draggable="true" onclick="window.app.handleEditTask('${t.id}')"><div class="card-badges">${t.importance === 'High' ? '<span class="badge high">高</span>' : ''}${projLabel ? `<span class="badge goal">${projLabel}</span>` : ''}${score > 0 && t.slot === 'STOCK_DAY' ? `<span class="badge score">pts: ${score}</span>` : ''}${urg.score > 70 ? '<span class="badge urgency">🔥</span>' : ''}</div><div class="task-title">${t.title}</div><div class="task-meta"><span class="duration">⏱️ ${t.cost.estimated_time}m</span><button onclick="event.stopPropagation(); window.app.toggleTask('${t.id}')" class="btn subtle">${t.is_actual ? '戻す' : '完了'}</button></div></div>`;
    }
    handleAddTaskInline(slot, column) { this.currentTargetSlot = slot; this.currentTargetColumn = column; this.creationMode = 'task'; this.openCreationModal(); document.getElementById('task-slot').value = slot; }
    handleEditTask(id) { const t = this.state.tasks.find(x => x.id === id); if (t) {
        this.editingTaskId = id;
        this.creationMode = 'task';
        this.openCreationModal(t);
    } }
    handleEditIfThenPlan(id) { const p = this.state.ifThenPlans.find(x => x.id === id); if (p) {
        this.editingIfThenId = id;
        this.creationMode = 'ifthen';
        this.openCreationModal(p);
    } }
    handleAddIfThen() { this.editingIfThenId = null; this.creationMode = 'ifthen'; this.openCreationModal(); }
    handleDeleteEntry() {
        if (this.creationMode === 'task' && this.editingTaskId) {
            if (confirm('削除しますか？')) {
                this.state.tasks = this.state.tasks.filter(t => t.id !== this.editingTaskId);
                ASMOSStorage.saveState(this.state);
                this.render();
                this.closeModal('creation-modal');
            }
        }
        else if (this.creationMode === 'ifthen' && this.editingIfThenId) {
            if (confirm('削除しますか？')) {
                this.state.ifThenPlans = this.state.ifThenPlans.filter(p => p.id !== this.editingIfThenId);
                ASMOSStorage.saveState(this.state);
                this.renderIfthen();
                this.closeModal('creation-modal');
            }
        }
    }
    handleAddTask() { this.editingTaskId = null; this.creationMode = 'task'; this.openCreationModal(); }
    openCreationModal(entity) {
        const modal = document.getElementById('creation-modal');
        if (!modal)
            return;
        modal.style.display = 'flex';
        this.switchCreationTab(this.creationMode);
        const delBtn = document.getElementById('creation-delete');
        const subBtn = document.getElementById('creation-submit');
        if (this.creationMode === 'task') {
            const projSelect = document.getElementById('task-project-id');
            if (projSelect) {
                projSelect.innerHTML = '<option value="">(なし)</option>' + this.state.projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
            }
            if (delBtn)
                delBtn.style.display = entity ? 'block' : 'none';
            if (subBtn)
                subBtn.innerText = entity ? '更新' : '保存';
            document.getElementById('task-title').value = entity ? entity.title : '';
            document.getElementById('task-slot').value = entity ? entity.slot : this.currentTargetSlot;
            document.getElementById('task-importance').value = entity ? entity.importance : 'Mid';
            document.getElementById('task-project-id').value = entity ? (entity.goal_label || '') : '';
            document.getElementById('task-deadline').value = entity ? (entity.deadline || '') : '';
            document.getElementById('task-estimated').value = entity ? entity.cost.estimated_time.toString() : '60';
            document.getElementById('task-mode').value = entity ? (entity.is_recovery ? 'recovery' : 'normal') : 'normal';
            document.getElementById('task-dod').value = entity ? entity.quality.dod : '';
        }
        else {
            if (delBtn)
                delBtn.style.display = entity ? 'block' : 'none';
            if (subBtn)
                subBtn.innerText = entity ? '更新' : '保存';
            document.getElementById('ifthen-condition').value = entity ? entity.condition : '';
            document.getElementById('ifthen-action').value = entity ? entity.action : '';
            document.getElementById('ifthen-category').value = entity ? entity.category : 'Habit';
        }
    }
    switchCreationTab(tab) { this.creationMode = tab; document.getElementById('tab-task')?.classList.toggle('active', tab === 'task'); document.getElementById('tab-ifthen')?.classList.toggle('active', tab === 'ifthen'); document.getElementById('form-task').style.display = tab === 'task' ? 'block' : 'none'; document.getElementById('form-ifthen').style.display = tab === 'ifthen' ? 'block' : 'none'; }
    handleCreationSubmit() {
        if (this.creationMode === 'task') {
            const title = document.getElementById('task-title').value;
            if (!title)
                return;
            const dod = document.getElementById('task-dod').value.trim();
            if (!dod)
                return alert('❌ DoDは必須です');
            const data = { title, slot: document.getElementById('task-slot').value, importance: document.getElementById('task-importance').value, deadline: document.getElementById('task-deadline').value, goal_label: document.getElementById('task-project-id').value, is_recovery: document.getElementById('task-mode').value === 'recovery', est: parseInt(document.getElementById('task-estimated').value), dod };
            if (this.editingTaskId) {
                const t = this.state.tasks.find(x => x.id === this.editingTaskId);
                if (t) {
                    t.title = data.title;
                    t.slot = data.slot;
                    t.importance = data.importance;
                    t.deadline = data.deadline;
                    t.goal_label = data.goal_label;
                    t.is_recovery = data.is_recovery;
                    t.cost.estimated_time = data.est;
                    t.quality.dod = data.dod;
                }
            }
            else {
                this.state.tasks.push({ id: crypto.randomUUID(), scope_id: 'WBS-001', title: data.title, slot: data.slot, cost: { estimated_time: data.est, actual_time: 0 }, quality: { dod: data.dod, success_criteria: '', actual_quality: 0 }, risk: { potential_issue: '', mitigation: '', is_manifested: false }, is_planned: !data.slot.startsWith('STOCK'), is_actual: false, importance: data.importance, deadline: data.deadline, goal_label: data.goal_label, is_recovery: data.is_recovery });
            }
        }
        else {
            const cond = document.getElementById('ifthen-condition').value;
            const act = document.getElementById('ifthen-action').value;
            const cat = document.getElementById('ifthen-category').value;
            if (!cond || !act)
                return;
            if (this.editingIfThenId) {
                const p = this.state.ifThenPlans.find(x => x.id === this.editingIfThenId);
                if (p) {
                    p.condition = cond;
                    p.action = act;
                    p.category = cat;
                }
            }
            else {
                this.state.ifThenPlans.push({ id: crypto.randomUUID(), condition: cond, action: act, category: cat });
            }
        }
        ASMOSStorage.saveState(this.state);
        this.render();
        this.closeModal('creation-modal');
    }
    switchView(view) { document.querySelectorAll('.app-view').forEach(el => el.style.display = 'none'); document.getElementById(`${view}-view`).style.display = 'flex'; document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active')); document.getElementById(`nav-${view}`)?.classList.add('active'); if (view === 'mindmap')
        this.initMindMap('goal'); if (view === 'reflection')
        this.initMindMap('analysis'); if (view === 'ifthen')
        this.renderIfthen(); }
    initNavigation() { ['dashboard', 'mindmap', 'ifthen', 'timezone', 'reflection'].forEach(v => document.getElementById(`nav-${v}`)?.addEventListener('click', () => this.switchView(v))); }
    initMindMap(type) { const sel = type === 'goal' ? '#markmap-svg-goal' : '#markmap-svg-analysis'; const key = type === 'goal' ? 'mmGoal' : 'mmAnalysis'; if (this[key]) {
        this.updateMindMap(type);
        return;
    } this[key] = window.markmap.Markmap.create(sel, { paddingX: 32 }); this.updateMindMap(type); }
    updateMindMap(type) {
        const inst = type === 'goal' ? this.mmGoal : this.mmAnalysis;
        if (!inst)
            return;
        let md = '';
        if (type === 'goal') {
            const proj = this.state.projects.find(p => p.id === this.state.selectedProjectId);
            md = proj ? proj.markdown : '# Select a project';
            document.getElementById('mm-textarea').value = md;
        }
        else {
            md = this.state.memoAnalysisMarkdown;
        }
        const { root } = new window.markmap.Transformer().transform(md);
        inst.setData(root);
        setTimeout(() => inst.fit(), 50);
    }
    setupRatingButtons(gid) { const g = document.getElementById(gid); g?.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { g.querySelectorAll('button').forEach(x => x.classList.remove('selected')); b.classList.add('selected'); })); }
    closeModal(id) { document.getElementById(id).style.display = 'none'; }
    downloadMindMap() {
        const proj = this.state.projects.find(p => p.id === this.state.selectedProjectId);
        if (!proj)
            return;
        const b = new Blob([proj.markdown], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `asmos_goal_${proj.title}.md`;
        a.click();
    }
    handleMindMapUpload(e) { const f = e.target.files?.[0]; if (f) {
        const r = new FileReader();
        r.onload = (ev) => { this.state.mindMapMarkdown = ev.target?.result; document.getElementById('mm-textarea').value = this.state.mindMapMarkdown; ASMOSStorage.saveState(this.state); this.updateMindMap('goal'); };
        r.readAsText(f);
    } }
    updateTimeIndicator() { const ind = document.getElementById('time-indicator'); if (!ind)
        return; const now = new Date(); const current = now.getHours() + now.getMinutes() / 60; if (current < 5 || current > 22) {
        ind.style.display = 'none';
        return;
    } ind.style.display = 'block'; let target = ''; for (const id in TIME_SLOTS)
        if (current >= TIME_SLOTS[id].startHour && current < TIME_SLOTS[id].endHour) {
            target = id;
            break;
        } if (target) {
        const el = document.getElementById(`slot-${target}`);
        if (el) {
            const cfg = TIME_SLOTS[target];
            const pct = (current - cfg.startHour) / (cfg.endHour - cfg.startHour);
            ind.style.top = `${el.offsetTop + (el.offsetHeight * pct)}px`;
        }
    } }
    openCompletionModal(task) { const modal = document.getElementById('completion-modal'); if (!modal)
        return; modal.style.display = 'flex'; document.getElementById('completion-actual-time').value = this.getAdjustedTime(task.cost.estimated_time).toString(); }
    handleModalSubmit() {
        if (!this.currentTaskIdForModal)
            return;
        const moodBtn = document.getElementById('mood-rating')?.querySelector('button.selected');
        const moodVal = moodBtn?.getAttribute('data-value');
        const emoji = moodBtn?.innerText || '😐';
        if (!moodVal)
            return alert('気分を選択してください');
        const actualTime = parseInt(document.getElementById('completion-actual-time').value);
        if (isNaN(actualTime))
            return alert('実績時間を入力してください');
        const t = this.state.tasks.find(x => x.id === this.currentTaskIdForModal);
        if (t) {
            t.cost.actual_time = actualTime;
            t.is_actual = true;
            this.state.moodHistory.push({ timestamp: new Date().toISOString(), value: parseInt(moodVal), emoji });
            ASMOSStorage.saveState(this.state);
            this.closeModal('completion-modal');
            this.render();
        }
    }
    drawMoodChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container || data.length === 0)
            return;
        container.innerHTML = '';
        const width = container.clientWidth;
        const height = container.clientHeight;
        const margin = { top: 30, right: 30, bottom: 30, left: 40 };
        const svg = d3.select(`#${containerId}`).append('svg').attr('width', width).attr('height', height).append('g').attr('transform', `translate(${margin.left},${margin.top})`);
        const x = d3.scaleTime().domain(d3.extent(data, (d) => new Date(d.timestamp))).range([0, width - margin.left - margin.right]);
        const y = d3.scaleLinear().domain([-100, 100]).range([height - margin.top - margin.bottom, 0]);
        svg.append('g').attr('class', 'grid').attr('opacity', 0.05).call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ""));
        // Neutral line at 0
        svg.append('line')
            .attr('x1', 0)
            .attr('x2', width - margin.left - margin.right)
            .attr('y1', y(0))
            .attr('y2', y(0))
            .attr('stroke', 'var(--text-secondary)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4,4')
            .attr('opacity', 0.3);
        const line = d3.line().x((d) => x(new Date(d.timestamp))).y((d) => y(d.value)).curve(d3.curveMonotoneX);
        svg.append('path').datum(data).attr('fill', 'none').attr('stroke', 'var(--accent-color)').attr('stroke-width', 2).attr('d', line);
        const dots = svg.selectAll('.dot').data(data).enter().append('g').attr('transform', (d) => `translate(${x(new Date(d.timestamp))},${y(d.value)})`);
        dots.append('circle').attr('r', 4).attr('fill', 'var(--bg-color)').attr('stroke', 'var(--accent-color)').attr('stroke-width', 2);
        dots.append('text').text((d) => d.emoji).attr('y', -12).attr('text-anchor', 'middle').style('font-size', '12px');
        svg.append('g').attr('transform', `translate(0,${height - margin.top - margin.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%H:%M'))).style('color', 'var(--text-secondary)');
        svg.append('g').call(d3.axisLeft(y).ticks(5)).style('color', 'var(--text-secondary)');
    }
    downloadDailyReview() { const d = new Date().toISOString().split('T')[0]; const fact = document.getElementById('fact-summary')?.innerText || ''; const c = `# Reflection - ${d}\n\n## Fact\n${fact}\n\n## Interpretation\n### Good\n${this.state.memoGood}\n### Improvement\n${this.state.memoImprove}\n### Logic Tree\n${this.state.memoAnalysisMarkdown}\n### Insight\n${this.state.memoInsight}\n\n## Judgment\n${this.state.memoNextActions}`; const b = new Blob([c], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `reflection_${d}.md`; a.click(); }
    toggleTask(id) { const t = this.state.tasks.find(x => x.id === id); if (t) {
        if (t.is_actual) {
            t.is_actual = false;
            t.cost.actual_time = 0;
            ASMOSStorage.saveState(this.state);
            this.render();
        }
        else {
            this.currentTaskIdForModal = id;
            this.openCompletionModal(t);
        }
    } }
}
const app = new ASMOSApp();
window.app = app;
