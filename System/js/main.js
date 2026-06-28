import { state } from './state.js';
import { $, showToast } from './utils.js';
import { initTheme, toggleTheme, setMobileTab, showView } from './ui.js';
import { initMermaid } from './renderer.js';
import { loadExerciseList, filterExercises } from './home.js';
import { openExercise } from './exercise.js';
import { openLesson } from './lesson.js';
import { createModule, updateModule, deleteModule, fetchModuleInfo, updateModuleInfo, fetchSettings, updateSettings, fetchObjectives, updateObjectives } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMermaid();
    loadExerciseList();
    bindGlobalEvents();
    checkUpdate();
    
    // Setup Hot-Reload (SSE)
    const eventSource = new EventSource('/api/sse');
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'refresh') {
                showToast("L'IA a fait de la magie ! ✨", 'success');
                if (state.currentView === 'home') {
                    loadExerciseList();
                } else if (state.currentView === 'exercise' && state.currentViewData) {
                    openExercise(state.currentViewData.data);
                } else if (state.currentView === 'lesson' && state.currentViewData) {
                    openLesson(state.currentViewData.data);
                }
            }
        } catch (e) {
            console.error("SSE parse error", e);
        }
    };
});

function bindGlobalEvents() {
    $('btn-refresh').addEventListener('click', () => loadExerciseList(true));
    $('search-input').addEventListener('input', (e) => filterExercises(e.target.value));
    $('btn-back').addEventListener('click', () => showView('home'));
    $('btn-back-lesson').addEventListener('click', () => showView('home'));
    
    // Theme toggle (now in settings)
    const tBtn = $('theme-toggle');
    if (tBtn) tBtn.addEventListener('click', toggleTheme);
    
    // Settings Modal
    $('btn-settings')?.addEventListener('click', () => {
        $('modal-settings').classList.remove('hidden');
    });
    $('btn-close-settings-modal')?.addEventListener('click', () => {
        $('modal-settings').classList.add('hidden');
    });
    $('modal-settings')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-settings') $('modal-settings').classList.add('hidden');
    });

    // Mobile tabs
    if ($('tab-enonce')) $('tab-enonce').addEventListener('click', () => setMobileTab('left'));
    if ($('tab-questions')) $('tab-questions').addEventListener('click', () => setMobileTab('right'));

    // Modal Add Module
    const btnAddModule = $('btn-add-module');
    if (btnAddModule) {
        btnAddModule.addEventListener('click', () => {
            $('modal-add-module').classList.remove('hidden');
            $('module-name').value = '';
            $('module-icon').value = '';
            $('module-name').focus();
        });
    }

    const closeModal = () => {
        const m = $('modal-add-module');
        if (m) m.classList.add('hidden');
    };
    
    if ($('btn-close-modal')) $('btn-close-modal').addEventListener('click', closeModal);
    if ($('btn-cancel-modal')) $('btn-cancel-modal').addEventListener('click', closeModal);
    
    const modal = $('modal-add-module');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'modal-add-module') closeModal();
        });
    }

    const filterEmoji = (e) => {
        // Strip out basic alphanumeric and common punctuation characters to force emojis
        e.target.value = e.target.value.replace(/[a-zA-Z0-9\s.,;!?'"()\[\]{}-]/g, '');
    };
    if ($('module-icon')) $('module-icon').addEventListener('input', filterEmoji);
    if ($('rename-icon')) $('rename-icon').addEventListener('input', filterEmoji);

    const btnSubmit = $('btn-submit-modal');
    if (btnSubmit) {
        btnSubmit.addEventListener('click', async () => {
            const name = $('module-name').value.trim();
            const icon = $('module-icon').value.trim();
            const info = $('module-info') ? $('module-info').value.trim() : '';
            if (!name) return showToast('Le nom est requis', 'error');
            
            btnSubmit.disabled = true;
            try {
                await createModule(name, icon, info);
                closeModal();
                showToast('Module créé avec succès', 'success');
                loadExerciseList(true);
            } catch (e) {
                console.error(e);
                showToast('Erreur lors de la création', 'error');
            }
            btnSubmit.disabled = false;
        });
    }
}

async function checkUpdate(manual = false) {
    try {
        const btn = $('btn-update');
        const btnText = $('btn-update-text');
        const badge = $('settings-update-warning');
        
        if (manual && btnText) {
            btn.disabled = true;
            btnText.textContent = "Vérification...";
        }
        
        const res = await fetch('/api/update/check');
        const data = await res.json();
        
        if (!data.isRepo) {
            if (btn) btn.classList.add('hidden');
            if (badge) badge.classList.add('hidden');
            return;
        }
        
        if (btn) {
            btn.classList.remove('hidden');
            btn.disabled = false;
            
            // Remove previous event listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            const nBtn = $('btn-update');
            const nBtnText = $('btn-update-text');

            if (data.updateAvailable) {
                if (badge) badge.classList.remove('hidden');
                nBtnText.textContent = "Mettre à jour maintenant";
                nBtn.classList.remove('btn-outline', 'btn-primary');
                nBtn.classList.add('btn-warning');
                
                let isConfirming = false;
                
                nBtn.addEventListener('click', async () => {
                    if (!isConfirming) {
                        isConfirming = true;
                        nBtnText.textContent = "Confirmer ?";
                        nBtn.classList.remove('btn-warning');
                        nBtn.classList.add('btn-error');
                        return;
                    }
                    
                    // Perform update
                    nBtn.disabled = true;
                    nBtnText.textContent = "Téléchargement...";
                    try {
                        const upRes = await fetch('/api/update/apply', { method: 'POST' });
                        const upData = await upRes.json();
                        if (upData.success) {
                            nBtnText.textContent = "Redémarrage...";
                            pollServerForRestart();
                        } else {
                            showToast("Erreur: " + upData.error, 'error');
                            nBtn.disabled = false;
                            isConfirming = false;
                            nBtnText.textContent = "Mise à jour dispo";
                            nBtn.classList.remove('btn-error');
                            nBtn.classList.add('btn-warning');
                        }
                    } catch(e) {
                        showToast("Erreur réseau", 'error');
                        nBtn.disabled = false;
                    }
                });
            } else {
                if (badge) badge.classList.add('hidden');
                nBtnText.textContent = manual ? "À jour !" : "Vérifier maj";
                nBtn.classList.remove('btn-warning', 'btn-error');
                nBtn.classList.add('btn-outline');
                
                nBtn.addEventListener('click', () => {
                    checkUpdate(true);
                });
            }
        }
    } catch (e) {
        console.log("No update server available or error", e);
    }
}

function pollServerForRestart() {
    let attempts = 0;
    const interval = setInterval(async () => {
        attempts++;
        if (attempts > 30) {
            clearInterval(interval);
            showToast("Le serveur met du temps à redémarrer. Veuillez actualiser manuellement.", "warning");
            return;
        }
        try {
            const res = await fetch('/api/modules');
            if (res.ok) {
                clearInterval(interval);
                window.location.reload();
            }
        } catch(e) {
            // expected to fail while server is down
        }
    }, 1000);
}

// --- CONTEXT MENU & MODULE MANAGEMENT ---
let activeContextFolder = null;
let activeContextName = null;
let activeContextIcon = null;

document.addEventListener('moduleContextMenu', (e) => {
    const { x, y, folder, name, icon } = e.detail;
    activeContextFolder = folder;
    activeContextName = name;
    activeContextIcon = icon;
    
    const menu = $('module-context-menu');
    if (!menu) return;
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
});

// Hide context menu on click outside
document.addEventListener('click', (e) => {
    const menu = $('module-context-menu');
    if (menu && !menu.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

// Rename
const btnCtxRename = $('ctx-rename');
if (btnCtxRename) {
    btnCtxRename.addEventListener('click', () => {
        $('module-context-menu').classList.add('hidden');
        $('rename-folder').value = activeContextFolder;
        $('rename-name').value = activeContextName;
        $('rename-icon').value = activeContextIcon;
        $('modal-rename-module').classList.remove('hidden');
    });
}
$('btn-close-rename-modal')?.addEventListener('click', () => $('modal-rename-module').classList.add('hidden'));
$('btn-cancel-rename-modal')?.addEventListener('click', () => $('modal-rename-module').classList.add('hidden'));
$('modal-rename-module')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-rename-module') $('modal-rename-module').classList.add('hidden');
});
$('btn-submit-rename-modal')?.addEventListener('click', async () => {
    const folder = $('rename-folder').value;
    const name = $('rename-name').value.trim();
    const icon = $('rename-icon').value.trim();
    if (!name) return showToast('Le nom est requis', 'error');
    
    const btn = $('btn-submit-rename-modal');
    btn.disabled = true;
    try {
        await updateModule(folder, name, icon);
        $('modal-rename-module').classList.add('hidden');
        showToast('Module renommé avec succès', 'success');
        loadExerciseList(true);
    } catch (err) {
        showToast('Erreur lors du renommage', 'error');
    }
    btn.disabled = false;
});

// Delete
const btnCtxDelete = $('ctx-delete');
if (btnCtxDelete) {
    btnCtxDelete.addEventListener('click', async () => {
        $('module-context-menu').classList.add('hidden');
        if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement le module "${activeContextName}" ? Toutes les données et fichiers sources seront perdus.`)) {
            try {
                await deleteModule(activeContextFolder);
                showToast('Module supprimé', 'success');
                loadExerciseList(true);
            } catch (err) {
                showToast('Erreur lors de la suppression', 'error');
            }
        }
    });
}

// Info
const btnCtxInfo = $('ctx-info');
if (btnCtxInfo) {
    btnCtxInfo.addEventListener('click', async () => {
        $('module-context-menu').classList.add('hidden');
        $('info-folder').value = activeContextFolder;
        $('edit-info-text').value = 'Chargement...';
        $('modal-edit-info').classList.remove('hidden');
        
        try {
            const data = await fetchModuleInfo(activeContextFolder);
            $('edit-info-text').value = data.info || '';
        } catch (err) {
            $('edit-info-text').value = '';
            showToast('Erreur de lecture', 'error');
        }
    });
}
$('btn-close-info-modal')?.addEventListener('click', () => $('modal-edit-info').classList.add('hidden'));
$('btn-cancel-info-modal')?.addEventListener('click', () => $('modal-edit-info').classList.add('hidden'));
$('modal-edit-info')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-edit-info') $('modal-edit-info').classList.add('hidden');
});
$('btn-submit-info-modal')?.addEventListener('click', async () => {
    const folder = $('info-folder').value;
    const info = $('edit-info-text').value;
    const btn = $('btn-submit-info-modal');
    
    btn.disabled = true;
    try {
        await updateModuleInfo(folder, info);
        $('modal-edit-info').classList.add('hidden');
        showToast('Instructions enregistrées', 'success');
    } catch (err) {
        showToast("Erreur lors de l'enregistrement", 'error');
    }
    btn.disabled = false;
});

// --- TRANSLATION SETTINGS & LOGIC ---
const translateEnable = $('setting-translate-enable');
const translateLang = $('setting-translate-lang');
const translateBtn = $('translate-trigger-btn');
const translateTooltip = $('translate-tooltip');
const translateContent = $('translate-content');

let examTimer = null;

// Load settings
async function initSettings() {
    try {
        const settings = await fetchSettings();
        
        if (translateEnable) {
            translateEnable.checked = settings.translate_enable !== false;
            translateEnable.addEventListener('change', async (e) => {
                settings.translate_enable = e.target.checked;
                await updateSettings(settings);
            });
        }
        if (translateLang) {
            translateLang.value = settings.translate_lang || 'fr';
            translateLang.addEventListener('change', async (e) => {
                settings.translate_lang = e.target.value;
                await updateSettings(settings);
            });
        }

        const examEnable = $('setting-exam-enable');
        const examDate = $('setting-exam-date');
        
        if (examEnable) {
            examEnable.checked = settings.exam_enable === true;
            examEnable.addEventListener('change', async (e) => {
                settings.exam_enable = e.target.checked;
                await updateSettings(settings);
                updateExamReminder(settings.exam_enable, settings.exam_date);
            });
        }
        if (examDate) {
            examDate.value = settings.exam_date || '';
            examDate.addEventListener('change', async (e) => {
                settings.exam_date = e.target.value;
                await updateSettings(settings);
                updateExamReminder(settings.exam_enable, settings.exam_date);
            });
        }
        
        updateExamReminder(settings.exam_enable, settings.exam_date);

    } catch (e) {
        console.error("Failed to load settings from server, falling back to defaults", e);
    }
}

function updateExamReminder(enabled, dateStr) {
    const container = $('exam-reminder-container');
    if (!container) return;
    
    if (examTimer) clearInterval(examTimer);
    
    if (!enabled || !dateStr) {
        container.classList.add('hidden');
        return;
    }
    
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime()) || targetDate.getTime() < Date.now()) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    const render = () => {
        const now = new Date();
        const diff = targetDate.getTime() - now.getTime();
        
        if (diff <= 0) {
            container.classList.add('hidden');
            clearInterval(examTimer);
            return;
        }
        
        // Calculate months, days, hours, minutes, seconds
        // Approximate months by 30.44 days
        const msPerSec = 1000;
        const msPerMin = msPerSec * 60;
        const msPerHour = msPerMin * 60;
        const msPerDay = msPerHour * 24;
        const msPerMonth = msPerDay * 30.44;
        
        const months = Math.floor(diff / msPerMonth);
        const days = Math.floor((diff % msPerMonth) / msPerDay);
        const hours = Math.floor((diff % msPerDay) / msPerHour);
        const minutes = Math.floor((diff % msPerHour) / msPerMin);
        const seconds = Math.floor((diff % msPerMin) / msPerSec);
        
        let html = '';
        const addUnit = (val, label, isLast = false) => {
            const formatted = val < 10 ? '0' + val : val;
            html += `<div class="exam-unit"><span class="exam-val">${formatted}</span><span class="exam-label">${label}</span></div>`;
            if (!isLast) html += `<div class="exam-sep">:</div>`;
        };
        
        if (months > 0) addUnit(months, 'Mois');
        if (months > 0 || days > 0) addUnit(days, 'Jours');
        if (months > 0 || days > 0 || hours > 0) addUnit(hours, 'Heures');
        addUnit(minutes, 'Min');
        addUnit(seconds, 'Sec', true);
        
        container.innerHTML = html;
    };
    
    render();
    examTimer = setInterval(render, 1000); // update every second
}

initSettings();

// Text selection logic
let currentSelection = '';

document.addEventListener('mouseup', (e) => {
    if (!translateEnable || !translateEnable.checked) return;
    
    // Check if we are clicking inside the tooltip or translate button
    if (translateTooltip && translateTooltip.contains(e.target)) return;
    if (translateBtn && translateBtn.contains(e.target)) return;

    // Hide tooltip on new click
    if (translateTooltip && !translateTooltip.classList.contains('hidden')) {
        translateTooltip.classList.add('hidden');
    }

    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text.length > 0) {
            currentSelection = text;
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            if (translateBtn) {
                // Position above the selection
                const top = Math.max(0, rect.top + window.scrollY - 40);
                const left = rect.left + window.scrollX + (rect.width / 2) - 16;
                translateBtn.style.top = `${top}px`;
                translateBtn.style.left = `${left}px`;
                translateBtn.classList.remove('hidden');
            }
        } else {
            currentSelection = '';
            if (translateBtn) translateBtn.classList.add('hidden');
        }
    }, 10);
});

// Hide translation UI on mouse down (if not clicking on the UI itself)
document.addEventListener('mousedown', (e) => {
    if (translateBtn && translateBtn.contains(e.target)) return;
    if (translateTooltip && translateTooltip.contains(e.target)) return;
    
    if (translateBtn) translateBtn.classList.add('hidden');
});

// Handle Translate click
if (translateBtn) {
    translateBtn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent text un-selection
    });
    
    translateBtn.addEventListener('click', async () => {
        if (!currentSelection) return;
        
        translateBtn.classList.add('hidden'); // hide the small button
        
        // Show tooltip with loading state
        const targetLang = translateLang ? translateLang.value : 'fr';
        translateContent.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div>';
        
        // Position the tooltip near the selection
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            let top = rect.bottom + window.scrollY + 10;
            let left = rect.left + window.scrollX;
            
            // Adjust to keep in viewport
            if (left + 300 > window.innerWidth) left = window.innerWidth - 320;
            
            translateTooltip.style.top = `${top}px`;
            translateTooltip.style.left = `${Math.max(10, left)}px`;
        }
        
        translateTooltip.classList.remove('hidden');
        
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(currentSelection)}`;
            const res = await fetch(url);
            const data = await res.json();
            
            let translatedText = '';
            if (data && data[0]) {
                data[0].forEach(item => {
                    if (item[0]) translatedText += item[0];
                });
            }
            
            translateContent.textContent = translatedText || "Erreur de traduction";
        } catch (err) {
            console.error(err);
            translateContent.textContent = "Erreur de connexion";
        }
    });
}

// --- OBJECTIVES LOGIC ---
let objectivesData = [];

const modalObjectives = $('modal-objectives');
const btnCloseObjectives = $('btn-close-objectives');
const objectivesList = $('objectives-list');
const newObjInput = $('objectives-new-input');
const btnAddObj = $('btn-add-objective');

async function initObjectives() {
    try {
        objectivesData = await fetchObjectives();
        if (!Array.isArray(objectivesData)) objectivesData = [];
        renderObjectives();
    } catch (e) {
        console.error("Failed to fetch objectives", e);
    }
}

function renderObjectives() {
    objectivesList.innerHTML = '';
    
    if (objectivesData.length === 0) {
        objectivesList.innerHTML = '<p style="text-align:center; color:var(--text-secondary); font-size:14px; margin-top:10px;">Aucun objectif défini. Ajoutez-en un ci-dessus.</p>';
        return;
    }
    
    objectivesData.forEach((obj, idx) => {
        const item = document.createElement('div');
        item.className = 'objective-item' + (obj.done ? ' done' : '');
        
        item.innerHTML = `
            <div class="objective-checkbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="objective-text">${obj.text}</div>
            <button class="btn-delete-obj" title="Supprimer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
        `;
        
        // Handle checking off
        item.querySelector('.objective-checkbox').parentElement.addEventListener('click', async (e) => {
            // Prevent toggling if clicked on the delete button
            if (e.target.closest('.btn-delete-obj')) return;
            
            obj.done = !obj.done;
            renderObjectives();
            try { await updateObjectives(objectivesData); } catch (e) { console.error(e); }
        });

        // Handle deleting
        item.querySelector('.btn-delete-obj').addEventListener('click', async (e) => {
            e.stopPropagation();
            objectivesData.splice(idx, 1);
            renderObjectives();
            try { await updateObjectives(objectivesData); } catch (e) { console.error(e); }
        });
        
        objectivesList.appendChild(item);
    });
}

function toggleObjectivesModal() {
    if (!modalObjectives) return;
    if (modalObjectives.classList.contains('hidden')) {
        modalObjectives.classList.remove('hidden');
        initObjectives();
    } else {
        modalObjectives.classList.add('hidden');
    }
}

if (btnCloseObjectives) {
    btnCloseObjectives.addEventListener('click', () => {
        modalObjectives.classList.add('hidden');
    });
}

// Add new objective
async function handleAddObjective() {
    const text = newObjInput.value.trim();
    if (!text) return;
    
    objectivesData.push({ id: Date.now(), text, done: false });
    newObjInput.value = '';
    renderObjectives();
    
    try { await updateObjectives(objectivesData); } catch (e) { console.error(e); }
}

if (btnAddObj) {
    btnAddObj.addEventListener('click', handleAddObjective);
}
if (newObjInput) {
    newObjInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddObjective();
    });
}

