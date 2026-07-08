import { state } from './state.js';
import { $, esc, parseMd, arrEq, showToast } from './utils.js';
import { fetchExerciseData } from './api.js';
import { renderContentBlock, renderAllMath, renderMermaidBlocks, renderCharts } from './renderer.js';
import { showView } from './ui.js';

/* ==================== OPEN EXERCISE ==================== */
export async function openExercise(ex) {
    try {
        const data = await fetchExerciseData(ex.moduleFolder, ex.file);
        state.currentExercise = data;
        state.currentViewData = { type: 'exercise', data: ex };
        
        const exKey = ex.moduleFolder + '/' + ex.file;
        const prog = state.progress && state.progress[exKey];
        state.userAnswers = prog && prog.answers ? JSON.parse(JSON.stringify(prog.answers)) : {};
        
        let firstUnanswered = 0;
        const questions = data.questions || [];
        if (prog && prog.answers) {
            for (let i = 0; i < questions.length; i++) {
                const qId = questions[i].id != null ? questions[i].id : i + 1;
                if (!state.userAnswers[qId]) {
                    firstUnanswered = i;
                    break;
                }
            }
        }
        
        state.currentQIndex = prog && prog.status !== 'incomplete' ? 0 : firstUnanswered;
        renderExercise(data);
        showView('exercise');
    } catch (e) {
        console.error(e);
        showToast('Impossible de charger l\'exercice', 'error');
    }
}

/* ==================== RENDER EXERCISE ==================== */
function renderExercise(data) {
    const body = $('exercise-body');
    body.innerHTML = '';
    body.className = 'exercise-body';

    // Topbar title
    $('topbar-title').textContent = data.title || 'Exercice';

    const hasEnonce = (data.enonce && data.enonce.length > 0) || (data.cases && data.cases.length > 0);
    const questions = data.questions || [];

    // Mobile tabs visibility
    const mobileTabs = $('mobile-tabs');
    if (hasEnonce) {
        mobileTabs.classList.add('visible');
        body.classList.add('has-split');
        $('tab-questions').classList.add('active');
        $('tab-enonce').classList.remove('active');
        body.classList.remove('show-enonce');
    } else {
        mobileTabs.classList.remove('visible');
    }

    if (hasEnonce) {
        // ---- SPLIT LAYOUT ----
        const left = document.createElement('div');
        left.className = 'split-left';
        left.id = 'split-left';
        left.style.width = '50%';

        if (data.enonce) {
            data.enonce.forEach((block) => left.appendChild(renderContentBlock(block)));
        }
        // Highly distinct cold colors
        const COLD_COLORS = [
            '#2563eb', // Deep Blue
            '#06b6d4', // Bright Cyan
            '#10b981', // Emerald Green
            '#8b5cf6', // Vivid Violet
            '#64748b'  // Slate Gray
        ];
        let availableColors = [...COLD_COLORS].sort(() => Math.random() - 0.5);

        if (data.cases) {
            data.cases.forEach((caseData, idx) => {
                if (!caseData.color) {
                    caseData.color = availableColors.pop() || COLD_COLORS[idx % COLD_COLORS.length];
                }
                
                const parts = (caseData.title || caseData.id).split(':');
                const shortTitle = parts[0].trim();
                const actualTitle = parts.slice(1).join(':').trim();
                
                const caseContainer = document.createElement('div');
                caseContainer.className = 'case-container';
                
                const header = document.createElement('div');
                header.className = 'case-header-static';
                
                let html = `<span class="q-case-badge enonce-badge" style="color: ${caseData.color}; background: ${caseData.color}26; border: 1px solid ${caseData.color}4d;">${esc(shortTitle)}</span>`;
                if (actualTitle) {
                    html += `<span class="q-case-badge enonce-badge" style="color: var(--text-secondary); background: var(--bg-elevated); border: 1px solid var(--border); text-transform: none; letter-spacing: normal;">${esc(actualTitle)}</span>`;
                }
                header.innerHTML = html;
                
                caseContainer.appendChild(header);
                
                (caseData.content || []).forEach(b => caseContainer.appendChild(renderContentBlock(b)));
                
                left.appendChild(caseContainer);
            });
        }
        body.appendChild(left);

        // Divider
        const divider = document.createElement('div');
        divider.className = 'split-divider';
        divider.id = 'split-divider';
        divider.innerHTML = '<div class="grip"></div>';
        body.appendChild(divider);

        // Right panel
        const right = createQuestionsPanel(questions);
        right.classList.add('split-right');
        body.appendChild(right);

        // Init split-pane drag
        initSplitDrag(body, left, divider);
    } else {
        // ---- FULL LAYOUT (no énoncé) ----
        const panel = createQuestionsPanel(questions);
        panel.classList.add('full-questions');
        body.appendChild(panel);
    }

    renderAllMath(body);
    renderMermaidBlocks(body);
    renderCharts(body);

    showQuestion(0);
}

