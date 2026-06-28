import { state } from './state.js';
import { $, showToast } from './utils.js';
import { initTheme, toggleTheme, setMobileTab, showView } from './ui.js';
import { initMermaid } from './renderer.js';
import { loadExerciseList, filterExercises } from './home.js';
import { createModule } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMermaid();
    loadExerciseList();
    bindGlobalEvents();
    checkUpdate();
});

function bindGlobalEvents() {
    $('btn-refresh').addEventListener('click', () => loadExerciseList(true));
    $('search-input').addEventListener('input', (e) => filterExercises(e.target.value));
    $('btn-back').addEventListener('click', () => showView('home'));
    $('btn-back-lesson').addEventListener('click', () => showView('home'));



    // Theme toggle
    $('theme-toggle').addEventListener('click', toggleTheme);

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

    const btnSubmit = $('btn-submit-modal');
    if (btnSubmit) {
        btnSubmit.addEventListener('click', async () => {
            const name = $('module-name').value.trim();
            const icon = $('module-icon').value.trim();
            if (!name) return showToast('Le nom est requis', 'error');
            
            btnSubmit.disabled = true;
            try {
                await createModule(name, icon);
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
        
        if (manual && btnText) {
            btn.disabled = true;
            btnText.textContent = "Vérification...";
        }
        
        const res = await fetch('/api/update/check');
        const data = await res.json();
        
        if (!data.isRepo) {
            if (btn) btn.classList.add('hidden');
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
                nBtnText.textContent = "Mise à jour dispo";
                nBtn.classList.remove('btn-outline');
                nBtn.classList.add('btn-warning');
                
                let isConfirming = false;
                
                nBtn.addEventListener('click', async () => {
                    if (!isConfirming) {
                        isConfirming = true;
                        nBtnText.textContent = "Mettre à jour ?";
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
