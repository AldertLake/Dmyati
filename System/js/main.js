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