/* ==================== QUESTIONS PANEL ==================== */
function createQuestionsPanel(questions) {
    const panel = document.createElement('div');
    panel.id = 'questions-panel';

    const dots = document.createElement('div');
    dots.className = 'question-dots';
    dots.id = 'question-dots';
    questions.forEach((q, i) => {
        const dot = document.createElement('button');
        dot.className = 'q-dot';
        dot.dataset.index = i;
        dot.title = 'Question ' + (q.id != null ? q.id : i + 1);
        if (q.caseId && state.currentExercise && state.currentExercise.cases) {
            const cObj = state.currentExercise.cases.find(c => c.id === q.caseId);
            if (cObj && cObj.color) {
                dot.style.setProperty('--case-color', cObj.color);
                dot.style.setProperty('--case-color-alpha', cObj.color + '40'); // 25% opacity for glow
            }
        }
        dot.addEventListener('click', () => showQuestion(i));
        dots.appendChild(dot);
    });
    panel.appendChild(dots);

    const stage = document.createElement('div');
    stage.className = 'question-stage';
    stage.id = 'question-stage';
    panel.appendChild(stage);

    const nav = document.createElement('div');
    nav.className = 'question-nav';
    nav.innerHTML = `
        <button class="btn btn-ghost" id="btn-prev">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
            Précédent
        </button>
        <span class="question-counter" id="question-counter">1 / ${questions.length}</span>
        <button class="btn btn-ghost" id="btn-next">
            Suivant
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
    `;
    panel.appendChild(nav);



    setTimeout(() => {
        const prevBtn = $('btn-prev');
        const nextBtn = $('btn-next');
        if (prevBtn) prevBtn.addEventListener('click', () => showQuestion(state.currentQIndex - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => {
            if (state.currentQIndex === state.currentExercise.questions.length - 1) {
                handleSubmit();
            } else {
                showQuestion(state.currentQIndex + 1);
            }
        });
    }, 0);

    return panel;
}

/* ==================== SHOW QUESTION ==================== */
function showQuestion(index, direction) {
    const questions = state.currentExercise.questions;
    if (index < 0 || index >= questions.length) return;

    const prevIndex = state.currentQIndex;
    state.currentQIndex = index;
    const q = questions[index];

    const stage = $('question-stage');
    if (!stage) return;

    if (direction === undefined) {
        direction = index > prevIndex ? 'right' : 'left';
    }

    stage.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = index !== prevIndex ? 'slide-' + direction : '';

    const isQCM = q.type === 'QCM';
    const inputType = isQCM ? 'checkbox' : 'radio';
    const indicatorClass = isQCM ? 'option-checkbox' : 'option-radio';
    const qId = q.id != null ? q.id : index + 1;
    const selectedLabels = state.userAnswers[qId] || [];

    let hintHtml = '';
    if (q.hint) {
        hintHtml = `
            <button class="hint-toggle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                Besoin d'un indice ?
            </button>
            <div class="hint-box">${parseMd(q.hint)}</div>
        `;
    }

    let badgeHtml = '';
    if (q.caseId && state.currentExercise.cases) {
        const caseObj = state.currentExercise.cases.find(c => c.id === q.caseId);
        if (caseObj) {
            const shortTitle = (caseObj.title || caseObj.id).split(':')[0].trim();
            const color = caseObj.color || '#6366f1';
            badgeHtml = `<span class="q-case-badge" style="color: ${color}; background: ${color}26; border-color: ${color}4d;">${esc(shortTitle)}</span>`;
        }
    }

    let html = `
        <div class="question-top">
            ${badgeHtml}<span class="question-badge ${isQCM ? 'qcm' : 'qcu'}">Q${qId} - ${isQCM ? 'QCM' : 'QCU'}</span>
        </div>
        <div class="question-text">${parseMd(q.text || '')}</div>
        ${hintHtml}
        <div class="options-list">
    `;

    (q.options || []).forEach((opt) => {
        const sel = selectedLabels.includes(opt.label) ? ' selected' : '';
        html += `
            <label class="option-item${sel}" data-qid="${qId}" data-label="${opt.label}" data-type="${inputType}">
                <input type="${inputType}" name="q-${qId}" value="${opt.label}" ${sel ? 'checked' : ''}>
                <span class="${indicatorClass}"></span>
                <span class="option-label-letter">${esc(opt.label)}.</span>
                <span class="option-text">${parseMd(opt.text || '')}</span>
            </label>
        `;
    });
    html += '</div>';

    wrapper.innerHTML = html;
    stage.appendChild(wrapper);

    wrapper.querySelectorAll('.option-item').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            handleOptionClick(el, qId, isQCM);
        });
    });

    const hintToggle = wrapper.querySelector('.hint-toggle');
    const hintBox = wrapper.querySelector('.hint-box');
    if (hintToggle && hintBox) {
        hintToggle.addEventListener('click', () => {
            hintBox.classList.toggle('visible');
        });
    }

    renderAllMath(stage);
    updateDots();

    const counter = $('question-counter');
    if (counter) counter.textContent = (index + 1) + ' / ' + questions.length;

    const prevBtn = $('btn-prev');
    const nextBtn = $('btn-next');
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) {
        if (index === questions.length - 1) {
            nextBtn.innerHTML = `Soumettre <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>`;
            nextBtn.classList.remove('btn-ghost');
            nextBtn.classList.add('btn-primary');
        } else {
            nextBtn.innerHTML = `Suivant <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`;
            nextBtn.classList.remove('btn-primary');
            nextBtn.classList.add('btn-ghost');
            nextBtn.disabled = false;
        }
    }

    updateProgress();
}