// Global hotkey Shift + O
document.addEventListener('keydown', (e) => {
    // Only trigger if Shift + O, and not typing inside an input/textarea
    if (e.shiftKey && e.key.toLowerCase() === 'o') {
        const tagName = e.target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') return;
        
        e.preventDefault();
        toggleObjectivesModal();
    }
    
    // Close on Escape if open
    if (e.key === 'Escape' && modalObjectives && !modalObjectives.classList.contains('hidden')) {
        modalObjectives.classList.add('hidden');
    }
});

// --- STUDY CHRONO LOGIC ---
let studyChronoActive = false;
let studyChronoPaused = false;
let studyChronoInterval = null;
let studyChronoStartTime = 0;
let studyChronoAccumulatedTime = 0;

function updateStudyChrono() {
    if (!studyChronoActive) return;
    
    let diffMs = studyChronoAccumulatedTime;
    if (!studyChronoPaused) {
        diffMs += Date.now() - studyChronoStartTime;
    }
    
    const diffSecs = Math.floor(diffMs / 1000);
    const h = Math.floor(diffSecs / 3600);
    const m = Math.floor((diffSecs % 3600) / 60);
    const s = diffSecs % 60;
    
    let timeStr = '';
    if (h > 0) {
        timeStr += String(h).padStart(2, '0') + ':';
    }
    timeStr += String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    
    let iconHtml = studyChronoPaused ? `<svg style="width:14px; height:14px; margin-right:6px;" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>` : '';
    const html = `<div style="display:flex; align-items:center;">${iconHtml}<span>${timeStr}</span></div>`;
    
    const chronoEx = $('study-chrono-ex');
    const chronoLs = $('study-chrono-ls');
    if (chronoEx) chronoEx.innerHTML = html;
    if (chronoLs) chronoLs.innerHTML = html;
}

