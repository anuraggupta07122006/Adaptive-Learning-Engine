/**
 * PrepOS — Complete Frontend Controller & Intelligence Orchestrator
 * Integrates Auth, Exam Setup, Roadmap Tree, Knowledge Graph, DKT Cognitive Modeling,
 * Adaptive IRT Assessment, Real-Time Socket.IO Streaming, and Doubt Solver.
 */

"use strict";

(function() {
    /* ─── Global State ─── */
    let currentUser = null;
    let selectedExam = null;
    let cognitiveModel = null;
    let knowledgeGraph = null;
    let adaptiveQuiz = null;
    let chatSocketSession = null;
    let currentStreamingMsgElement = null;

    /* ─── DOM Helper ─── */
    const $ = id => document.getElementById(id);

    /* ─── Toast Notifications ─── */
    function showToast(message, type = "success") {
        const toast = $("app-toast");
        if (!toast) return;
        toast.innerText = message;
        toast.className = `show ${type}`;
        setTimeout(() => { toast.className = ""; }, 4000);
    }

    /* ─── Markdown Parser ─── */
    function formatMarkdown(text) {
        if (!text) return "";
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code blocks with syntax formatting
        html = html.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`);
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
        html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
        html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
        html = html.replace(/^[-*] (.*$)/gim, "<li>$1</li>");
        html = html.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");
        html = html.replace(/<\/ul>\s*<ul>/gim, "");
        html = html.replace(/\n\n/g, "<br><br>");
        html = html.replace(/\n/g, "<br>");
        return `<div class="md-content">${html}</div>`;
    }

    /* ─── Panel Switcher ─── */
    function showPanel(panelId) {
        document.querySelectorAll(".page-panel").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

        const panel = $(panelId);
        if (panel) panel.classList.add("active");

        document.querySelectorAll(`.tab-btn[data-target="${panelId}"]`).forEach(b => {
            b.classList.add("active");
        });

        // Trigger view updates when switching panels
        if (panelId === "page-graph" && knowledgeGraph) {
            setTimeout(() => {
                knowledgeGraph.initCanvasSize();
                knowledgeGraph.render();
            }, 50);
        } else if (panelId === "page-analytics") {
            refreshAnalyticsView();
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       AUTHENTICATION & SESSION
       ══════════════════════════════════════════════════════════════════ */

    function initAuth() {
        // Toggle tabs
        const tabLogin = $("tab-login-toggle");
        const tabReg = $("tab-register-toggle");
        if (tabLogin && tabReg) {
            tabLogin.addEventListener("click", () => {
                tabLogin.classList.add("active");
                tabReg.classList.remove("active");
                $("login-form").style.display = "block";
                $("register-form").style.display = "none";
            });
            tabReg.addEventListener("click", () => {
                tabReg.classList.add("active");
                tabLogin.classList.remove("active");
                $("register-form").style.display = "block";
                $("login-form").style.display = "none";
            });
        }

        // Login Form
        const loginForm = $("login-form");
        if (loginForm) {
            loginForm.addEventListener("submit", async e => {
                e.preventDefault();
                const username = $("login-username").value.trim();
                const password = $("login-password").value;
                const btn = loginForm.querySelector("button[type=submit]");
                btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;margin:0 6px 0 0;display:inline-block;vertical-align:middle;"></span> Signing in...`;
                btn.disabled = true;

                const res = await window.apiGateway.login(username, password);
                btn.innerHTML = "Sign In";
                btn.disabled = false;

                if (res.success) {
                    currentUser = res.data.user;
                    showToast(`Welcome back, ${currentUser.username}!`, "success");
                    enterDashboard();
                } else {
                    showToast(res.message || "Invalid credentials", "danger");
                }
            });
        }

        // Register Form
        const regForm = $("register-form");
        if (regForm) {
            regForm.addEventListener("submit", async e => {
                e.preventDefault();
                const username = $("register-username").value.trim();
                const email = $("register-email").value.trim();
                const password = $("register-password").value;
                const btn = regForm.querySelector("button[type=submit]");
                btn.innerHTML = `Creating account...`;
                btn.disabled = true;

                const res = await window.apiGateway.register(username, email, password);
                btn.innerHTML = "Create Account";
                btn.disabled = false;

                if (res.success) {
                    showToast("Account created! Signing you in...", "success");
                    const loginRes = await window.apiGateway.login(username, password);
                    if (loginRes.success) {
                        currentUser = loginRes.data.user;
                        enterDashboard();
                    }
                } else {
                    showToast(res.message || "Registration failed", "danger");
                }
            });
        }

        // Guest Login
        const guestBtn = $("btn-guest-login");
        if (guestBtn) {
            guestBtn.addEventListener("click", async () => {
                guestBtn.innerHTML = `Signing in as Guest...`;
                guestBtn.disabled = true;

                const res = await window.apiGateway.guestLogin();
                guestBtn.innerHTML = `
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    Continue as Guest (Zero Setup)
                `;
                guestBtn.disabled = false;

                if (res.success) {
                    currentUser = res.data.user;
                    showToast("Signed in as Guest Scholar!", "success");
                    enterDashboard();
                } else {
                    showToast(res.message || "Guest login failed", "danger");
                }
            });
        }

        // Logout
        const logoutBtn = $("btn-logout");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await window.apiGateway.logout();
                currentUser = null;
                selectedExam = null;
                if (chatSocketSession) {
                    chatSocketSession.disconnect();
                    chatSocketSession = null;
                }
                $("auth-section").style.display = "flex";
                $("dashboard-section").style.display = "none";
                showToast("Signed out successfully.", "success");
            });
        }

        // Environment Selector Sync
        const authEnvSelect = $("auth-env-select");
        const dashEnvSelect = $("dashboard-env-select");
        const currentEnv = window.apiGateway.currentEnv;
        if (authEnvSelect) authEnvSelect.value = currentEnv;
        if (dashEnvSelect) dashEnvSelect.value = currentEnv;

        const handleEnvChange = (e) => {
            const newEnv = e.target.value;
            window.apiGateway.setEnvironment(newEnv);
            if (authEnvSelect) authEnvSelect.value = newEnv;
            if (dashEnvSelect) dashEnvSelect.value = newEnv;
            showToast(`Switched environment to: ${newEnv.toUpperCase()}`, "warning");
            if (currentUser) {
                loadExamsList();
            }
        };

        if (authEnvSelect) authEnvSelect.addEventListener("change", handleEnvChange);
        if (dashEnvSelect) dashEnvSelect.addEventListener("change", handleEnvChange);
    }

    async function checkAuthSession() {
        const token = window.apiGateway.getToken();
        const cachedUser = window.apiGateway.getUser();
        if (!token) return;

        if (cachedUser) {
            currentUser = cachedUser;
            enterDashboard();
            return;
        }

        const res = await window.apiGateway.getMe();
        if (res && res.success) {
            currentUser = res.data;
            enterDashboard();
        }
    }

    function enterDashboard() {
        $("auth-section").style.display = "none";
        $("dashboard-section").style.display = "grid";
        if ($("user-display-name") && currentUser) {
            $("user-display-name").innerText = currentUser.username;
        }
        if ($("user-avatar") && currentUser) {
            $("user-avatar").innerText = (currentUser.username || "U")[0].toUpperCase();
        }

        loadExamsList();
        showPanel("page-setup");
    }

    /* ══════════════════════════════════════════════════════════════════
       EXAMS LIST & SELECTION
       ══════════════════════════════════════════════════════════════════ */

    async function loadExamsList() {
        const container = $("exams-list-container");
        if (!container) return;
        container.innerHTML = `<div class="loader-wrapper" style="padding:10px;"><div class="spinner" style="width:20px;height:20px;"></div></div>`;

        const res = await window.apiGateway.listExams();
        container.innerHTML = "";

        if (res.success && res.data && res.data.length > 0) {
            res.data.forEach((exam, idx) => {
                const item = document.createElement("div");
                item.className = "exam-item";
                item.dataset.examId = exam._id;
                item.innerHTML = `
                    <span class="exam-item-name">${exam.examName}</span>
                    <span class="exam-item-meta">${exam.duration}h study plan</span>
                `;
                item.addEventListener("click", () => selectExam(exam));
                container.appendChild(item);

                // Auto select first exam if none selected
                if (idx === 0 && !selectedExam) {
                    selectExam(exam);
                }
            });
        } else {
            container.innerHTML = `<p style="color:var(--text-muted);font-size:0.75rem;padding:8px 4px;">No exams yet. Click Configure above!</p>`;
        }
    }

    function selectExam(exam) {
        selectedExam = exam;

        // Highlight in sidebar
        document.querySelectorAll(".exam-item").forEach(i => i.classList.remove("active"));
        const activeItem = document.querySelector(`[data-exam-id="${exam._id}"]`);
        if (activeItem) activeItem.classList.add("active");

        // Update header
        if ($("active-exam-name")) $("active-exam-name").innerText = exam.examName;
        if ($("active-exam-duration")) $("active-exam-duration").innerText = `${exam.duration}h Study Plan`;
        if ($("active-exam-start")) $("active-exam-start").innerText = `Daily Start: ${exam.starttime || '09:00'}`;
        if ($("main-header")) $("main-header").style.display = "flex";

        // Parse strategy
        let strategy = null;
        try {
            strategy = typeof exam.strategy === "string" ? JSON.parse(exam.strategy) : exam.strategy;
        } catch {
            strategy = null;
        }

        // Initialize Cognitive Model for this exam
        cognitiveModel = new window.CognitiveModel(exam._id);
        cognitiveModel.initializeConceptsFromSyllabus(exam.syllabusText, strategy?.milestones);
        window.cognitiveModel = cognitiveModel;

        // Initialize Knowledge Graph
        initKnowledgeGraph();

        // Initialize Adaptive Assessment
        initAdaptiveQuiz(exam._id);

        // Connect Real-Time WebSocket Streaming Chat
        initStreamingChat(exam._id);

        // Render Strategy Flowchart
        renderStrategyFlowchart(strategy);

        // Update Cognitive Analytics
        refreshAnalyticsView();

        // Switch to Strategy panel
        showPanel("page-strategy");
    }

    const btnSidebarSetup = $("btn-sidebar-setup");
    if (btnSidebarSetup) {
        btnSidebarSetup.addEventListener("click", () => {
            selectedExam = null;
            document.querySelectorAll(".exam-item").forEach(i => i.classList.remove("active"));
            if ($("main-header")) $("main-header").style.display = "none";
            showPanel("page-setup");
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       EXAM SETUP & SAMPLE LOADER
       ══════════════════════════════════════════════════════════════════ */

    const SAMPLE_EXAM_DATA = {
        examName: "Operating Systems — CS301 Final Exam",
        duration: "18",
        starttime: "09:00",
        syllabusText: `UNIT 1: PROCESS MANAGEMENT
- Process concept, PCB, process states (new, ready, running, waiting, terminated)
- Process Scheduling: FCFS, SJF (preemptive/non-preemptive), Round Robin, Priority
- CPU scheduling criteria: utilization, throughput, turnaround time, waiting time
- Dispatcher, context switching, inter-process communication (IPC)

UNIT 2: THREADS & CONCURRENCY
- Multithreading models: many-to-one, one-to-one, many-to-many
- Critical Section Problem, Peterson's Solution, Mutex Locks, Semaphores
- Classic synchronization: Bounded Buffer, Readers-Writers, Dining Philosophers
- Deadlock: 4 necessary conditions, Resource Allocation Graph
- Deadlock Avoidance: Banker's Algorithm, detection and recovery

UNIT 3: MEMORY MANAGEMENT
- Logical vs physical address space, Memory Management Unit (MMU)
- Paging: page table, TLB, effective access time calculation
- Segmentation, segmentation with paging
- Virtual Memory: demand paging, page fault handling, copy-on-write
- Page replacement algorithms: FIFO, Optimal (OPT), LRU, Clock algorithm
- Thrashing, working set model

UNIT 4: FILE SYSTEMS & STORAGE
- File concepts, allocation methods: contiguous, linked, indexed
- Directory structures: tree-structured, DAG
- Disk scheduling: FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK`,
        customInstruction: "Focus heavily on process scheduling, semaphores, and Banker's Algorithm deadlock avoidance with numerical verification."
    };

    function loadSampleExam() {
        if ($("exam-name")) $("exam-name").value = SAMPLE_EXAM_DATA.examName;
        if ($("exam-duration")) $("exam-duration").value = SAMPLE_EXAM_DATA.duration;
        if ($("exam-start")) $("exam-start").value = SAMPLE_EXAM_DATA.starttime;
        if ($("syllabus-text")) $("syllabus-text").value = SAMPLE_EXAM_DATA.syllabusText;
        if ($("custom-instructions")) $("custom-instructions").value = SAMPLE_EXAM_DATA.customInstruction;

        if ($("sample-loaded-notice")) $("sample-loaded-notice").style.display = "flex";
        showToast("Sample Operating Systems exam data loaded!", "success");
    }

    function clearSetupForm() {
        if ($("exam-name")) $("exam-name").value = "";
        if ($("exam-duration")) $("exam-duration").value = "";
        if ($("exam-start")) $("exam-start").value = "09:00";
        if ($("syllabus-text")) $("syllabus-text").value = "";
        if ($("custom-instructions")) $("custom-instructions").value = "";
        if ($("sample-loaded-notice")) $("sample-loaded-notice").style.display = "none";
        showToast("Setup form cleared.", "success");
    }

    const btnLoadSample = $("btn-load-sample");
    if (btnLoadSample) btnLoadSample.addEventListener("click", loadSampleExam);

    const btnUseReal = $("btn-use-real");
    if (btnUseReal) btnUseReal.addEventListener("click", clearSetupForm);

    // File label updates
    const syllabusFileInput = $("syllabus-file");
    if (syllabusFileInput) {
        syllabusFileInput.addEventListener("change", e => {
            const file = e.target.files[0];
            if ($("syllabus-file-label")) {
                $("syllabus-file-label").innerText = file ? file.name : "Select Syllabus File";
            }
        });
    }

    const pyqFilesInput = $("pyq-files");
    if (pyqFilesInput) {
        pyqFilesInput.addEventListener("change", e => {
            const files = Array.from(e.target.files);
            if ($("pyq-files-label")) {
                $("pyq-files-label").innerText = files.length ? `${files.length} PYQ File(s) Attached` : "Attach PYQ Papers";
            }
            if ($("pyq-preview")) {
                $("pyq-preview").innerText = files.map(f => f.name).join(", ");
            }
        });
    }

    const notesFilesInput = $("notes-files");
    if (notesFilesInput) {
        notesFilesInput.addEventListener("change", e => {
            const files = Array.from(e.target.files);
            if ($("notes-files-label")) {
                $("notes-files-label").innerText = files.length ? `${files.length} Notes File(s) Attached` : "Attach Notes Files";
            }
            if ($("notes-preview")) {
                $("notes-preview").innerText = files.map(f => f.name).join(", ");
            }
        });
    }

    // Generate Strategy CTA
    const generateBtn = $("generate-strategy-btn");
    if (generateBtn) {
        generateBtn.addEventListener("click", async () => {
            const examName = $("exam-name").value.trim();
            const duration = $("exam-duration").value.trim();
            const starttime = $("exam-start").value;
            const syllabusText = $("syllabus-text").value.trim();
            const customInstruction = $("custom-instructions").value.trim();

            if (!examName || !duration) {
                showToast("Please fill in Exam Title and Available Hours.", "warning");
                return;
            }

            const loader = $("loading-spinner");
            if (loader) loader.style.display = "flex";
            $("page-setup").classList.remove("active");

            const formData = new FormData();
            formData.append("examName", examName);
            formData.append("duration", duration);
            formData.append("starttime", starttime);
            formData.append("syllabusText", syllabusText);
            formData.append("customInstruction", customInstruction);

            if (syllabusFileInput?.files[0]) formData.append("syllabus", syllabusFileInput.files[0]);
            if (pyqFilesInput?.files) Array.from(pyqFilesInput.files).forEach(f => formData.append("pyq", f));
            if (notesFilesInput?.files) Array.from(notesFilesInput.files).forEach(f => formData.append("attachment", f));

            try {
                const res = await window.apiGateway.setupExam(formData);
                if (loader) loader.style.display = "none";

                if (res.success && res.data) {
                    showToast("Study plan & cognitive model generated!", "success");
                    await loadExamsList();
                    selectExam(res.data);
                } else {
                    showToast(res.message || "Could not generate strategy.", "danger");
                    showPanel("page-setup");
                }
            } catch (err) {
                if (loader) loader.style.display = "none";
                showToast("Network error while generating strategy.", "danger");
                showPanel("page-setup");
            }
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       STRATEGY ROADMAP FLOWCHART
       ══════════════════════════════════════════════════════════════════ */

    function renderStrategyFlowchart(strategy) {
        const container = $("tree-flowchart-container");
        const tipsSection = $("tips-section");
        if (!container || !selectedExam) return;

        if (!strategy || !strategy.milestones) {
            container.innerHTML = `<div class="empty-state"><p>No strategy data found for this exam.</p></div>`;
            return;
        }

        if ($("strategy-summary")) {
            $("strategy-summary").innerText = strategy.summary || "Your step-by-step roadmap to mastery.";
        }

        const examId = selectedExam._id;
        const savedStates = {};
        try {
            const raw = localStorage.getItem(`exam-tasks-${examId}`);
            if (raw) Object.assign(savedStates, JSON.parse(raw));
        } catch {}

        let html = `
            <div class="tree-root-card">
                <div class="tree-root-title">${selectedExam.examName}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:8px;">${selectedExam.duration}h Structured Adaptive Roadmap</div>
                <div class="tree-progress-track">
                    <div class="tree-progress-fill" id="tree-overall-progress-bar"></div>
                </div>
                <div class="tree-progress-label" id="tree-overall-progress-text">0% completed</div>
            </div>
            <div class="tree-connector-v"></div>
            <div class="tree-branches">
        `;

        const schedule = strategy.schedule || [];
        const milestones = strategy.milestones || [];
        const perMilestone = Math.ceil(schedule.length / Math.max(1, milestones.length));

        milestones.forEach((ms, mIdx) => {
            const daySlice = schedule.slice(mIdx * perMilestone, (mIdx + 1) * perMilestone);
            const milestoneId = `milestone-${examId}-${mIdx}`;

            html += `
                <div class="tree-branch-node">
                    <div class="tree-branch-connector"></div>
                    <div class="milestone-card" id="${milestoneId}">
                        <div class="milestone-card-header">
                            <span class="milestone-card-badge">Phase ${mIdx + 1}</span>
                            <span class="milestone-progress-indicator">0%</span>
                        </div>
                        <div class="milestone-card-title">${ms.title}</div>
                        <div class="milestone-card-desc">${ms.description}</div>
                        <div class="milestone-mini-progress-track">
                            <div class="milestone-mini-progress-fill"></div>
                        </div>
                    </div>
                    <div class="day-nodes-list">
            `;

            daySlice.forEach((day, dIdx) => {
                const dayId = `day-${mIdx}-${dIdx}`;
                html += `
                    <div class="day-node-card" id="${dayId}">
                        <div class="day-node-header">
                            <span class="day-node-title">${day.day}</span>
                            <span class="day-node-duration">${day.durationHours}h</span>
                        </div>
                        <div class="day-node-topic">${day.topic}</div>
                        <ul class="day-node-tasks">
                `;

                (day.tasks || []).forEach((task, tIdx) => {
                    const taskId = `task-${mIdx}-${dIdx}-${tIdx}`;
                    const isChecked = savedStates[`${examId}-${taskId}`] === true;
                    html += `
                        <li class="day-node-task-item${isChecked ? " checked" : ""}">
                            <input type="checkbox" id="${taskId}"
                                data-milestone="${milestoneId}"
                                data-task-id="${examId}-${taskId}"
                                ${isChecked ? "checked" : ""}
                                onchange="window.toggleRoadmapTask(this)">
                            <label for="${taskId}">${task}</label>
                        </li>
                    `;
                });

                html += `</ul></div>`;
            });

            html += `</div></div>`;
        });

        html += `</div>`;
        container.innerHTML = html;

        // Tips
        if (tipsSection && strategy.tips && strategy.tips.length > 0) {
            tipsSection.innerHTML = `
                <div class="tips-section">
                    <h4>High-Yield AI Recommendations</h4>
                    <div class="tips-list">
                        ${strategy.tips.map(tip => `
                            <div class="tip-item">
                                <div class="tip-bullet"></div>
                                <span>${tip}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
        } else if (tipsSection) {
            tipsSection.innerHTML = "";
        }

        updateRoadmapProgress();
    }

    window.toggleRoadmapTask = function(checkbox) {
        const li = checkbox.closest(".day-node-task-item");
        const taskKey = checkbox.dataset.taskId;

        if (checkbox.checked) li.classList.add("checked");
        else li.classList.remove("checked");

        if (selectedExam) {
            const examId = selectedExam._id;
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem(`exam-tasks-${examId}`) || "{}"); } catch {}
            saved[taskKey] = checkbox.checked;
            localStorage.setItem(`exam-tasks-${examId}`, JSON.stringify(saved));
        }

        updateRoadmapProgress();
        refreshAnalyticsView();
    };

    function updateRoadmapProgress() {
        const cbs = Array.from(document.querySelectorAll("#tree-flowchart-container input[type='checkbox']"));
        if (!cbs.length) return;

        const checked = cbs.filter(cb => cb.checked).length;
        const pct = Math.round((checked / cbs.length) * 100);

        const bar = $("tree-overall-progress-bar");
        const text = $("tree-overall-progress-text");
        if (bar) bar.style.width = `${pct}%`;
        if (text) text.innerText = `${pct}% completed`;

        if ($("metric-roadmap-pct")) $("metric-roadmap-pct").innerText = `${pct}%`;

        // Milestone cards update
        document.querySelectorAll(".milestone-card").forEach(card => {
            const msId = card.id;
            const msCbs = cbs.filter(cb => cb.dataset.milestone === msId);
            if (!msCbs.length) return;

            const msChecked = msCbs.filter(cb => cb.checked).length;
            const msPct = Math.round((msChecked / msCbs.length) * 100);

            const ind = card.querySelector(".milestone-progress-indicator");
            const fill = card.querySelector(".milestone-mini-progress-fill");
            if (ind) ind.innerText = `${msPct}%`;
            if (fill) fill.style.width = `${msPct}%`;
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       INTERACTIVE KNOWLEDGE GRAPH
       ══════════════════════════════════════════════════════════════════ */

    function initKnowledgeGraph() {
        if (!knowledgeGraph) {
            knowledgeGraph = new window.KnowledgeGraph("knowledge-graph-canvas", {
                onNodeSelect: handleGraphNodeSelect
            });
            window.knowledgeGraph = knowledgeGraph;

            // Toolbar buttons
            const zoomIn = $("btn-graph-zoom-in");
            const zoomOut = $("btn-graph-zoom-out");
            const resetBtn = $("btn-graph-reset");
            if (zoomIn) zoomIn.addEventListener("click", () => knowledgeGraph.zoomIn());
            if (zoomOut) zoomOut.addEventListener("click", () => knowledgeGraph.zoomOut());
            if (resetBtn) resetBtn.addEventListener("click", () => knowledgeGraph.resetView());
        }

        if (cognitiveModel) {
            const concepts = cognitiveModel.getConceptMasteryList();
            knowledgeGraph.setGraphData(concepts);
        }
    }

    function handleGraphNodeSelect(node) {
        const titleEl = $("inspector-title");
        const masteryEl = $("inspector-mastery");
        const fillEl = $("inspector-progress-fill");
        const prereqsEl = $("inspector-prereqs-list");
        const diagEl = $("inspector-diagnostic-text");

        if (titleEl) titleEl.innerText = node.name;
        if (masteryEl) masteryEl.innerText = `${node.masteryPct}%`;
        if (fillEl) fillEl.style.width = `${node.masteryPct}%`;

        if (prereqsEl) {
            if (node.prerequisites && node.prerequisites.length > 0) {
                prereqsEl.innerHTML = node.prerequisites.map(p => `<span class="tag-pill">${p}</span>`).join("");
            } else {
                prereqsEl.innerHTML = `<span class="tag-pill">None (Foundational)</span>`;
            }
        }

        if (diagEl) {
            if (node.hasPrereqBreach) {
                diagEl.innerHTML = `<span style="color:var(--color-danger);font-weight:700;">Prerequisite Warning!</span> Your mastery in this concept or its dependencies is below 45%. Focus here before advancing.`;
            } else {
                diagEl.innerHTML = `Solid foundational progress. Continue solving questions in this cluster to lock in permanent retention.`;
            }
        }

        // Practice button
        const btnPractice = $("btn-practice-concept");
        if (btnPractice) {
            btnPractice.onclick = () => {
                showPanel("page-mock");
                if (adaptiveQuiz) {
                    showToast(`Loaded adaptive drill for: ${node.name}`, "success");
                }
            };
        }

        // Doubt button
        const btnDoubt = $("btn-doubt-concept");
        if (btnDoubt) {
            btnDoubt.onclick = () => {
                showPanel("page-doubt");
                if ($("doubt-input")) {
                    $("doubt-input").value = `Explain the foundational concept and edge cases of "${node.name}" step by step with an example.`;
                }
            };
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       COGNITIVE ANALYTICS & DKT VIEW
       ══════════════════════════════════════════════════════════════════ */

    function refreshAnalyticsView() {
        if (!cognitiveModel) return;

        // Roadmap progress
        const cbs = Array.from(document.querySelectorAll("#tree-flowchart-container input[type='checkbox']"));
        const roadmapPct = cbs.length ? Math.round((cbs.filter(c => c.checked).length / cbs.length) * 100) : 0;

        const pred = cognitiveModel.predictPerformance(roadmapPct);

        if ($("metric-pred-score")) $("metric-pred-score").innerText = `${pred.predictedScore}%`;
        if ($("metric-score-range")) $("metric-score-range").innerText = `[${pred.lowerBound}% – ${pred.upperBound}%]`;
        if ($("metric-roadmap-pct")) $("metric-roadmap-pct").innerText = `${roadmapPct}%`;
        if ($("metric-attempts-count")) $("metric-attempts-count").innerText = cognitiveModel.attemptHistory.length;
        if ($("active-exam-predicted")) $("active-exam-predicted").innerText = `Predicted Score: ${pred.predictedScore}%`;

        const riskEl = $("metric-risk-level");
        if (riskEl) {
            riskEl.innerText = `${pred.riskLevel} Risk`;
            riskEl.className = `metric-value risk-${pred.riskLevel.toLowerCase()}`;
        }
        if ($("metric-critical-gaps")) $("metric-critical-gaps").innerText = pred.criticalGapsCount;

        // Concept Mastery Matrix
        const matrixContainer = $("concept-mastery-list");
        if (matrixContainer) {
            const concepts = cognitiveModel.getConceptMasteryList();
            matrixContainer.innerHTML = concepts.map(c => {
                const badgeClass = c.masteryPct >= 75 ? "mastered" : c.masteryPct >= 45 ? "learning" : "critical";
                const barColor = c.masteryPct >= 75 ? "var(--state-verified)" : c.masteryPct >= 45 ? "var(--state-amber)" : "var(--state-critical)";
                return `
                    <div class="mastery-row">
                        <div class="mastery-row-top">
                            <span class="mastery-row-title">${c.name}</span>
                            <span class="mastery-badge ${badgeClass}">${c.status} (${c.masteryPct}%)</span>
                        </div>
                        <div class="mastery-bar-track">
                            <div class="mastery-bar-fill" style="width:${c.masteryPct}%;background:${barColor};"></div>
                        </div>
                    </div>
                `;
            }).join("");
        }

        // Sequence Trajectory
        const seqContainer = $("sequence-trajectory-container");
        if (seqContainer) {
            const history = cognitiveModel.getSequenceTrajectory();
            if (history.length === 0) {
                seqContainer.innerHTML = `<div class="empty-state-sm">No attempts recorded yet. Answer questions in Adaptive Assessment to view live sequence modeling.</div>`;
            } else {
                seqContainer.innerHTML = history.slice(-8).reverse().map(att => `
                    <div class="seq-item ${att.correct ? "correct" : "incorrect"}">
                        <div>
                            <strong>Attempt #${att.index}: ${att.concept}</strong>
                            <div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);">${att.timeTaken}s response · Post-mastery: ${att.mastery}%</div>
                        </div>
                        <span style="font-weight:600;font-family:var(--font-mono);font-size:0.75rem;color:${att.correct ? "var(--state-verified)" : "var(--state-critical)"};">
                            ${att.correct ? "VERIFIED" : "GAP DETECTED"}
                        </span>
                    </div>
                `).join("");
            }
        }
    }

    const btnRefreshAnalytics = $("btn-refresh-analytics");
    if (btnRefreshAnalytics) {
        btnRefreshAnalytics.addEventListener("click", () => {
            refreshAnalyticsView();
            showToast("Cognitive models recomputed!", "success");
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       ADAPTIVE ASSESSMENT ENGINE (IRT)
       ══════════════════════════════════════════════════════════════════ */

    async function initAdaptiveQuiz(examId) {
        if (!adaptiveQuiz) {
            adaptiveQuiz = new window.AdaptiveQuizEngine();
            window.adaptiveQuiz = adaptiveQuiz;

            adaptiveQuiz.onAttemptRecorded = (result) => {
                // Update graph and analytics in real time
                if (knowledgeGraph && cognitiveModel) {
                    knowledgeGraph.setGraphData(cognitiveModel.getConceptMasteryList());
                }
                refreshAnalyticsView();
            };

            const checkBtn = $("check-answer-btn");
            const prevBtn = $("prev-btn");
            const nextBtn = $("next-btn");
            const restartBtn = $("btn-restart-mock");
            const graphFromRes = $("btn-view-graph-from-result");

            if (checkBtn) checkBtn.addEventListener("click", () => adaptiveQuiz.checkCurrentAnswer());
            if (prevBtn) prevBtn.addEventListener("click", () => adaptiveQuiz.prevQuestion());
            if (nextBtn) nextBtn.addEventListener("click", () => adaptiveQuiz.nextQuestion());
            if (restartBtn) restartBtn.addEventListener("click", () => adaptiveQuiz.restart());
            if (graphFromRes) graphFromRes.addEventListener("click", () => showPanel("page-graph"));
        }

        // Fetch questions from backend or use bank
        let questions = null;
        try {
            const res = await window.apiGateway.getMockTest(examId);
            if (res.success && res.data && res.data.questions) {
                questions = res.data.questions;
            }
        } catch {}

        adaptiveQuiz.init(examId, questions);
    }

    /* ══════════════════════════════════════════════════════════════════
       LIVE REAL-TIME STREAMING QA CHAT (NO REDIRECT!)
       ══════════════════════════════════════════════════════════════════ */

    function initStreamingChat(examId) {
        const messagesContainer = $("chat-messages-container");
        const chatForm = $("chat-form");
        const chatInput = $("chat-input-text");

        if (chatSocketSession) {
            chatSocketSession.disconnect();
        }

        chatSocketSession = window.apiGateway.initSocket(examId, {
            onMessageSaved: (msg) => {
                // Confirm user message saved
            },
            onStreamStart: () => {
                // Create AI message container with typing indicator
                currentStreamingMsgElement = document.createElement("div");
                currentStreamingMsgElement.className = "chat-msg ai-msg";
                currentStreamingMsgElement.innerHTML = `
                    <div class="msg-avatar">AI</div>
                    <div class="msg-content typing-cursor"></div>
                `;
                messagesContainer.appendChild(currentStreamingMsgElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            onStreamChunk: (chunk) => {
                if (currentStreamingMsgElement) {
                    const contentEl = currentStreamingMsgElement.querySelector(".msg-content");
                    if (contentEl) {
                        contentEl.innerHTML = formatMarkdown((contentEl.dataset.rawText || "") + chunk);
                        contentEl.dataset.rawText = (contentEl.dataset.rawText || "") + chunk;
                        contentEl.classList.add("typing-cursor");
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
            },
            onStreamEnd: () => {
                if (currentStreamingMsgElement) {
                    const contentEl = currentStreamingMsgElement.querySelector(".msg-content");
                    if (contentEl) {
                        contentEl.classList.remove("typing-cursor");
                    }
                }
            },
            onError: (err) => {
                showToast("Chat streaming error: " + (err.error || "Connection issue"), "danger");
            }
        });

        if (chatForm && !chatForm.dataset.bound) {
            chatForm.dataset.bound = "true";
            chatForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const text = chatInput.value.trim();
                if (!text) return;

                // Render user message immediately
                const userMsgEl = document.createElement("div");
                userMsgEl.className = "chat-msg user-msg";
                userMsgEl.innerHTML = `
                    <div class="msg-avatar">${(currentUser?.username || "U")[0].toUpperCase()}</div>
                    <div class="msg-content">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
                `;
                messagesContainer.appendChild(userMsgEl);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                chatInput.value = "";
                chatSocketSession.sendMessage(text);
            });

            // Enter key to send (Shift+Enter for newline)
            chatInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    chatForm.dispatchEvent(new Event("submit"));
                }
            });
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       ACADEMIC DOUBT SOLVER
       ══════════════════════════════════════════════════════════════════ */

    function initDoubtSolver() {
        const submitBtn = $("submit-doubt-btn");
        const doubtInput = $("doubt-input");
        const container = $("doubt-solution-container");

        if (!submitBtn || !doubtInput || !container) return;

        submitBtn.addEventListener("click", async () => {
            const doubt = doubtInput.value.trim();
            if (!doubt) {
                showToast("Please enter a question or problem.", "warning");
                return;
            }
            if (!selectedExam) {
                showToast("Please select or configure an exam first.", "warning");
                return;
            }

            submitBtn.innerHTML = `Solving with AI...`;
            submitBtn.disabled = true;
            container.innerHTML = `
                <div class="loader-wrapper">
                    <div class="spinner"></div>
                    <p style="color:var(--text-secondary);font-size:0.88rem;">Analyzing problem statement and generating structured academic solution...</p>
                </div>
            `;

            try {
                const res = await window.apiGateway.solveDoubt(selectedExam._id, doubt);
                submitBtn.innerHTML = `
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    Solve Doubt with AI
                `;
                submitBtn.disabled = false;

                if (res.success && res.data && res.data.answer) {
                    container.innerHTML = `
                        <div style="border-bottom:1px solid var(--border-color);padding-bottom:14px;margin-bottom:18px;">
                            <h3 style="font-size:1.1rem;font-weight:800;">Conceptual Resolution</h3>
                        </div>
                        ${formatMarkdown(res.data.answer)}
                    `;
                    doubtInput.value = "";
                    showToast("Solution generated!", "success");
                } else {
                    container.innerHTML = `<div class="empty-state"><p>Could not resolve doubt. Please retry.</p></div>`;
                    showToast(res.message || "Failed to solve doubt.", "danger");
                }
            } catch {
                submitBtn.innerHTML = "Solve Doubt with AI";
                submitBtn.disabled = false;
                container.innerHTML = `<div class="empty-state"><p>Network error while resolving doubt.</p></div>`;
                showToast("Network error occurred.", "danger");
            }
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       TAB NAVIGATION WIRING
       ══════════════════════════════════════════════════════════════════ */

    function initTabNavigation() {
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const target = btn.dataset.target;
                if (target) showPanel(target);
            });
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       INITIALIZATION ENTRYPOINT
       ══════════════════════════════════════════════════════════════════ */

    document.addEventListener("DOMContentLoaded", () => {
        initAuth();
        initTabNavigation();
        initDoubtSolver();
        checkAuthSession();
    });

})();