function updateDots() {
    const dots = document.querySelectorAll('.q-dot');
    const questions = state.currentExercise.questions;
    dots.forEach((dot, i) => {
        const q = questions[i];
        const qId = q.id != null ? q.id : i + 1;
        const isAnswered = !!state.userAnswers[qId];
        dot.classList.toggle('current', i === state.currentQIndex);
        dot.classList.toggle('answered', isAnswered);
        dot.classList.toggle('skipped', !isAnswered && i < state.currentQIndex);
    });
}

function handleOptionClick(el, qId, isQCM) {
    const label = el.dataset.label;

    if (isQCM) {
        el.classList.toggle('selected');
        el.querySelector('input').checked = el.classList.contains('selected');
        const selected = [];
        el.closest('.options-list').querySelectorAll('.option-item.selected').forEach((s) => {
            selected.push(s.dataset.label);
        });
        if (selected.length > 0) {
            state.userAnswers[qId] = selected;
        } else {
            delete state.userAnswers[qId];
        }
    } else {
        el.closest('.options-list').querySelectorAll('.option-item').forEach((s) => {
            s.classList.remove('selected');
            s.querySelector('input').checked = false;
        });
        el.classList.add('selected');
        el.querySelector('input').checked = true;
        state.userAnswers[qId] = [label];
    }

    updateDots();
    updateProgress();
    
    // Save partial progress
    const ex = state.currentViewData.data;
    const exKey = ex.moduleFolder + '/' + ex.file;
    if (!state.progress) state.progress = {};
    state.progress[exKey] = {
        status: 'incomplete',
        answers: JSON.parse(JSON.stringify(state.userAnswers))
    };
    import('./api.js').then(api => api.saveProgress(state.progress)).catch(console.error);
}

function updateProgress() {
    if (!state.currentExercise) return;
    const total = state.currentExercise.questions.length;
    const answered = Object.keys(state.userAnswers).length;
    $('progress-text').textContent = answered + ' / ' + total + ' répondu(s)';

    const nextBtn = $('btn-next');
    if (nextBtn && state.currentQIndex === total - 1) {
        nextBtn.disabled = answered === 0;
    }
}

function handleSubmit() {
    if (!state.currentExercise) return;
    const questions = state.currentExercise.questions;
    let correct = 0;
    questions.forEach((q) => {
        const qId = q.id != null ? q.id : questions.indexOf(q) + 1;
        const userAns = (state.userAnswers[qId] || []).slice().sort();
        const correctAns = (q.answer || []).slice().sort();
        if (arrEq(userAns, correctAns)) correct++;
    });
    
    const pct = questions.length > 0 ? (correct / questions.length) : 0;
    const status = pct >= 0.7 ? 'passed' : 'failed';
    
    const ex = state.currentViewData.data;
    const exKey = ex.moduleFolder + '/' + ex.file;
    if (!state.progress) state.progress = {};
    state.progress[exKey] = {
        status: status,
        answers: JSON.parse(JSON.stringify(state.userAnswers))
    };
    import('./api.js').then(api => api.saveProgress(state.progress)).catch(console.error);

    renderResults(correct, questions.length, questions);
    showView('results');
}