document.addEventListener('keydown', (e) => {
    const tagName = e.target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') return;
    
    // Shift + C toggle
    if (e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        studyChronoActive = !studyChronoActive;
        
        const chronoEx = $('study-chrono-ex');
        const chronoLs = $('study-chrono-ls');
        
        if (studyChronoActive) {
            studyChronoStartTime = Date.now();
            studyChronoAccumulatedTime = 0;
            studyChronoPaused = false;
            updateStudyChrono();
            studyChronoInterval = setInterval(updateStudyChrono, 1000);
            if (chronoEx) chronoEx.classList.remove('hidden');
            if (chronoLs) chronoLs.classList.remove('hidden');
        } else {
            clearInterval(studyChronoInterval);
            if (chronoEx) chronoEx.classList.add('hidden');
            if (chronoLs) chronoLs.classList.add('hidden');
        }
    }
    
    // Shift + P pause
    if (e.shiftKey && e.key.toLowerCase() === 'p') {
        if (!studyChronoActive) return; // Smart logic: ignore if not active
        e.preventDefault();
        
        studyChronoPaused = !studyChronoPaused;
        if (studyChronoPaused) {
            studyChronoAccumulatedTime += Date.now() - studyChronoStartTime;
            clearInterval(studyChronoInterval);
            updateStudyChrono(); // update immediately to show icon
        } else {
            studyChronoStartTime = Date.now();
            updateStudyChrono();
            studyChronoInterval = setInterval(updateStudyChrono, 1000);
        }
    }
});
