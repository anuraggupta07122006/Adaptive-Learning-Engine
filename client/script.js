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
                showLanding();
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
        if (!token) {
            showLanding();
            return;
        }

        if (cachedUser) {
            currentUser = cachedUser;
            enterDashboard();
            return;
        }

        const res = await window.apiGateway.getMe();
        if (res && res.success) {
            currentUser = res.data;
            enterDashboard();
        } else {
            showLanding();
        }
    }

    function enterDashboard() {
        if ($("landing-section")) $("landing-section").style.display = "none";
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
       STRATEGY ROADMAP — STUDYROADMAP.IN HIGH-YIELD ARCHITECTURE
       ══════════════════════════════════════════════════════════════════ */

    function parseRoadmapModel(exam, strategy) {
        const subjects = [];
        const colorPalette = [
            "#8b5cf6", // Violet
            "#3b82f6", // Blue
            "#10b981", // Emerald
            "#f59e0b", // Amber
            "#ec4899", // Pink
            "#06b6d4"  // Cyan
        ];

        const syllabusText = (exam.syllabusText || "").trim();
        const unitMatches = [...syllabusText.matchAll(/(?:UNIT|MODULE|CHAPTER|PART)\s*(\d+)\s*[:\-–]\s*([^\n\r]+)/gi)];

        if (unitMatches.length > 0) {
            const rawBlocks = syllabusText.split(/(?:UNIT|MODULE|CHAPTER|PART)\s*\d+\s*[:\-–]\s*[^\n\r]+/gi);
            unitMatches.forEach((m, idx) => {
                const unitName = m[2].trim();
                const unitContent = rawBlocks[idx + 1] || "";
                const lines = unitContent.split("\n")
                    .map(l => l.replace(/^[\s\-*•\d\.\)]+/, "").trim())
                    .filter(l => l.length > 3);

                subjects.push({
                    id: "subject-" + idx,
                    name: unitName.length > 3 ? unitName : "Unit " + (idx + 1),
                    color: colorPalette[idx % colorPalette.length],
                    topics: lines.map((line, tIdx) => ({
                        id: "topic-u" + idx + "-t" + tIdx,
                        title: line,
                        subjectName: unitName,
                        subjectColor: colorPalette[idx % colorPalette.length],
                        weightStars: tIdx === 0 || tIdx === 1 ? 5 : tIdx === 2 ? 4 : 3,
                        highPriority: tIdx < 2
                    }))
                });
            });
        }

        if (subjects.length === 0) {
            if (strategy.milestones && strategy.milestones.length > 0) {
                strategy.milestones.forEach((ms, idx) => {
                    subjects.push({
                        id: "subject-" + idx,
                        name: ms.title.replace(/^Phase\s*\d+\s*[:\-–]\s*/i, ""),
                        color: colorPalette[idx % colorPalette.length],
                        topics: []
                    });
                });
            } else {
                subjects.push({
                    id: "subject-0",
                    name: exam.examName || "Core Curriculum",
                    color: colorPalette[0],
                    topics: []
                });
            }

            const schedule = strategy.schedule || [];
            schedule.forEach((day, dIdx) => {
                const sIdx = dIdx % subjects.length;
                subjects[sIdx].topics.push({
                    id: "topic-s" + sIdx + "-d" + dIdx,
                    title: day.topic || "Day " + (dIdx + 1) + " Focus",
                    tasks: day.tasks || [],
                    subjectName: subjects[sIdx].name,
                    subjectColor: subjects[sIdx].color,
                    weightStars: dIdx < 2 ? 5 : dIdx < 4 ? 4 : 3,
                    highPriority: dIdx < 2
                });
            });
        }

        const allTopics = [];
        subjects.forEach((s, sIdx) => {
            s.topics.forEach((t, tIdx) => {
                allTopics.push({
                    ...t,
                    subjectIdx: sIdx,
                    topicIdx: tIdx
                });
            });
        });

        const highestYieldTopics = [...allTopics]
            .sort((a, b) => b.weightStars - a.weightStars)
            .slice(0, 6);

        const durationNum = parseFloat(exam.duration) || 18;
        const totalDays = (strategy.schedule && strategy.schedule.length > 0) 
            ? strategy.schedule.length 
            : Math.max(1, Math.ceil(durationNum / 3.5));

        return { subjects, allTopics, highestYieldTopics, totalDays };
    }

    let currentRoadmapModel = null;

    function renderStrategyFlowchart(strategy) {
        const container = $("tree-flowchart-container");
        const tipsSection = $("tips-section");
        if (!container || !selectedExam) return;

        if (!strategy) {
            container.innerHTML = `<div class="empty-state"><p>No strategy data found for this exam.</p></div>`;
            return;
        }

        const examId = selectedExam._id;
        const model = parseRoadmapModel(selectedExam, strategy);
        currentRoadmapModel = model;

        const savedStates = {};
        try {
            const raw = localStorage.getItem(`prepos-roadmap-tasks-${examId}`);
            if (raw) Object.assign(savedStates, JSON.parse(raw));
        } catch {}

        model.allTopics.forEach(t => {
            t.checked = savedStates[t.id] === true;
        });
        model.subjects.forEach(s => {
            s.topics.forEach(t => {
                t.checked = savedStates[t.id] === true;
            });
        });
        model.highestYieldTopics.forEach(t => {
            t.checked = savedStates[t.id] === true;
        });

        if ($("strategy-summary")) {
            $("strategy-summary").innerText = strategy.summary || "Your step-by-step roadmap to mastery.";
        }

        const milestones = strategy.milestones || [
            { title: "Phase 1: Foundation & High-Yield Core", description: "Build first-principles understanding of essential formulas and definitions." },
            { title: "Phase 2: Numerical Practice & Problem Solving", description: "Work through PYQs, standard problem patterns, and edge-case behaviors." },
            { title: "Phase 3: Timed Mocks & Speed Calibration", description: "Complete full syllabus drills under timed testing constraints." }
        ];

        let html = `
            <!-- 1. Disclaimer Banner -->
            <div class="sr-disclaimer">
                <svg class="sr-disclaimer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div class="sr-disclaimer-text">
                    <strong>Disclaimer:</strong> StudyRoadmap™ adaptive trajectory is a high-yield preparation aid. Always adjust daily pacing based on your real-time concept mastery.
                </div>
            </div>

            <!-- 2. Exam Overview Hero Card -->
            <div class="sr-hero-card">
                <div class="sr-hero-top">
                    <div class="sr-hero-icon-box">🎓</div>
                    <div class="sr-hero-info">
                        <h2 class="sr-hero-title">${selectedExam.examName}</h2>
                        <p class="sr-hero-desc">Personalized high-yield cognitive roadmap sequenced by exam weight and prerequisite chains.</p>
                        <div class="sr-hero-pills">
                            <span class="sr-pill">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                ${selectedExam.duration} Hours
                            </span>
                            <span class="sr-pill">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                ${model.totalDays} Days
                            </span>
                            <span class="sr-pill">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                ${model.allTopics.length} highest-weight topics
                            </span>
                            <span class="sr-pill sr-pill-accent">
                                ✦ High-Yield Optimized
                            </span>
                        </div>
                        <div class="sr-hero-actions">
                            <button type="button" class="sr-btn-share" onclick="window.shareRoadmapLink(this)">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.43.615.74.937.31.322.673.586.986.748l4.837 3.125a2.25 2.25 0 01.447 1.634v.626a.75.75 0 01-.75.75h-2.5a.75.75 0 01-.75-.75v-1.803a2.083 2.083 0 01-.447-1.27l.795-1.23a1.994 1.994 0 00-.448-2.522l-3.5-2.5a1.994 1.994 0 00-2.522.448l-1.5 1.5a2.25 2.25 0 102.186 2.186m5.25-4.499v5.142m0-5.142l-5.25 4.5-5.25-4.5"/></svg>
                                <span class="sr-btn-text">Share roadmap</span>
                            </button>
                            <button type="button" class="sr-btn-print" onclick="window.printRoadmap()">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                Print
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. Start Here — Highest Yield Card -->
            <div class="sr-highest-yield-card">
                <div class="sr-card-header">
                    <h3 class="sr-card-title">Start here — highest yield for ${selectedExam.examName}</h3>
                    <p class="sr-card-subtitle">These top topics carry the most weight in recent exams. Master these first before moving to other chapters.</p>
                </div>
                <div class="sr-yield-list">
                    ${model.highestYieldTopics.map((topic, idx) => `
                        <div class="sr-yield-item ${topic.checked ? 'completed' : ''}" data-topic-id="${topic.id}">
                            <input type="checkbox" id="yield-cb-${topic.id}" class="sr-checkbox" 
                                data-topic-id="${topic.id}" ${topic.checked ? 'checked' : ''} 
                                onchange="window.toggleRoadmapTopic(this)">
                            <span class="sr-rank">#${idx + 1}</span>
                            <div class="sr-yield-content">
                                <label for="yield-cb-${topic.id}" class="sr-topic-title" style="cursor:pointer;">${topic.title}</label>
                                <span class="sr-topic-subject-badge" style="background:${topic.subjectColor}20; color:${topic.subjectColor}; border:1px solid ${topic.subjectColor}40;">${topic.subjectName}</span>
                            </div>
                            <div class="sr-stars" title="${topic.weightStars} of 5 weight">
                                ${'★'.repeat(topic.weightStars) + '☆'.repeat(5 - topic.weightStars)}
                            </div>
                            <button type="button" class="sr-btn-notes" onclick="window.openTopicNotes('${topic.title.replace(/'/g, "\\'")}', '${(topic.subjectName || '').replace(/'/g, "\\'")}')">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>
                                <span>Open notes</span>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 4. Progress Overview Card -->
            <div class="sr-progress-card">
                <div class="sr-progress-header">
                    <h3 class="sr-progress-title">Progress Overview — ${selectedExam.examName}</h3>
                    <span class="sr-streak-pill">🔥 3-Day Retention Streak</span>
                </div>
                <div class="sr-overall-progress-group">
                    <div class="sr-progress-meta">
                        <span id="sr-overall-topics-text" class="sr-meta-text">0 / ${model.allTopics.length} topics completed</span>
                        <span id="sr-overall-pct-text" class="sr-meta-pct">0%</span>
                    </div>
                    <div class="sr-progress-track">
                        <div id="sr-overall-progress-fill" class="sr-progress-fill" style="width: 0%;"></div>
                    </div>
                </div>
                <div class="sr-subject-progress-grid">
                    ${model.subjects.map((sub) => `
                        <div class="sr-subject-progress-item" data-subject-id="${sub.id}">
                            <div class="sr-sub-meta">
                                <div class="sr-sub-name-group">
                                    <span class="sr-dot" style="background:${sub.color};"></span>
                                    <span class="sr-sub-name">${sub.name}</span>
                                </div>
                                <span id="sr-sub-pct-${sub.id}" class="sr-sub-pct">0% (${sub.topics.length} topics)</span>
                            </div>
                            <div class="sr-sub-track">
                                <div id="sr-sub-fill-${sub.id}" class="sr-sub-fill" style="background:${sub.color}; width: 0%;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 5. Phase Plan Stepper Card -->
            <div class="sr-phase-card">
                <div class="sr-card-header">
                    <h3 class="sr-card-title">Phase plan</h3>
                    <p class="sr-card-subtitle">How to sequence this timeline: foundation, then practice, then mocks.</p>
                </div>
                <div class="sr-phase-list">
                    ${milestones.map((ms, idx) => `
                        <div class="sr-phase-item">
                            <div class="sr-phase-badge">${idx + 1}</div>
                            <div class="sr-phase-body">
                                <div class="sr-phase-heading">${ms.title}</div>
                                <p class="sr-phase-desc">${ms.description}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 6. By Subject — Heaviest Topics First Section -->
            <div class="sr-subjects-section">
                <div class="sr-section-toolbar">
                    <h3 class="sr-section-title">By subject — heaviest topics first</h3>
                    <div class="sr-toolbar-actions">
                        <button type="button" class="sr-action-btn sr-btn-highlight" onclick="window.studyNextIncompleteTopic()">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                            Study next incomplete
                        </button>
                        <button type="button" id="sr-toggle-all-btn" class="sr-action-btn" onclick="window.toggleAllRoadmapSubjects()">
                            Collapse All
                        </button>
                        <button type="button" class="sr-action-btn" onclick="window.printRoadmap()">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                            Print
                        </button>
                    </div>
                </div>

                <div class="sr-accordions-list">
                    ${model.subjects.map((sub, sIdx) => `
                        <div class="sr-accordion-item ${sIdx === 0 || sIdx === 1 ? 'is-open' : ''}" id="accordion-${sub.id}">
                            <button type="button" class="sr-accordion-trigger" onclick="window.toggleSubjectAccordion('accordion-${sub.id}')">
                                <div class="sr-trigger-left">
                                    <span class="sr-sub-dot" style="background:${sub.color};"></span>
                                    <span class="sr-sub-title">${sub.name}</span>
                                    <span class="sr-tag-pill">${sub.topics.length} topics</span>
                                </div>
                                <div class="sr-trigger-right">
                                    <span class="sr-meta-tag">${sub.topics.filter(t => t.highPriority).length} high-priority</span>
                                    <svg class="sr-chevron w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                </div>
                            </button>
                            <div class="sr-accordion-panel">
                                <div class="sr-topics-grid">
                                    ${sub.topics.map((t, tIdx) => `
                                        <div class="sr-topic-card ${t.checked ? 'completed' : ''}" id="topic-card-${t.id}" data-topic-id="${t.id}">
                                            <div class="sr-topic-card-top">
                                                <div class="sr-topic-check-wrap">
                                                    <input type="checkbox" id="sub-cb-${t.id}" class="sr-checkbox" 
                                                        data-topic-id="${t.id}" ${t.checked ? 'checked' : ''} 
                                                        onchange="window.toggleRoadmapTopic(this)">
                                                    <span class="sr-rank">#${tIdx + 1}</span>
                                                </div>
                                                <div class="sr-stars" title="${t.weightStars} of 5 weight">
                                                    ${'★'.repeat(t.weightStars) + '☆'.repeat(5 - t.weightStars)}
                                                </div>
                                            </div>
                                            <div class="sr-topic-card-body">
                                                <label for="sub-cb-${t.id}" class="sr-topic-title" style="cursor:pointer;">${t.title}</label>
                                                ${t.tasks && t.tasks.length ? `
                                                    <ul class="sr-topic-tasks">
                                                        ${t.tasks.map(tsk => `<li>${tsk}</li>`).join('')}
                                                    </ul>
                                                ` : ''}
                                            </div>
                                            <div class="sr-topic-card-footer">
                                                <span class="sr-priority-badge" style="color:${sub.color}; background:${sub.color}15;">Priority in ${sub.name}</span>
                                                <button type="button" class="sr-btn-notes-sm" onclick="window.openTopicNotes('${t.title.replace(/'/g, "\\'")}', '${(sub.name || '').replace(/'/g, "\\'")}')">
                                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>
                                                    <span>Open notes</span>
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 7. Timeline Adjuster Chips -->
            <div class="sr-timeline-adjuster">
                <div class="sr-timeline-title">Adjust your timeline:</div>
                <div class="sr-timeline-chips">
                    <button type="button" class="sr-chip" onclick="window.adjustRoadmapTimeline(12)">12 Hours →</button>
                    <button type="button" class="sr-chip" onclick="window.adjustRoadmapTimeline(24)">1 Day →</button>
                    <button type="button" class="sr-chip" onclick="window.adjustRoadmapTimeline(72)">3 Days →</button>
                    <button type="button" class="sr-chip" onclick="window.adjustRoadmapTimeline(168)">1 Week →</button>
                    <button type="button" class="sr-chip" onclick="window.adjustRoadmapTimeline(720)">1 Month →</button>
                    <button type="button" class="sr-chip" onclick="window.adjustRoadmapTimeline(2160)">3 Months →</button>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Tips
        if (tipsSection && strategy.tips && strategy.tips.length > 0) {
            tipsSection.innerHTML = `
                <div class="tips-section" style="margin-top:18px;">
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

    /* ── Roadmap Interactivity Handlers ── */

    window.toggleRoadmapTopic = function(checkbox) {
        const topicId = checkbox.dataset.topicId;
        const isChecked = checkbox.checked;

        // Synchronize all checkboxes matching this topic (both in Start Here & Accordion)
        document.querySelectorAll(`input[data-topic-id="${topicId}"]`).forEach(cb => {
            cb.checked = isChecked;
        });

        // Toggle completed class on cards
        document.querySelectorAll(`[data-topic-id="${topicId}"]`).forEach(el => {
            if (isChecked) el.classList.add("completed");
            else el.classList.remove("completed");
        });

        // Save to localStorage
        if (selectedExam) {
            const examId = selectedExam._id;
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem(`prepos-roadmap-tasks-${examId}`) || "{}"); } catch {}
            saved[topicId] = isChecked;
            localStorage.setItem(`prepos-roadmap-tasks-${examId}`, JSON.stringify(saved));
        }

        updateRoadmapProgress();
        refreshAnalyticsView();
    };

    window.toggleRoadmapTask = window.toggleRoadmapTopic; // Backwards-compatible alias

    window.toggleSubjectAccordion = function(accordionId) {
        const item = $(accordionId);
        if (item) {
            item.classList.toggle("is-open");
        }
    };

    window.toggleAllRoadmapSubjects = function() {
        const items = document.querySelectorAll(".sr-accordion-item");
        const btn = $("sr-toggle-all-btn");
        if (!items.length) return;

        const anyClosed = Array.from(items).some(i => !i.classList.contains("is-open"));
        items.forEach(i => {
            if (anyClosed) i.classList.add("is-open");
            else i.classList.remove("is-open");
        });

        if (btn) btn.innerText = anyClosed ? "Collapse All" : "Expand All";
    };

    window.studyNextIncompleteTopic = function() {
        const nextCb = document.querySelector(".sr-topics-grid input[type='checkbox']:not(:checked)");
        if (!nextCb) {
            showToast("All topics completed! Outstanding preparation! 🎉", "success");
            return;
        }

        const card = nextCb.closest(".sr-topic-card");
        const accordion = nextCb.closest(".sr-accordion-item");

        if (accordion && !accordion.classList.contains("is-open")) {
            accordion.classList.add("is-open");
        }

        if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            card.classList.add("highlight-pulse");
            setTimeout(() => card.classList.remove("highlight-pulse"), 2500);

            const title = card.querySelector(".sr-topic-title")?.innerText || "Next High-Yield Concept";
            showToast(`Focus Drill: ${title}`, "info");
        }
    };

    window.shareRoadmapLink = function(btn) {
        const url = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                showToast("Roadmap link copied to clipboard!", "success");
                if (btn) {
                    const textEl = btn.querySelector(".sr-btn-text");
                    if (textEl) {
                        const original = textEl.innerText;
                        textEl.innerText = "Copied!";
                        setTimeout(() => textEl.innerText = original, 2000);
                    }
                }
            }).catch(() => {
                showToast("Share URL: " + url, "info");
            });
        } else {
            showToast("Share URL: " + url, "info");
        }
    };

    window.printRoadmap = function() {
        window.print();
    };

    /* ══════════════════════════════════════════════════════════════════
       COMPREHENSIVE AI STUDY NOTES SYSTEM & MODAL READER
       ══════════════════════════════════════════════════════════════════ */

    let currentActiveNoteTopic = null;

    window.openTopicNotes = function(topicTitle, subjectName) {
        if (!topicTitle) return;
        currentActiveNoteTopic = { title: topicTitle, subject: subjectName || "Core Concept" };

        const modal = $("modal-study-notes");
        if (!modal) {
            showToast("Notes modal element not found.", "warning");
            return;
        }

        // Populate header elements
        if ($("notes-modal-title")) $("notes-modal-title").innerText = topicTitle;
        if ($("notes-subject-badge")) {
            $("notes-subject-badge").innerText = subjectName || "Academic Curriculum";
        }

        // Check if completed on roadmap
        updateNotesModalCompletionButton();

        // Render notes body
        const contentContainer = $("notes-modal-content");
        if (contentContainer) {
            contentContainer.innerHTML = `
                <div class="loader-wrapper" style="padding:40px 0;">
                    <div class="spinner"></div>
                    <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:12px;">Generating high-yield academic study notes with formulas, PYQs, and active recall...</p>
                </div>
            `;
        }

        // Display modal
        modal.style.display = "flex";
        document.body.style.overflow = "hidden"; // Prevent background scroll

        // Instant generation with slight animation tick
        setTimeout(() => {
            renderStudyNotesContent(topicTitle, subjectName);
        }, 180);
    };

    function closeStudyNotesModal() {
        const modal = $("modal-study-notes");
        if (modal) {
            modal.style.display = "none";
            document.body.style.overflow = "";
        }
        currentActiveNoteTopic = null;
    }

    window.toggleActiveRecallAnswer = function(btn) {
        const item = btn.closest(".notes-recall-item");
        if (!item) return;
        item.classList.toggle("revealed");
        btn.innerText = item.classList.contains("revealed") ? "Hide Answer" : "Reveal Answer";
    };

    function updateNotesModalCompletionButton() {
        const btn = $("btn-notes-toggle-complete");
        const btnText = $("btn-notes-complete-text");
        if (!btn || !btnText || !currentActiveNoteTopic) return;

        // Check if the topic is currently checked on the roadmap
        const topicCard = findTopicCardByTitle(currentActiveNoteTopic.title);
        const isChecked = topicCard ? topicCard.classList.contains("completed") : false;

        if (isChecked) {
            btnText.innerText = "Completed ✓";
            btn.style.background = "var(--gradient-emerald)";
            btn.style.borderColor = "#10b981";
        } else {
            btnText.innerText = "Mark Topic Completed";
            btn.style.background = "";
            btn.style.borderColor = "";
        }
    }

    function findTopicCardByTitle(title) {
        const clean = (title || "").trim().toLowerCase();
        const cards = document.querySelectorAll(".sr-topic-card, .sr-yield-item");
        for (const card of cards) {
            const t = card.querySelector(".sr-topic-title");
            if (t && t.innerText.trim().toLowerCase() === clean) {
                return card;
            }
        }
        return null;
    }

    function renderStudyNotesContent(topicTitle, subjectName) {
        const container = $("notes-modal-content");
        if (!container) return;

        const note = generateTopicStudyNotes(topicTitle, subjectName, selectedExam?.examName || "Competitive Examination");

        container.innerHTML = `
            <!-- 1. First-Principles Core Concept -->
            <div class="notes-card-section">
                <div class="notes-section-head">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>1. First-Principles Conceptual Overview</span>
                </div>
                <div class="notes-core-text">
                    ${note.coreSummary}
                </div>
            </div>

            <!-- 2. High-Yield Formulas & Algorithmic Steps -->
            <div class="notes-card-section">
                <div class="notes-section-head">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                    <span>2. Essential Formulas, Algorithms & Criteria</span>
                </div>
                <div class="notes-core-text">
                    ${note.formulas}
                </div>
            </div>

            <!-- 3. Crucial Exam Pitfalls & Invariants -->
            <div class="notes-card-section">
                <div class="notes-section-head">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <span>3. High-Frequency Exam Traps & Edge Cases</span>
                </div>
                <ul class="notes-bullet-list">
                    ${note.traps.map(trap => `<li>${trap}</li>`).join("")}
                </ul>
            </div>

            <!-- 4. Solved PYQ Worked Problem -->
            <div class="notes-card-section">
                <div class="notes-section-head">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>4. Standard Previous-Year Question (PYQ) Exemplar</span>
                </div>
                <div class="notes-pyq-box">
                    <div class="notes-pyq-title">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span>Standard Numerical / Concept Problem:</span>
                    </div>
                    <div style="font-size:0.86rem;color:var(--text-main);margin-bottom:10px;line-height:1.5;">
                        ${note.pyq.question}
                    </div>
                    <div style="font-size:0.82rem;color:#a7f3d0;background:rgba(6,78,59,0.3);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:12px;line-height:1.55;">
                        <strong style="color:#6ee7b7;display:block;margin-bottom:4px;">Step-by-Step Solution:</strong>
                        ${note.pyq.solution}
                    </div>
                </div>
            </div>

            <!-- 5. Active Recall Check -->
            <div class="notes-card-section">
                <div class="notes-section-head">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                    <span>5. Active Recall Self-Check Flashcards</span>
                </div>
                <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;">Test your conceptual retention immediately. Think of the answer before revealing:</div>
                ${note.recall.map((r, i) => `
                    <div class="notes-recall-item">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                            <span class="notes-recall-q">Q${i+1}: ${r.q}</span>
                            <button type="button" class="btn-reveal-ans" onclick="window.toggleActiveRecallAnswer(this)">Reveal Answer</button>
                        </div>
                        <div class="notes-recall-ans">
                            <strong>Answer:</strong> ${r.a}
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    function generateTopicStudyNotes(title, subject, examName) {
        const lower = (title || "").toLowerCase();

        // 1. Process Scheduling
        if (lower.includes("schedul") || lower.includes("fcfs") || lower.includes("sjf") || lower.includes("round robin") || lower.includes("priority")) {
            return {
                coreSummary: "<strong>CPU Scheduling</strong> is the foundation of operating system multiprogramming. When the CPU becomes idle, the short-term scheduler selects a process from the Ready queue. Algorithms balance <em>CPU utilization</em>, <em>throughput</em>, <em>turnaround time</em>, <em>waiting time</em>, and <em>response time</em>.",
                formulas: `<div class="notes-formula-box">
Turnaround Time (TAT) = Completion Time (CT) - Arrival Time (AT)
Waiting Time (WT)    = Turnaround Time (TAT) - Burst Time (BT)
Response Time (RT)   = Time at First CPU Allocation - Arrival Time (AT)
</div>
<ul class="notes-bullet-list">
    <li><strong>FCFS</strong>: Non-preemptive, suffers from <em>Convoy Effect</em> (short jobs stuck behind a CPU-heavy process).</li>
    <li><strong>SJF (Shortest Job First)</strong>: Provably optimal minimum average waiting time. Preemptive version is <em>SRTF</em> (Shortest Remaining Time First).</li>
    <li><strong>Round Robin (RR)</strong>: Preemptive with time quantum <code>q</code>. If <code>q → ∞</code>, behaves as FCFS. If <code>q → 0</code>, high context-switch thrashing. Optimal heuristic: 80% of CPU bursts should be shorter than <code>q</code>.</li>
    <li><strong>Priority Scheduling</strong>: High priority executed first. Starvation solved via <strong>Aging</strong> (gradually raising priority of waiting processes).</li>
</ul>`,
                traps: [
                    "<strong>Common Trap</strong>: Confusing Turnaround Time with Waiting Time. Always remember: <code>WT = TAT - BT</code>.",
                    "In <strong>Preemptive SJF (SRTF)</strong>, you must re-evaluate the remaining burst times of ALL ready processes at every integer time unit whenever a new process arrives.",
                    "A process in the <strong>Waiting / Blocked</strong> state never goes straight to the Running state; upon I/O completion, it always rejoins the <strong>Ready Queue</strong> first."
                ],
                pyq: {
                    question: "Consider 3 processes P1(AT=0, BT=4), P2(AT=1, BT=3), P3(AT=2, BT=1). Compute the Average Waiting Time under Shortest Remaining Time First (SRTF).",
                    solution: "At t=0: P1 executes. At t=1: P1 has remaining 3, P2 arrives with BT=3 (tie, P1 continues). At t=2: P3 arrives with BT=1. Remaining: P1(2), P2(3), P3(1). P3 preempts and runs t=2..3 (CT=3). Next, P1 runs t=3..5 (CT=5). Finally, P2 runs t=5..8 (CT=8).<br>TAT: P1=5-0=5, P2=8-1=7, P3=3-2=1.<br>WT: P1=5-4=1, P2=7-3=4, P3=1-1=0.<br><strong>Average WT = (1 + 4 + 0) / 3 = 1.67 time units.</strong>"
                },
                recall: [
                    { q: "Why is Shortest Job First (SJF) mathematically provable to minimize average waiting time?", a: "By scheduling the shortest burst first, the waiting times of all subsequent processes decrease by the shortest amount, minimizing the global sum of waiting times." },
                    { q: "What is the convoy effect in FCFS scheduling?", a: "The convoy effect occurs when short, I/O-bound processes spend extended periods waiting in the ready queue while a single long, CPU-bound process hogs the processor." }
                ]
            };
        }

        // 2. Concurrency, Semaphores & Critical Section
        if (lower.includes("semaphore") || lower.includes("concurrency") || lower.includes("critical") || lower.includes("mutex") || lower.includes("peterson") || lower.includes("synchronization")) {
            return {
                coreSummary: "A <strong>Critical Section (CS)</strong> is a segment of code where shared resources (memory, files, variables) are accessed. A race condition occurs when outcome depends on concurrent execution order. Any correct synchronization mechanism must strictly guarantee 3 requirements: <strong>Mutual Exclusion</strong>, <strong>Progress</strong>, and <strong>Bounded Waiting</strong>.",
                formulas: `<div class="notes-formula-box">
// Semaphore Invariant & Primitive Definitions:
wait(S)   [P(S)]:  while (S <= 0); S--;   // Atomic decrement; block if negative
signal(S) [V(S)]:  S++;                    // Atomic increment; unblock sleeper
</div>
<ul class="notes-bullet-list">
    <li><strong>Counting Semaphore</strong>: Integer domain over unrestricted values. Used to manage resource pools of size <code>N</code>.</li>
    <li><strong>Binary Semaphore (Mutex)</strong>: Range restricted to <code>0</code> and <code>1</code>. Guarantees mutual exclusion.</li>
    <li><strong>Peterson's Algorithm</strong>: Software-based solution for 2 processes using <code>turn</code> and <code>flag[2]</code>. Guarantees all 3 CS requirements.</li>
</ul>`,
                traps: [
                    "<strong>Deadlock Trap</strong>: In Producer-Consumer with bounded buffer, swapping <code>wait(mutex)</code> before <code>wait(empty)</code> leads to immediate deadlock if the buffer is empty!",
                    "Disabling interrupts is acceptable ONLY for single-core kernel code; on multi-core systems, sending hardware inter-processor interrupts incurs prohibitive overhead.",
                    "Spinlocks (busy-waiting) are beneficial ONLY when lock hold times are shorter than two context-switch operations."
                ],
                pyq: {
                    question: "Show how a counting semaphore initialized to 10 can be used to control access to a database connection pool with 10 concurrent connections.",
                    solution: "Initialize <code>Semaphore pool = 10;</code>.<br>Before connecting: Worker calls <code>wait(pool);</code> which decrements available count. If 10 connections are active, subsequent calls block.<br>After query execution: Worker calls <code>signal(pool);</code> which increments available count and wakes a waiting thread.<br>This strictly maintains the invariant <code>ActiveConnections <= 10</code> at all times."
                },
                recall: [
                    { q: "What are the 3 mandatory requirements that any solution to the Critical Section problem must satisfy?", a: "1. Mutual Exclusion (only 1 process in CS), 2. Progress (selection cannot be postponed if CS free), 3. Bounded Waiting (limit on times others enter before a waiting process is serviced)." },
                    { q: "Why is disabling hardware interrupts not a viable synchronization technique on modern multi-processor architectures?", a: "Disabling interrupts on one processor does not disable them on other processors, so processes on other cores can still concurrently access shared memory." }
                ]
            };
        }

        // 3. Deadlocks & Banker's Algorithm
        if (lower.includes("deadlock") || lower.includes("banker") || lower.includes("avoidance") || lower.includes("safe state")) {
            return {
                coreSummary: "A <strong>Deadlock</strong> is an irrevocable state in which every process in a set is waiting for an event that only another process in the set can cause. The <strong>Banker's Algorithm</strong> is a deadlock avoidance algorithm that tests for safety by simulating maximum resource allocation before granting requests.",
                formulas: `<div class="notes-formula-box">
Need Matrix Definition:
Need[i][j] = Max[i][j] - Allocation[i][j]

Resource Request Safety Test:
1. If Request_i <= Need_i, proceed; else throw error (exceeded claim).
2. If Request_i <= Available, proceed; else Process P_i must wait.
3. Pretend allocation:
   Available  = Available - Request_i
   Allocation = Allocation + Request_i
   Need       = Need - Request_i
4. Run Safety Algorithm. If state is SAFE → Grant; else Rollback & Wait.
</div>`,
                traps: [
                    "<strong>Core Theorem</strong>: An <em>Unsafe State</em> is NOT a deadlock! An unsafe state merely means the operating system can no longer guarantee that a deadlock will not occur.",
                    "In a Resource Allocation Graph (RAG), a cycle is a <strong>necessary and sufficient</strong> condition for deadlock ONLY if every resource type has exactly 1 instance. If multi-instance resources exist, a cycle does not guarantee deadlock!",
                    "Deadlock <em>Prevention</em> eliminates at least 1 of Coffman's 4 conditions statically, while Deadlock <em>Avoidance</em> dynamically monitors safety."
                ],
                pyq: {
                    question: "A system has 5 processes P0-P4 and 3 resource types A(10), B(5), C(7). P0 has Allocation=(0,1,0), Max=(7,5,3). Find Need for P0 and explain if a state with Available=(3,3,2) is safe.",
                    solution: "Need[P0] = Max - Allocation = (7-0, 5-1, 3-0) = (7, 4, 3).<br>Since Need[P0] = (7,4,3) > Available(3,3,2), P0 cannot execute immediately.<br>The safety algorithm proceeds to find a process whose Need <= Available (e.g. P1 or P3), recovers its allocated resources upon termination, and safely constructs an execution sequence."
                },
                recall: [
                    { q: "What are the 4 necessary Coffman conditions for deadlock?", a: "1. Mutual Exclusion, 2. Hold and Wait, 3. No Preemption, and 4. Circular Wait." },
                    { q: "Does a cycle in a Resource Allocation Graph (RAG) always indicate a deadlock?", a: "Only if every resource type in the graph has a single instance. With multiple instances per resource type, a cycle does not necessarily imply deadlock." }
                ]
            };
        }

        // 4. Memory Paging, TLB, Virtual Memory
        if (lower.includes("pag") || lower.includes("memory") || lower.includes("tlb") || lower.includes("virtual") || lower.includes("segmentation")) {
            return {
                coreSummary: "<strong>Paging</strong> is a memory management scheme that eliminates the need for contiguous allocation of physical memory. Logical memory is broken into fixed-size blocks called <strong>Pages</strong>, and physical memory is divided into blocks of the same size called <strong>Frames</strong>. The <strong>MMU</strong> maps page numbers to frame numbers via a page table.",
                formulas: `<div class="notes-formula-box">
Logical Address = <p, d>
Where:
p (Page Number) = Address / Page Size  (high-order bits)
d (Offset)      = Address % Page Size  (low-order bits)

Effective Memory Access Time (EAT) with TLB:
EAT = h * (t_tlb + t_mem) + (1 - h) * (t_tlb + 2 * t_mem)
Where h = TLB hit ratio, t_tlb = TLB lookup time, t_mem = Main memory access time.
</div>`,
                traps: [
                    "<strong>Fragmentation Trap</strong>: Paging has <strong>ZERO external fragmentation</strong>, but suffers from <strong>Internal Fragmentation</strong> on the last page of a process (average loss = 0.5 * Page Size).",
                    "Page Fault handling requires a trap to the OS, saving process state, reading the missing page from disk (swap space) into a free frame, updating the page table, and restarting the instruction.",
                    "In multi-level paging, a <code>k</code>-level page table requires <code>k + 1</code> memory accesses for every single logical memory access in the worst case (without TLB)."
                ],
                pyq: {
                    question: "A system uses a 32-bit logical address space and 4 KB page size. Main memory access time is 100 ns, TLB lookup time is 20 ns, and TLB hit ratio is 90%. Calculate Effective Access Time (EAT).",
                    solution: "Page Size = 4 KB = 2^12 bytes, so offset d = 12 bits, page number p = 32 - 12 = 20 bits.<br>EAT = h * (t_tlb + t_mem) + (1 - h) * (t_tlb + 2 * t_mem)<br>EAT = 0.90 * (20 + 100) + 0.10 * (20 + 200)<br>EAT = 0.90 * 120 + 0.10 * 220 = 108 + 22 = <strong>130 ns</strong>."
                },
                recall: [
                    { q: "What is the difference between internal and external fragmentation?", a: "External fragmentation occurs when total free memory is sufficient but non-contiguous. Internal fragmentation occurs when allocated memory is larger than requested memory (e.g. unused bytes in the last page frame)." },
                    { q: "Why is a Translation Lookaside Buffer (TLB) essential in paged memory systems?", a: "Because standard paging requires at least two memory accesses per data lookup (one for page table, one for data). A TLB provides fast associative hardware lookup to achieve single-cycle translation." }
                ]
            };
        }

        // 5. Page Replacement & Virtual Memory
        if (lower.includes("page replacement") || lower.includes("fifo") || lower.includes("lru") || lower.includes("thrashing") || lower.includes("belady")) {
            return {
                coreSummary: "When a page fault occurs and no free memory frame exists, the OS must select a <strong>victim frame</strong> to swap out using a <strong>Page Replacement Algorithm</strong>. The performance objective is minimizing the total page fault rate.",
                formulas: `<div class="notes-formula-box">
Page Replacement Hierarchy:
1. Optimal (OPT): Replace page that will not be used for longest future time (Benchmark).
2. LRU (Least Recently Used): Replace page not used for longest past time (Stack/Counter).
3. FIFO: Replace oldest page in memory (Subject to Belady's Anomaly).
4. Clock (Second Chance): Approximation of LRU using a reference bit.

Working Set Model for Thrashing:
WSS_i = Total pages referenced by Process P_i in most recent Δ time units.
If Σ WSS_i > Total Frame Count → Thrashing occurs!
</div>`,
                traps: [
                    "<strong>Belady's Anomaly</strong>: For FIFO, increasing the number of physical frames can counter-intuitively INCREASE the number of page faults.",
                    "Stack algorithms (like <strong>LRU</strong> and <strong>OPT</strong>) can NEVER exhibit Belady's Anomaly because the set of pages in an n-frame system is always a subset of pages in an (n+1)-frame system.",
                    "<strong>Thrashing</strong> occurs when a process does not have enough frames, causing continuous page faulting and collapsing CPU throughput toward zero."
                ],
                pyq: {
                    question: "Given reference string: 7, 0, 1, 2, 0, 3, 0, 4, 2, 3 with 3 frames, compare page faults under FIFO vs LRU.",
                    solution: "Under FIFO: 7(M), 0(M), 1(M), 2(replaces 7), 0(Hit), 3(replaces 0), 0(replaces 1), 4(replaces 2), 2(replaces 3), 3(replaces 0) → Total Faults = 9.<br>Under LRU: 7(M), 0(M), 1(M), 2(replaces 7), 0(Hit), 3(replaces 1), 0(Hit), 4(replaces 2), 2(replaces 3), 3(replaces 0) → Total Faults = 7.<br><strong>LRU yields fewer page faults (7 vs 9).</strong>"
                },
                recall: [
                    { q: "What is Belady's Anomaly?", a: "Belady's Anomaly is the counter-intuitive phenomenon in FIFO page replacement where allocating more frames causes more page faults for certain reference strings." },
                    { q: "How can an operating system eliminate thrashing?", a: "By using local page replacement algorithms, implementing the Working Set Model, or suspending/swapping out lower-priority processes to free memory for remaining active working sets." }
                ]
            };
        }

        // 6. Generic / Any Subject Academic Knowledge Generator
        return {
            coreSummary: `<strong>${title}</strong> is a high-yield topic within <em>${subject || examName}</em>. In competitive and university examinations, mastery of this topic requires understanding the underlying theoretical definitions, standard classification criteria, and computational steps.`,
            formulas: `<div class="notes-formula-box">
Key Academic Equations & Relations for ${title}:
1. Invariant Check: Verify initial and terminal states.
2. Complexity: Evaluate Time Complexity O(f(n)) and Space Complexity O(g(n)).
3. Constraint Check: Ensure boundary limits (0, 1, N) are strictly maintained.
</div>
<ul class="notes-bullet-list">
    <li><strong>Core Principle</strong>: Master the first-order definitions and operational laws before evaluating multi-step problems.</li>
    <li><strong>Standard Taxonomy</strong>: Differentiate between deterministic vs non-deterministic algorithms, preemptive vs non-preemptive states, or static vs dynamic behaviors.</li>
    <li><strong>System Tradeoffs</strong>: Recognize typical engineering tradeoffs (time vs space, throughput vs latency, precision vs speed).</li>
</ul>`,
            traps: [
                "<strong>Common Examination Trap</strong>: Forgetting boundary conditions (e.g. empty buffers, zero arrival times, or single-element inputs).",
                "Assuming average-case performance applies in worst-case corner conditions without verifying invariants.",
                "Confusing theoretical upper bounds (Big-O) with strict tight bounds (Theta)."
            ],
            pyq: {
                question: `Explain the primary operational mechanism of ${title} and analyze its time/space complexity under standard exam conditions.`,
                solution: `1. Formulate the core governing equation or invariant.<br>2. Execute the step-by-step state transition table.<br>3. Apply boundary conditions to establish convergence and correctness.<br>4. Conclude with optimal algorithmic bounds.`
            },
            recall: [
                { q: `What is the primary governing principle of ${title}?`, a: `It establishes the formal relationship between input constraints and output performance metrics, guaranteeing consistency and correctness.` },
                { q: `What is the most frequent exam misconception related to ${title}?`, a: `Assuming that average-case behavior holds under adversarial or zero-boundary conditions.` }
            ]
        };
    }

    /* ── Wire Study Notes Modal Controls ── */
    function initStudyNotesModalControls() {
        const modal = $("modal-study-notes");
        const btnClose = $("btn-close-notes");
        const btnCopy = $("btn-copy-notes");
        const btnPrint = $("btn-print-notes");
        const btnAskAi = $("btn-notes-ask-ai");
        const btnToggleComplete = $("btn-notes-toggle-complete");

        if (btnClose) btnClose.addEventListener("click", closeStudyNotesModal);

        // Click outside modal container to close
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) closeStudyNotesModal();
            });
        }

        // Close on Escape key
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal && modal.style.display === "flex") {
                closeStudyNotesModal();
            }
        });

        // Copy notes
        if (btnCopy) {
            btnCopy.addEventListener("click", () => {
                const title = $("notes-modal-title")?.innerText || "Study Note";
                const body = $("notes-modal-content")?.innerText || "";
                const fullText = `# ${title}\n\n${body}`;

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(fullText).then(() => {
                        showToast("Notes copied to clipboard!", "success");
                        const copyText = $("btn-copy-notes-text");
                        if (copyText) {
                            copyText.innerText = "Copied!";
                            setTimeout(() => copyText.innerText = "Copy", 2000);
                        }
                    }).catch(() => showToast("Could not copy to clipboard.", "warning"));
                } else {
                    showToast("Clipboard not accessible.", "warning");
                }
            });
        }

        // Print notes
        if (btnPrint) {
            btnPrint.addEventListener("click", () => {
                window.print();
            });
        }

        // Ask AI about this note
        if (btnAskAi) {
            btnAskAi.addEventListener("click", () => {
                if (!currentActiveNoteTopic) return;
                const topic = currentActiveNoteTopic.title;
                closeStudyNotesModal();
                showPanel("page-doubt");

                const doubtInput = $("doubt-input");
                if (doubtInput) {
                    doubtInput.value = `Explain the core concepts, high-yield exam patterns, and numerical formulas for: "${topic}" step-by-step.`;
                    doubtInput.focus();
                }

                // Automatically trigger the solution!
                const submitBtn = $("submit-doubt-btn");
                if (submitBtn) {
                    setTimeout(() => submitBtn.click(), 250);
                }
            });
        }

        // Mark as completed from modal
        if (btnToggleComplete) {
            btnToggleComplete.addEventListener("click", () => {
                if (!currentActiveNoteTopic) return;
                const topicCard = findTopicCardByTitle(currentActiveNoteTopic.title);
                if (topicCard) {
                    const cb = topicCard.querySelector("input[type='checkbox']");
                    if (cb) {
                        cb.checked = !cb.checked;
                        window.toggleRoadmapTopic(cb);
                        updateNotesModalCompletionButton();
                        showToast(cb.checked ? "Topic marked completed! 🎉" : "Topic marked incomplete.", "info");
                    }
                } else {
                    showToast("Toggled topic completion.", "info");
                }
            });
        }
    }


    window.adjustRoadmapTimeline = function(hours) {
        if (!selectedExam) return;
        selectedExam.duration = hours;
        showToast(`Roadmap re-calculated for ${hours < 24 ? hours + ' hours' : Math.round(hours/24) + ' days'}!`, "success");

        if ($("active-exam-duration")) {
            $("active-exam-duration").innerText = `${hours}h Study Plan`;
        }

        let strategy = null;
        try {
            strategy = typeof selectedExam.strategy === "string" ? JSON.parse(selectedExam.strategy) : selectedExam.strategy;
        } catch {}

        renderStrategyFlowchart(strategy);
    };

    function updateRoadmapProgress() {
        const container = $("tree-flowchart-container");
        if (!container || !currentRoadmapModel) return;

        const allCbs = Array.from(container.querySelectorAll(".sr-topics-grid input[type='checkbox']"));
        const total = allCbs.length;
        const checked = allCbs.filter(cb => cb.checked).length;
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

        // Update overall progress bar & texts
        const fill = $("sr-overall-progress-fill");
        const metaText = $("sr-overall-topics-text");
        const pctText = $("sr-overall-pct-text");

        if (fill) fill.style.width = `${pct}%`;
        if (metaText) metaText.innerText = `${checked} / ${total} topics completed`;
        if (pctText) pctText.innerText = `${pct}%`;

        // Backwards compatibility for dashboard metrics
        if ($("tree-overall-progress-bar")) $("tree-overall-progress-bar").style.width = `${pct}%`;
        if ($("tree-overall-progress-text")) $("tree-overall-progress-text").innerText = `${pct}% completed`;
        if ($("metric-roadmap-pct")) $("metric-roadmap-pct").innerText = `${pct}%`;

        // Update Subject progress bars
        currentRoadmapModel.subjects.forEach(sub => {
            const subCbs = Array.from(container.querySelectorAll(`#accordion-${sub.id} .sr-topics-grid input[type='checkbox']`));
            const subTotal = subCbs.length;
            const subChecked = subCbs.filter(cb => cb.checked).length;
            const subPct = subTotal > 0 ? Math.round((subChecked / subTotal) * 100) : 0;

            const subFill = $(`sr-sub-fill-${sub.id}`);
            const subPctLabel = $(`sr-sub-pct-${sub.id}`);

            if (subFill) subFill.style.width = `${subPct}%`;
            if (subPctLabel) subPctLabel.innerText = `${subPct}% (${subChecked}/${subTotal} topics)`;
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

    /* ══════════════════════════════════════════════════════════════════
       PRE-LOGIN INTERACTIVE LANDING EXPERIENCE
       ══════════════════════════════════════════════════════════════════ */

    function showLanding() {
        if ($("landing-section")) $("landing-section").style.display = "block";
        if ($("auth-section")) $("auth-section").style.display = "none";
        if ($("dashboard-section")) $("dashboard-section").style.display = "none";
        setTimeout(initLandingGraph, 30);
    }

    function showAuth() {
        if ($("landing-section")) $("landing-section").style.display = "none";
        if ($("auth-section")) $("auth-section").style.display = "flex";
        if ($("dashboard-section")) $("dashboard-section").style.display = "none";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function initLandingSection() {
        // Navigation buttons
        const btnNavSignIn = $("btn-landing-signin");
        const btnHeroSignIn = $("btn-hero-signin");
        const btnCtaRegister = $("btn-cta-register");
        const btnBackLanding = $("btn-back-to-landing");

        [btnNavSignIn, btnHeroSignIn, btnCtaRegister].forEach(b => {
            if (b) b.addEventListener("click", showAuth);
        });

        if (btnBackLanding) {
            btnBackLanding.addEventListener("click", showLanding);
        }

        // Guest Space launches directly into dashboard
        const handleGuestLaunch = async (btn) => {
            if (!btn) return;
            const origText = btn.innerHTML;
            btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;margin-right:6px;display:inline-block;vertical-align:middle;"></span> Launching...`;
            btn.disabled = true;

            const res = await window.apiGateway.guestLogin();
            btn.innerHTML = origText;
            btn.disabled = false;

            if (res.success) {
                currentUser = res.data.user;
                showToast("Welcome to PrepOS, Scholar!", "success");
                enterDashboard();
            } else {
                showToast(res.message || "Failed to launch guest session.", "danger");
            }
        };

        const btnNavGuest = $("btn-landing-guest");
        const btnHeroGuest = $("btn-hero-guest");
        const btnCtaGuest = $("btn-cta-guest");

        if (btnNavGuest) btnNavGuest.addEventListener("click", () => handleGuestLaunch(btnNavGuest));
        if (btnHeroGuest) btnHeroGuest.addEventListener("click", () => handleGuestLaunch(btnHeroGuest));
        if (btnCtaGuest) btnCtaGuest.addEventListener("click", () => handleGuestLaunch(btnCtaGuest));

        // Playground Tabs
        const playTabs = document.querySelectorAll(".play-tab");
        playTabs.forEach(tabBtn => {
            tabBtn.addEventListener("click", () => {
                const targetTab = tabBtn.dataset.tab;
                playTabs.forEach(t => t.classList.remove("active"));
                tabBtn.classList.add("active");

                document.querySelectorAll(".playground-panel").forEach(p => {
                    p.style.display = "none";
                    p.classList.remove("active");
                });

                const panel = $(`landing-panel-${targetTab}`);
                if (panel) {
                    panel.style.display = "block";
                    panel.classList.add("active");
                }

                if (targetTab === "graph") {
                    setTimeout(initLandingGraph, 30);
                }
            });
        });

        // BKT Probability Simulator
        const slider = $("landing-accuracy-slider");
        if (slider) {
            slider.addEventListener("input", (e) => {
                const val = parseInt(e.target.value, 10);
                const displayVal = $("landing-slider-val");
                const calcProb = $("landing-bkt-calc-prob");
                const predScore = $("landing-bkt-pred-score");
                const riskBadge = $("landing-bkt-risk-badge");

                if (displayVal) displayVal.innerText = `${val}%`;

                const prob = (0.22 + (val / 100) * 0.74).toFixed(3);
                const score = Math.round(val * 0.85 + 10);

                if (calcProb) {
                    calcProb.innerText = `${prob} (${val >= 70 ? 'High Confidence' : val >= 45 ? 'Developing' : 'Critical Need'})`;
                }
                if (predScore) {
                    predScore.innerText = `${score}%`;
                }
                if (riskBadge) {
                    if (val >= 70) {
                        riskBadge.className = "risk-pill low";
                        riskBadge.innerText = "Low Blindspot Risk";
                    } else if (val >= 45) {
                        riskBadge.className = "risk-pill moderate";
                        riskBadge.innerText = "Moderate Risk — Review Prereqs";
                    } else {
                        riskBadge.className = "risk-pill high";
                        riskBadge.innerText = "High Risk — Critical Prereq Breach";
                    }
                }
            });
        }

        // Adaptive IRT Quiz Demo
        const demoOpts = document.querySelectorAll(".landing-demo-opt");
        const fbBox = $("landing-quiz-feedback");
        demoOpts.forEach(opt => {
            opt.addEventListener("click", () => {
                const optIndex = parseInt(opt.dataset.opt, 10);
                demoOpts.forEach(o => {
                    o.classList.remove("correct", "incorrect");
                });

                if (optIndex === 1) {
                    opt.classList.add("correct");
                    if (fbBox) {
                        fbBox.style.display = "block";
                        fbBox.className = "quiz-feedback-box correct";
                        fbBox.innerHTML = `<strong>✓ Concept Mastered:</strong> Exactly right! The safety algorithm guarantees that for every process $P_i$, its Need can be satisfied by current Work (Available + released allocations). Your knowledge state in <em>Banker's Algorithm</em> scaled to <strong>88%</strong>.`;
                    }
                } else {
                    opt.classList.add("incorrect");
                    const correctOpt = document.querySelector('.landing-demo-opt[data-opt="1"]');
                    if (correctOpt) correctOpt.classList.add("correct");
                    if (fbBox) {
                        fbBox.style.display = "block";
                        fbBox.className = "quiz-feedback-box incorrect";
                        fbBox.innerHTML = `<strong>✗ Prerequisite Gap Detected:</strong> Option B is the correct safety condition. The system must verify that for each sequence step, $\\text{Need} \\le \\text{Work}$. Knowledge state adjusted: DKT recommends practicing foundational <em>Resource Allocation Graphs</em> first.`;
                    }
                }
            });
        });

        // Spark AI Live Tutor Streaming Simulation
        const tutorChips = document.querySelectorAll(".prompt-chip-btn");
        const tutorOutput = $("landing-tutor-output");

        const tutorExplanations = {
            safe_state: "In Dijkstra's Banker's Algorithm, a state is **Safe** if there exists at least one execution sequence \\langle P_1, P_2, \\dots, P_n \\rangle such that every process can obtain its maximum declared resources, finish execution, and release held resources without inducing a circular deadlock condition. A safe state is mathematically guaranteed immune to deadlock under all future worst-case requests.",
            deadlock_analogy: "Imagine a 4-way intersection where four vehicles arrive simultaneously from North, South, East, and West. Each moves forward and signals a left turn. North blocks West, West blocks South, South blocks East, and East blocks North. Nobody can advance because each occupies space needed by another (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait). That is the textbook definition of Deadlock!"
        };

        let currentTypingTimer = null;
        tutorChips.forEach(chip => {
            chip.addEventListener("click", () => {
                const queryKey = chip.dataset.query;
                const text = tutorExplanations[queryKey] || "Analyzing conceptual derivation...";
                if (currentTypingTimer) clearInterval(currentTypingTimer);

                if (tutorOutput) {
                    tutorOutput.innerHTML = `<span style="font-weight:700;color:var(--text-sparkle);">PrepOS AI Tutor: </span><span id="landing-typing-text" class="typing-cursor"></span>`;
                    const span = $("landing-typing-text");
                    let charIdx = 0;
                    currentTypingTimer = setInterval(() => {
                        span.innerText += text[charIdx];
                        charIdx++;
                        if (charIdx >= text.length) {
                            clearInterval(currentTypingTimer);
                            span.classList.remove("typing-cursor");
                        }
                    }, 14);
                }
            });
        });
    }

    let landingCanvasRunning = false;
    function initLandingGraph() {
        const canvas = $("landing-graph-canvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const parent = canvas.parentElement;

        const dpr = window.devicePixelRatio || 1;
        const width = parent.clientWidth || 800;
        const height = parent.clientHeight || 360;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.resetTransform?.();
        ctx.scale(dpr, dpr);

        const nodes = [
            { id: "1", name: "Operating Systems", x: width * 0.16, y: height * 0.5, r: 24, mastery: 85, color: "#10B981" },
            { id: "2", name: "Process Management", x: width * 0.38, y: height * 0.28, r: 24, mastery: 72, color: "#F59E0B" },
            { id: "3", name: "CPU Scheduling", x: width * 0.62, y: height * 0.32, r: 24, mastery: 80, color: "#10B981" },
            { id: "4", name: "Deadlocks", x: width * 0.42, y: height * 0.72, r: 24, mastery: 35, color: "#F43F5E" },
            { id: "5", name: "Banker's Algorithm", x: width * 0.74, y: height * 0.70, r: 24, mastery: 40, color: "#F43F5E" },
            { id: "6", name: "Memory Paging", x: width * 0.86, y: height * 0.44, r: 22, mastery: 75, color: "#10B981" }
        ];

        const links = [
            { s: nodes[0], t: nodes[1] },
            { s: nodes[1], t: nodes[2] },
            { s: nodes[1], t: nodes[3] },
            { s: nodes[3], t: nodes[4] },
            { s: nodes[0], t: nodes[5] }
        ];

        let draggedNode = null;

        canvas.onmousedown = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            draggedNode = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < n.r + 6);
        };
        window.addEventListener("mousemove", (e) => {
            if (!draggedNode) return;
            const rect = canvas.getBoundingClientRect();
            draggedNode.x = Math.max(30, Math.min(width - 30, e.clientX - rect.left));
            draggedNode.y = Math.max(30, Math.min(height - 30, e.clientY - rect.top));
        });
        window.addEventListener("mouseup", () => { draggedNode = null; });

        function renderLandingCanvas() {
            ctx.clearRect(0, 0, width, height);

            // Subtle nebula
            const nebula = ctx.createRadialGradient(width * 0.5, height * 0.5, 10, width * 0.5, height * 0.5, 300);
            nebula.addColorStop(0, "rgba(139, 92, 246, 0.14)");
            nebula.addColorStop(1, "transparent");
            ctx.fillStyle = nebula;
            ctx.fillRect(0, 0, width, height);

            // Links
            links.forEach(l => {
                ctx.beginPath();
                ctx.moveTo(l.s.x, l.s.y);
                ctx.lineTo(l.t.x, l.t.y);
                ctx.strokeStyle = "rgba(139, 92, 246, 0.35)";
                ctx.lineWidth = 1.8;
                ctx.stroke();
            });

            // Nodes
            nodes.forEach(n => {
                // Halo
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
                ctx.fillStyle = n.mastery < 45 ? "rgba(244, 63, 94, 0.28)" : "rgba(16, 185, 129, 0.22)";
                ctx.fill();

                // 3D sphere body
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                const g = ctx.createRadialGradient(n.x - 6, n.y - 6, 2, n.x, n.y, n.r);
                g.addColorStop(0, "#1E2644");
                g.addColorStop(1, "#0A0D1A");
                ctx.fillStyle = g;
                ctx.fill();

                ctx.strokeStyle = n.color;
                ctx.lineWidth = 2.4;
                ctx.stroke();

                // Percentage
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 11px 'JetBrains Mono', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(`${n.mastery}%`, n.x, n.y);

                // Label
                ctx.fillStyle = "#E2E8F0";
                ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText(n.name, n.x, n.y + n.r + 14);
            });

            if ($("landing-section") && $("landing-section").style.display !== "none") {
                requestAnimationFrame(renderLandingCanvas);
            }
        }

        renderLandingCanvas();
    }


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
        initLandingSection();
        initAuth();
        initTabNavigation();
        initDoubtSolver();
        checkAuthSession();
    });

})();