function renderResults(score, total, questions) {
    const container = $('results-content');
    container.innerHTML = '';

    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const tier = pct >= 70 ? 'good' : pct >= 40 ? 'medium' : 'bad';
    const labels = { good: 'Excellent travail !', medium: 'Pas mal, continuez !', bad: 'À retravailler' };
    const circumference = 2 * Math.PI * 62;
    const offset = circumference - (pct / 100) * circumference;

    let html = `
        <div class="results-header">
            <div class="score-ring">
                <svg viewBox="0 0 140 140">
                    <circle class="score-ring-bg" cx="70" cy="70" r="62"/>
                    <circle class="score-ring-fill ${tier}" cx="70" cy="70" r="62"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"
                        data-target="${offset}"/>
                </svg>
                <div class="score-value">
                    <span class="score-number ${tier}">${score}</span>
                    <span class="score-total">/ ${total}</span>
                </div>
            </div>
            <div class="score-label">${labels[tier]}</div>
            <div class="score-percent">${pct}% de bonnes réponses</div>
            <div class="results-actions">
                <button class="btn btn-primary" id="btn-retry">🔄 Réessayer</button>
                <button class="btn btn-outline" id="btn-home-results">🏠 Accueil</button>
            </div>
        </div>
        <hr class="results-divider">
        <div class="results-review-title">📝 Correction détaillée</div>
    `;
    container.innerHTML = html;

    questions.forEach((q, idx) => {
        const qId = q.id != null ? q.id : idx + 1;
        const userAns = state.userAnswers[qId] || [];
        const correctAns = q.answer || [];
        const isCorrect = arrEq(userAns.slice().sort(), correctAns.slice().sort());
        const isUnanswered = userAns.length === 0;
        const isQCM = q.type === 'QCM';
        const indicatorClass = isQCM ? 'option-checkbox' : 'option-radio';

        let status, badgeClass, badgeText;
        if (isUnanswered) { status = 'result-unanswered'; badgeClass = 'unanswered'; badgeText = 'Non répondu'; }
        else if (isCorrect) { status = 'result-correct'; badgeClass = 'correct'; badgeText = '✓ Correct'; }
        else { status = 'result-incorrect'; badgeClass = 'incorrect'; badgeText = '✗ Incorrect'; }

        const card = document.createElement('div');
        card.className = 'result-card ' + status;

        let cardHtml = `
            <div class="question-top">
                <span class="question-badge ${isQCM ? 'qcm' : 'qcu'}">Q${qId} - ${isQCM ? 'QCM' : 'QCU'}</span>
                <span class="question-result-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="question-text">${parseMd(q.text || '')}</div>
            <div class="options-list">
        `;

        (q.options || []).forEach((opt) => {
            const wasSelected = userAns.includes(opt.label);
            const isAnswer = correctAns.includes(opt.label);
            let cls = 'option-item result-state';
            if (wasSelected && isAnswer) cls += ' correct selected';
            else if (wasSelected && !isAnswer) cls += ' incorrect selected';
            else if (!wasSelected && isAnswer) cls += ' was-correct';

            let icon = '';
            if (wasSelected && isAnswer) icon = '<span class="option-result-icon">✓</span>';
            else if (wasSelected && !isAnswer) icon = '<span class="option-result-icon">✗</span>';
            else if (!wasSelected && isAnswer) icon = '<span class="option-result-icon">◎</span>';

            cardHtml += `
                <div class="${cls}">
                    <span class="${indicatorClass}"></span>
                    <span class="option-label-letter">${esc(opt.label)}.</span>
                    <span class="option-text">${parseMd(opt.text || '')}</span>
                    ${icon}
                </div>
            `;
        });
        cardHtml += '</div>';
        card.innerHTML = cardHtml;
        container.appendChild(card);
    });

    renderAllMath(container);

    setTimeout(() => {
        const fill = container.querySelector('.score-ring-fill');
        if (fill) fill.style.strokeDashoffset = fill.dataset.target;
    }, 80);

    setTimeout(() => {
        const retry = $('btn-retry');
        const home = $('btn-home-results');
        if (retry) retry.addEventListener('click', () => {
            state.userAnswers = {};
            state.currentQIndex = 0;
            renderExercise(state.currentExercise);
            showView('exercise');
        });
        if (home) home.addEventListener('click', () => showView('home'));
    }, 0);
}

function initSplitDrag(container, left, divider) {
    let dragging = false;

    const onDown = (e) => {
        dragging = true;
        divider.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    };

    const onMove = (e) => {
        if (!dragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const rect = container.getBoundingClientRect();
        const pct = ((clientX - rect.left) / rect.width) * 100;
        if (pct > 20 && pct < 75) {
            left.style.width = pct + '%';
        }
    };

    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        divider.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    divider.addEventListener('mousedown', onDown);
    divider.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
}

/* ==================== KEYBOARD NAVIGATION ==================== */
document.addEventListener('keydown', (e) => {
    const view = $('view-exercise');
    if (!view || view.classList.contains('hidden')) return;
    
    const tagName = e.target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') return;
    
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevBtn = $('btn-prev');
        if (prevBtn && !prevBtn.disabled) prevBtn.click();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextBtn = $('btn-next');
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
    }
});
