"use strict";
/**
 * ASMOS (Autonomous Self-Management OS)
 * Vue 3, Vuetify 3, and mo.js
 * SVG Mind Map Engine (Custom D3 Alternative)
 * FIXED: Goal Achievement & Life-cycle Sync
 */
// --- 2. Infrastructure ---
class ASMOSStorage {
    static load() {
        const data = localStorage.getItem(this.KEY);
        if (data) {
            const state = JSON.parse(data);
            if (state.projects) {
                state.projects.forEach((p) => { if (p.status === undefined)
                    p.status = 'active'; });
            }
            return state;
        }
        const defaultMarkdown = '# 目標\n## [ ] 自己実現\n### 読書\n### 筋トレ\n## 業務効率化';
        return {
            tasks: [], ifThenPlans: [], moodHistory: [{ timestamp: new Date().toISOString(), value: 100, emoji: '🤩' }],
            projects: [{ id: 'default', title: 'メインプロジェクト', markdown: defaultMarkdown, status: 'active' }],
            selectedProjectId: 'default',
            memoGood: '', memoImprove: '', memoAnalysisMarkdown: '# 問題分析\n## なぜ起きた？\n### 環境要因\n### 人的ミス',
            memoNextActions: '', memoInsight: ''
        };
    }
    static save(state) { localStorage.setItem(this.KEY, JSON.stringify(state)); }
}
ASMOSStorage.KEY = 'ASMOS_VUE_STATE_V7';
class BiasEngine {
    static adjustTime(min) { return Math.ceil(min * 1.5); }
}
const TIME_SLOTS = {
    T1: { name: 'Prime', range: '05:00-09:00', start: 5, end: 9 },
    T2: { name: 'Business AM', range: '09:00-12:00', start: 9, end: 12 },
    T3: { name: 'Reset', range: '12:00-13:00', start: 12, end: 13 },
    T4: { name: 'Business PM', range: '13:00-18:15', start: 13, end: 18.25 },
    T5: { name: 'Private', range: '18:15-22:00', start: 18.25, end: 22 },
};
// --- 3. Vue Application ---
const { createApp, ref, reactive, computed, watch } = Vue;
const { createVuetify } = Vuetify;
const vuetify = createVuetify({
    theme: { defaultTheme: 'dark', themes: { dark: { colors: { primary: '#58a6ff', success: '#238636', warning: '#d29922', error: '#da3633', background: '#0d1117', surface: '#161b22' } } } }
});
const RootComponent = {
    setup() {
        const rawState = ASMOSStorage.load();
        const state = reactive(rawState);
        const activeTab = ref('dashboard');
        const creationModal = ref(false);
        const completionModal = ref(false);
        const projectModal = ref(false);
        const currentTask = ref(null);
        const creationMode = ref('task');
        const editingId = ref(null);
        const editingProjectId = ref(null);
        const formTask = reactive({ title: '', slot: 'STOCK_DAY', importance: 'Mid', project_id: '', deadline: '', est: 60, mode: 'normal', dod: '' });
        const formIfThen = reactive({ condition: '', action: '', category: 'Habit' });
        const formComplete = reactive({ mood: 0, actual_time: 0 });
        const formProject = reactive({ title: '', deadline: '', status: 'active' });
        watch(state, (newVal) => ASMOSStorage.save(newVal), { deep: true });
        const currentProject = computed(() => state.projects.find(p => p.id === state.selectedProjectId));
        const selectProject = (id) => {
            state.selectedProjectId = id;
            try {
                new mojs.Shape({ shape: 'circle', radius: { 0: 50 }, stroke: '#58a6ff', strokeWidth: 2, fill: 'none', duration: 1000 }).play();
            }
            catch (e) { }
        };
        const getRemainingDays = (deadline) => {
            if (!deadline)
                return null;
            const diff = new Date(deadline).getTime() - new Date().setHours(0, 0, 0, 0);
            return Math.ceil(diff / (1000 * 60 * 60 * 24));
        };
        const openProjectModal = (project) => {
            editingProjectId.value = project ? project.id : null;
            formProject.title = project ? project.title : '';
            formProject.deadline = project ? project.deadline || '' : '';
            formProject.status = project ? project.status : 'active';
            projectModal.value = true;
        };
        const submitProject = () => {
            if (!formProject.title)
                return alert('タイトルを入力してください');
            if (editingProjectId.value) {
                const p = state.projects.find(x => x.id === editingProjectId.value);
                if (p) {
                    const wasActive = p.status !== 'achieved';
                    p.title = formProject.title;
                    p.deadline = formProject.deadline;
                    p.status = formProject.status;
                    if (wasActive && p.status === 'achieved') {
                        try {
                            new mojs.Burst({ radius: { 0: 200 }, count: 20, children: { shape: 'polygon', fill: ['gold', 'white', 'cyan'], duration: 2000 } }).play();
                        }
                        catch (e) { }
                    }
                }
            }
            else {
                const newProj = { id: crypto.randomUUID(), title: formProject.title, markdown: `# ${formProject.title}\n\n## 目的\n- `, deadline: formProject.deadline, status: formProject.status };
                state.projects.push(newProj);
                state.selectedProjectId = newProj.id;
            }
            projectModal.value = false;
        };
        const deleteProject = (id) => {
            if (state.projects.length <= 1)
                return alert('最後のプロジェクトは削除できません');
            if (!confirm('プロジェクトを削除しますか？'))
                return;
            state.projects = state.projects.filter(p => p.id !== id);
            if (state.selectedProjectId === id)
                state.selectedProjectId = state.projects[0].id;
        };
        const getTaskScore = (t) => {
            const imp = t.importance === 'High' ? 3 : (t.importance === 'Mid' ? 2 : 1);
            let score = 0;
            if (t.deadline) {
                const [h, m] = t.deadline.split(':').map(Number);
                const diff = (new Date().setHours(h, m) - Date.now()) / 60000;
                score += imp * (diff < 0 ? 100 : (diff > 180 ? 10 : Math.floor(100 - (diff / 180) * 100)));
            }
            const proj = state.projects.find(p => p.id === t.project_id);
            if (proj && proj.deadline) {
                const days = getRemainingDays(proj.deadline);
                if (days !== null) {
                    if (days <= 0)
                        score += 500;
                    else if (days <= 3)
                        score += 300;
                    else if (days <= 7)
                        score += 100;
                }
            }
            return score;
        };
        // --- Mind Map & Task Sync ---
        const parseMarkdownToTree = (md) => {
            const lines = md.split('\n').filter(l => l.trim().startsWith('#'));
            if (lines.length === 0)
                return null;
            const processLine = (line) => {
                const rawText = line.replace(/^#+\s*/, '');
                const is_achieved = /\[\s*[xX]\s*\]/.test(rawText);
                const is_task = /\[\s* \s*\]/.test(rawText) || is_achieved;
                const cleanText = rawText.replace(/\[\s*[ xX]*\s*\]\s*/, '');
                return { text: cleanText, is_task, is_achieved };
            };
            const rootData = processLine(lines[0]);
            const root = { uid: 'root', text: rootData.text, is_task: rootData.is_task, is_achieved: rootData.is_achieved, depth: 1, children: [] };
            const stack = [root];
            for (let i = 1; i < lines.length; i++) {
                const data = processLine(lines[i]);
                const depth = (lines[i].match(/^#+/) || ['#'])[0].length;
                const node = { uid: 'node-' + i + '-' + data.text.substring(0, 5), text: data.text, is_task: data.is_task, is_achieved: data.is_achieved, depth, children: [] };
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth)
                    stack.pop();
                if (stack.length > 0)
                    stack[stack.length - 1].children.push(node);
                stack.push(node);
            }
            return root;
        };
        const syncTasksFromGoals = (tree) => {
            if (!tree || !state.selectedProjectId)
                return;
            const traverse = (node) => {
                if (node.is_task) {
                    let t = state.tasks.find(x => x.title === node.text && x.project_id === state.selectedProjectId);
                    if (!t) {
                        t = { id: crypto.randomUUID(), title: node.text, slot: 'STOCK_DAY', project_id: state.selectedProjectId || undefined, is_planned: false, is_actual: node.is_achieved, importance: 'Mid', is_recovery: false, cost: { estimated_time: 60, actual_time: 0 }, dod: 'From Strategy' };
                        state.tasks.push(t);
                    }
                    else {
                        if (node.is_achieved && !t.is_actual) {
                            t.is_actual = true;
                            t.cost.actual_time = BiasEngine.adjustTime(t.cost.estimated_time);
                        }
                        else if (!node.is_achieved && t.is_actual) {
                            t.is_actual = false;
                            t.cost.actual_time = 0;
                        }
                    }
                }
                node.children.forEach(traverse);
            };
            traverse(tree);
        };
        const cycleNodeState = (node) => {
            const proj = currentProject.value;
            if (!proj)
                return;
            const lines = proj.markdown.split('\n');
            const idx = lines.findIndex((l) => l.includes(node.text));
            if (idx !== -1) {
                const headerMatch = lines[idx].match(/^(#+)\s*/);
                const header = headerMatch ? headerMatch[0] : '# ';
                if (lines[idx].includes('[x]') || lines[idx].includes('[X]')) {
                    lines[idx] = lines[idx].replace(/\[\s*[xX]\s*\]\s*/, '');
                }
                else if (lines[idx].includes('[ ]')) {
                    lines[idx] = lines[idx].replace('[ ]', '[x]');
                }
                else {
                    lines[idx] = lines[idx].replace(header, header + '[ ] ');
                }
                proj.markdown = lines.join('\n');
                ASMOSStorage.save(state);
            }
        };
        const getTreeHeight = (node) => {
            if (node.children.length === 0)
                return 40;
            return node.children.reduce((acc, child) => acc + getTreeHeight(child), 0);
        };
        const calculateTreeLayout = (node, x, yStart) => {
            node.x = x;
            if (node.children.length === 0) {
                node.y = yStart + 20;
                return { yEnd: yStart + 40 };
            }
            let currentY = yStart;
            node.children.forEach(child => { const res = calculateTreeLayout(child, x + 240, currentY); currentY = res.yEnd; });
            const firstChildY = node.children[0].y || 0;
            const lastChildY = node.children[node.children.length - 1].y || 0;
            node.y = (firstChildY + lastChildY) / 2;
            return { yEnd: currentY };
        };
        const mindMapData = computed(() => {
            const md = currentProject.value?.markdown || '# No Strategy';
            const tree = parseMarkdownToTree(md);
            if (!tree)
                return { nodes: [], links: [] };
            syncTasksFromGoals(tree);
            calculateTreeLayout(tree, 60, 60);
            const nodes = [];
            const links = [];
            const traverse = (n) => {
                nodes.push({ id: n.uid, x: n.x, y: n.y, text: n.text, is_task: n.is_task, is_achieved: n.is_achieved });
                n.children.forEach(c => { links.push({ id: n.uid + '-' + c.uid, x1: n.x, y1: n.y, x2: c.x, y2: c.y }); traverse(c); });
            };
            traverse(tree);
            return { nodes, links };
        });
        const moodChartPath = computed(() => {
            if (state.moodHistory.length < 2)
                return '';
            const w = 800, h = 150;
            return state.moodHistory.map((d, i) => `${i === 0 ? 'M' : 'L'} ${(i / (state.moodHistory.length - 1)) * w} ${((100 - d.value) / 200) * h}`).join(' ');
        });
        const autoSchedule = () => {
            const stock = state.tasks.filter(t => t.slot === 'STOCK_DAY' && !t.is_actual);
            stock.sort((a, b) => getTaskScore(b) - getTaskScore(a));
            const caps = {};
            Object.keys(TIME_SLOTS).forEach(id => caps[id] = (TIME_SLOTS[id].end - TIME_SLOTS[id].start) * 60 * 0.8 - state.tasks.filter(t => t.slot === id && t.is_planned).reduce((s, t) => s + BiasEngine.adjustTime(t.cost.estimated_time), 0));
            stock.forEach(t => {
                const adj = BiasEngine.adjustTime(t.cost.estimated_time);
                for (const id of Object.keys(TIME_SLOTS)) {
                    if (caps[id] >= adj) {
                        t.slot = id;
                        t.is_planned = true;
                        caps[id] -= adj;
                        break;
                    }
                }
            });
        };
        const openCreation = (mode, entity) => {
            creationMode.value = mode;
            editingId.value = entity ? entity.id : null;
            if (mode === 'task')
                Object.assign(formTask, entity ? { ...entity, est: entity.cost.estimated_time } : { title: '', slot: 'STOCK_DAY', importance: 'Mid', project_id: state.selectedProjectId || '', deadline: '', est: 60, mode: 'normal', dod: '' });
            else
                Object.assign(formIfThen, entity ? { ...entity } : { condition: '', action: '', category: 'Habit' });
            creationModal.value = true;
        };
        const submitCreation = () => {
            if (creationMode.value === 'task') {
                if (!formTask.dod)
                    return alert('DoDは必須です');
                const data = { id: editingId.value || crypto.randomUUID(), title: formTask.title, slot: formTask.slot, importance: formTask.importance, project_id: formTask.project_id, deadline: formTask.deadline, is_recovery: formTask.mode === 'recovery', cost: { estimated_time: formTask.est, actual_time: 0 }, dod: formTask.dod, is_planned: !formTask.slot.startsWith('STOCK'), is_actual: false };
                if (editingId.value) {
                    const idx = state.tasks.findIndex(t => t.id === editingId.value);
                    if (idx !== -1)
                        state.tasks[idx] = data;
                }
                else
                    state.tasks.push(data);
            }
            else {
                const data = { id: editingId.value || crypto.randomUUID(), ...formIfThen };
                if (editingId.value) {
                    const idx = state.ifThenPlans.findIndex(p => p.id === editingId.value);
                    if (idx !== -1)
                        state.ifThenPlans[idx] = data;
                }
                else
                    state.ifThenPlans.push(data);
            }
            creationModal.value = false;
        };
        const toggleComplete = (task) => {
            if (task.is_actual) {
                task.is_actual = false;
                task.cost.actual_time = 0;
            }
            else {
                currentTask.value = task;
                formComplete.mood = 0;
                formComplete.actual_time = BiasEngine.adjustTime(task.cost.estimated_time);
                completionModal.value = true;
            }
        };
        const submitCompletion = () => {
            const t = currentTask.value;
            if (!t)
                return;
            t.is_actual = true;
            t.cost.actual_time = formComplete.actual_time;
            const emojiMap = { '-100': '😫', '-50': '😩', '0': '😐', '50': '😊', '100': '🤩' };
            state.moodHistory.push({ timestamp: new Date().toISOString(), value: formComplete.mood, emoji: emojiMap[formComplete.mood.toString()] || '😐' });
            try {
                new mojs.Burst({ radius: { 0: 100 }, count: 10, children: { shape: 'circle', fill: 'cyan', duration: 1500 } }).play();
            }
            catch (e) { }
            completionModal.value = false;
        };
        const downloadCurrentProject = () => {
            const proj = currentProject.value;
            if (!proj)
                return;
            const blob = new Blob([proj.markdown], { type: 'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${proj.title}.md`;
            a.click();
        };
        const triggerUpload = () => { document.getElementById('project-upload-input')?.click(); };
        const handleProjectUpload = (e) => {
            const file = e.target.files[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = (event) => { if (currentProject.value) {
                currentProject.value.markdown = event.target.result;
                alert('アップロード完了');
            } };
            reader.readAsText(file);
        };
        const deleteEntry = () => {
            if (creationMode.value === 'task')
                state.tasks = state.tasks.filter(t => t.id !== editingId.value);
            else
                state.ifThenPlans = state.ifThenPlans.filter(p => p.id !== editingId.value);
            creationModal.value = false;
        };
        return {
            state, activeTab, creationModal, completionModal, projectModal, currentTask, creationMode, editingId, editingProjectId,
            formTask, formIfThen, formComplete, formProject, TIME_SLOTS, moodChartPath, mindMapData,
            selectProject, currentProject, autoSchedule, openCreation, submitCreation, toggleComplete, submitCompletion,
            openProjectModal, submitProject, deleteProject, downloadCurrentProject, triggerUpload, handleProjectUpload, getRemainingDays, deleteEntry,
            cycleNodeState, BiasEngine
        };
    },
    template: `
<v-app>
  <v-navigation-drawer permanent rail expand-on-hover border="0">
    <v-list nav>
      <v-list-item prepend-icon="mdi-view-dashboard" title="Dashboard" @click="activeTab = 'dashboard'"></v-list-item>
      <v-list-item prepend-icon="mdi-target" title="Goals" @click="activeTab = 'goals'"></v-list-item>
      <v-list-item prepend-icon="mdi-lightbulb-on" title="If-Then" @click="activeTab = 'ifthen'"></v-list-item>
      <v-list-item prepend-icon="mdi-calendar-clock" title="Schedule" @click="activeTab = 'schedule'"></v-list-item>
      <v-list-item prepend-icon="mdi-brain" title="Review" @click="activeTab = 'review'"></v-list-item>
    </v-list>
  </v-navigation-drawer>

  <v-main>
    <v-container fluid v-if="activeTab === 'dashboard'" class="pa-6">
      <v-card class="pa-4 mb-6">
        <div class="text-h6 mb-2">📈 Vital Trend ({{ state.moodHistory[state.moodHistory.length-1]?.emoji }})</div>
        <div style="height: 150px; width: 100%;">
          <svg viewBox="0 0 800 150" preserveAspectRatio="none" style="width:100%; height:100%">
            <line x1="0" x2="800" y1="75" y2="75" style="stroke:#30363d; stroke-dasharray:4"></line>
            <path :d="moodChartPath" style="fill:none; stroke:#58a6ff; stroke-width:2"></path>
            <g v-for="(d, i) in state.moodHistory" :key="i">
              <circle :cx="(i / (state.moodHistory.length-1)) * 800" :cy="((100 - d.value) / 200) * 150" r="4" fill="#58a6ff"></circle>
            </g>
          </svg>
        </div>
      </v-card>
      <v-row>
        <v-col cols="4"><v-card class="pa-4 text-center"><div>PLANNED (adj)</div><div class="text-h4">{{ state.tasks.filter(t=>t.is_planned).reduce((s,t)=>s+BiasEngine.adjustTime(t.cost.estimated_time),0) }}m</div></v-card></v-col>
        <v-col cols="4"><v-card class="pa-4 text-center"><div>ACTUAL</div><div class="text-h4 text-success">{{ state.tasks.filter(t=>t.is_actual).reduce((s,t)=>s+t.cost.actual_time,0) }}m</div></v-card></v-col>
        <v-col cols="4"><v-card class="pa-4 text-center"><div>REMAINING</div><div class="text-h4 text-warning">{{ state.tasks.filter(t=>t.is_planned && !t.is_actual).length }}</div></v-card></v-col>
      </v-row>
    </v-container>

    <v-container fluid v-if="activeTab === 'goals'" class="fill-height pa-0">
      <div class="d-flex fill-height" style="width:100%">
        <div class="project-sidebar" style="width:240px">
          <v-btn block color="primary" @click="openProjectModal()">+ 新規</v-btn>
          <v-list bg-color="transparent" class="mt-4">
            <v-list-item v-for="p in state.projects" :key="p.id" :active="state.selectedProjectId === p.id" @click="selectProject(p.id)"
                         :style="{opacity: p.status === 'active' ? 1 : 0.6}">
              <v-list-item-title :style="{textDecoration: p.status === 'achieved' ? 'line-through' : 'none'}">
                <v-icon size="small" class="mr-1" :color="p.status === 'achieved' ? 'success' : (p.status === 'shelved' ? 'warning' : 'primary')">
                  {{ p.status === 'achieved' ? 'mdi-check-circle' : (p.status === 'shelved' ? 'mdi-pause-circle' : 'mdi-play-circle') }}
                </v-icon>
                {{ p.title }}
              </v-list-item-title>
              <v-list-item-subtitle v-if="p.deadline" class="text-caption ml-7">
                {{ getRemainingDays(p.deadline) !== null ? (getRemainingDays(p.deadline) <= 0 ? '❗ 期限超過' : '⏳ あと ' + getRemainingDays(p.deadline) + ' 日') : '' }}
              </v-list-item-subtitle>
              <template v-slot:append>
                <v-btn icon="mdi-cog" variant="text" size="x-small" @click.stop="openProjectModal(p)"></v-btn>
                <v-btn icon="mdi-delete" variant="text" size="x-small" color="error" @click.stop="deleteProject(p.id)"></v-btn>
              </template>
            </v-list-item>
          </v-list>
        </div>
        <div class="d-flex flex-grow-1" style="height: 100%">
          <div style="width: 300px; height: 100%;" class="pa-2 d-flex flex-column">
            <div class="d-flex mb-2">
              <v-btn icon="mdi-download" variant="text" size="small" @click="downloadCurrentProject"></v-btn>
              <v-btn icon="mdi-upload" variant="text" size="small" @click="triggerUpload"></v-btn>
              <input type="file" id="project-upload-input" style="display:none" accept=".md" @change="handleProjectUpload">
            </div>
            <textarea v-if="currentProject" v-model="currentProject.markdown" class="asmos-editor flex-grow-1" spellcheck="false"></textarea>
          </div>
          <div class="flex-grow-1" style="background: #010409; overflow: auto; position: relative;">
            <svg class="mindmap-svg" style="min-width: 2000px; min-height: 1000px;">
              <g v-for="l in mindMapData.links" :key="l.id">
                <path class="mindmap-link" :d="'M ' + l.x1 + ' ' + l.y1 + ' C ' + (l.x1 + 100) + ' ' + l.y1 + ' ' + (l.x2 - 100) + ' ' + l.y2 + ' ' + l.x2 + ' ' + l.y2" 
                      fill="none" stroke="#58a6ff" stroke-width="1.5" opacity="0.4"></path>
              </g>
              <g v-for="n in mindMapData.nodes" :key="n.id" class="mindmap-node" :class="{ 'is-task': n.is_task }" 
                 :transform="'translate('+n.x+','+n.y+')'" @dblclick="cycleNodeState(n)">
                <circle r="6" :fill="n.is_achieved ? '#8b949e' : (n.is_task ? '#238636' : '#161b22')" stroke="#58a6ff" stroke-width="2" :opacity="n.is_achieved ? 0.5 : 1"></circle>
                <text x="12" y="5" :fill="n.is_achieved ? '#8b949e' : '#c9d1d9'" 
                      :style="{fontSize: '14px', fontWeight: 600, textShadow: '0 0 5px #000', textDecoration: n.is_achieved ? 'line-through' : 'none', opacity: n.is_achieved ? 0.5 : 1}">{{n.text}}</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </v-container>

    <v-container fluid v-if="activeTab === 'ifthen'" class="pa-6">
      <div class="d-flex justify-space-between mb-6"><h1>💡 if-then</h1><v-btn color="primary" @click="openCreation('ifthen')">追加</v-btn></div>
      <v-row><v-col v-for="p in state.ifThenPlans" :key="p.id" cols="4"><v-card class="pa-4" @click="openCreation('ifthen', p)"><div class="text-overline">{{p.category}}</div><div class="text-secondary">If: {{p.condition}}</div><div class="text-h6">Then: {{p.action}}</div></v-card></v-col></v-row>
    </v-container>

    <v-container fluid v-if="activeTab === 'schedule'" class="pa-0 fill-height">
      <div class="d-flex fill-height" style="width:100%">
        <div class="project-sidebar" style="width:300px">
          <div class="pa-4 text-h6">📦 STOCK</div>
          <task-card v-for="t in state.tasks.filter(x=>x.slot==='STOCK_DAY')" :key="t.id" :task="t" :projects="state.projects" @edit="openCreation('task', t)" @toggle="toggleComplete"></task-card>
        </div>
        <div class="flex-grow-1 pa-4 overflow-y-auto">
          <div class="d-flex justify-space-between mb-4"><h1>⏳ 実行</h1><div><v-btn color="warning" @click="autoSchedule">⚡ 自動配置</v-btn><v-btn color="primary" class="ml-2" @click="openCreation('task')">新規</v-btn></div></div>
          <v-row v-for="(cfg, id) in TIME_SLOTS" :key="id" class="mb-4" no-gutters>
            <v-col cols="2" class="pa-2"><div>{{id}}</div><div class="text-caption">{{cfg.range}}</div></v-col>
            <v-col cols="5" class="pa-2 border-left"><div class="text-overline">PLAN</div><task-card v-for="t in state.tasks.filter(x=>x.slot===id && x.is_planned)" :key="t.id" :task="t" :projects="state.projects" @edit="openCreation('task', t)" @toggle="toggleComplete"></task-card></v-col>
            <v-col cols="5" class="pa-2 border-left"><div class="text-overline">ACTUAL</div><task-card v-for="t in state.tasks.filter(x=>x.slot===id && x.is_actual)" :key="t.id" :task="t" :projects="state.projects" @edit="openCreation('task', t)" @toggle="toggleComplete"></task-card></v-col>
          </v-row>
        </div>
      </div>
    </v-container>

    <v-container fluid v-if="activeTab === 'review'" class="pa-6">
      <v-row><v-col cols="12" md="8" class="mx-auto">
        <v-card class="pa-6 mb-6">
          <div class="text-h6 mb-4">📊 Fact Analysis</div>
          <div class="text-h5">Actual: {{ state.tasks.filter(t=>t.is_actual).reduce((s,t)=>s+t.cost.actual_time,0) }}m / Plan (adj): {{ state.tasks.filter(t=>t.is_actual).reduce((s,t)=>s+BiasEngine.adjustTime(t.cost.estimated_time),0) }}m</div>
        </v-card>
        <v-textarea label="Good" v-model="state.memoGood" variant="outlined" class="mb-4"></v-textarea>
        <v-textarea label="Improvement" v-model="state.memoImprove" variant="outlined" class="mb-4"></v-textarea>
        <v-textarea label="Tomorrow's Actions" v-model="state.memoNextActions" variant="outlined" class="mb-4"></v-textarea>
      </v-col></v-row>
    </v-container>
  </v-main>

  <v-dialog v-model="creationModal" max-width="600"><v-card class="pa-4">
    <v-text-field v-if="creationMode==='task'" label="Title" v-model="formTask.title"></v-text-field>
    <v-textarea v-if="creationMode==='task'" label="DoD (Required)" v-model="formTask.dod"></v-textarea>
    <v-text-field v-if="creationMode==='ifthen'" label="If" v-model="formIfThen.condition"></v-text-field>
    <v-text-field v-if="creationMode==='ifthen'" label="Then" v-model="formIfThen.action"></v-text-field>
    <v-card-actions><v-btn color="error" @click="deleteEntry">Delete</v-btn><v-spacer></v-spacer><v-btn color="primary" @click="submitCreation">Save</v-btn></v-card-actions>
  </v-card></v-dialog>

  <v-dialog v-model="completionModal" max-width="400"><v-card class="pa-4 text-center">
    <v-btn-toggle v-model="formComplete.mood" mandatory color="primary" class="mb-4 d-flex justify-center">
      <v-btn :value="-100">😫</v-btn><v-btn :value="-50">😩</v-btn><v-btn :value="0">😐</v-btn><v-btn :value="50">😊</v-btn><v-btn :value="100">🤩</v-btn>
    </v-btn-toggle>
    <v-text-field label="Actual Time" v-model.number="formComplete.actual_time" type="number"></v-text-field>
    <v-btn block color="success" @click="submitCompletion">Finish</v-btn>
  </v-card></v-dialog>

  <v-dialog v-model="projectModal" max-width="400"><v-card class="pa-4">
    <div class="text-h6 mb-4">{{ editingProjectId ? 'プロジェクト設定' : '新規プロジェクト' }}</div>
    <v-text-field label="プロジェクト名" v-model="formProject.title" @keyup.enter="submitProject" class="mb-2"></v-text-field>
    <v-text-field label="締め切り日" v-model="formProject.deadline" type="date" class="mb-2"></v-text-field>
    <v-select label="ステータス" :items="[{title:'進行中', value:'active'}, {title:'達成', value:'achieved'}, {title:'凍結', value:'shelved'}]" v-model="formProject.status"></v-select>
    <v-card-actions><v-spacer></v-spacer><v-btn @click="projectModal = false">キャンセル</v-btn><v-btn color="primary" @click="submitProject">保存</v-btn></v-card-actions>
  </v-card></v-dialog>
</v-app>
`
};
const appInstance = createApp(RootComponent);
appInstance.use(vuetify);
appInstance.component('task-card', {
    props: ['task', 'projects'],
    template: `
    <v-card class="task-card-item mb-2" :class="{ success: task.is_actual, recovery: task.is_recovery }" @click="$emit('edit', task)">
      <v-card-text class="pa-2">
        <div class="d-flex justify-space-between align-center">
          <span class="text-subtitle-2 font-weight-bold">{{ task.title }}</span>
          <v-chip size="x-small" color="primary" variant="outlined">{{ projects.find((p:any) => p.id === task.project_id)?.title || 'No Project' }}</v-chip>
        </div>
        <div class="d-flex justify-space-between mt-1 align-center">
          <span class="text-caption text-secondary">⏱️ {{ task.cost.estimated_time }}m</span>
          <v-btn size="x-small" :color="task.is_actual ? 'secondary' : 'success'" variant="flat" @click.stop="$emit('toggle', task)">{{ task.is_actual ? '戻す' : '完了' }}</v-btn>
        </div>
      </v-card-text>
    </v-card>
  `
});
appInstance.mount('#app');
