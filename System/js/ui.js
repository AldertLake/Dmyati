import { state } from './state.js';
import { $, showToast } from './utils.js';
import { initMermaid, renderMermaidBlocks } from './renderer.js';

export function showView(name) {
    state.currentView = name;
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const viewEl = $('view-' + name);
    if (viewEl) viewEl.classList.add('active');
    if (name !== 'exercise') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

export function setMobileTab(panel) {
    const body = $('exercise-body');
    if ($('tab-enonce')) $('tab-enonce').classList.toggle('active', panel === 'left');
    if ($('tab-questions')) $('tab-questions').classList.toggle('active', panel === 'right');
    if (body) body.classList.toggle('show-enonce', panel === 'left');
}

export function initTheme() {
    const saved = localStorage.getItem('dmyati-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dmyati-theme', next);
    
    initMermaid();
    const body = $('exercise-body');
    if (body) renderMermaidBlocks(body);
    showToast(next === 'dark' ? '🌙 Mode sombre' : '☀️ Mode clair', 'success');
}
