import { $, esc, showToast } from './utils.js';
import { fetchLessonData } from './api.js';
import { renderContentBlock, renderAllMath, renderMermaidBlocks, renderCharts } from './renderer.js';
import { showView } from './ui.js';
import { state } from './state.js';

export async function openLesson(ex) {
    try {
        const data = await fetchLessonData(ex.moduleFolder, ex.file);
        state.currentViewData = { type: 'lesson', data: ex };
        renderLesson(data);
        renderLessonSidebar(ex);
        initZoom();
        applyZoom();
        showView('lesson');
    } catch (e) {
        console.error(e);
        showToast('Impossible de charger le cours', 'error');
    }
}

function renderLesson(data) {
    $('lesson-topbar-title').textContent = data.title || 'Cours';
    
    const header = $('lesson-header');
    header.innerHTML = `
        <div class="lesson-header-subject">${esc(data.subject || 'Matière')}</div>
        <h1 class="lesson-header-title">${esc(data.title || '')}</h1>
    `;

    const body = $('lesson-body');
    body.innerHTML = '';
    
    const contentBlocks = data.content || data.enonce || [];
    contentBlocks.forEach(block => {
        body.appendChild(renderContentBlock(block));
    });

    renderAllMath(body);
    renderMermaidBlocks(body);
    renderCharts(body);
}

function renderLessonSidebar(currentEx) {
    const sidebar = $('lesson-sidebar');
    const toggleBtn = $('btn-toggle-sidebar');
    const topbarDivider = $('lesson-topbar-divider');
    if (!sidebar) return;
    
    const moduleLessons = state.lessonList.filter(l => l.moduleFolder === currentEx.moduleFolder);
    
    if (moduleLessons.length <= 1) {
        sidebar.classList.add('hidden');
        sidebar.innerHTML = '';
        if (toggleBtn) toggleBtn.classList.add('hidden');
        if (topbarDivider) topbarDivider.style.display = 'none';
        return;
    }
    
    sidebar.classList.remove('hidden');
    sidebar.classList.remove('collapsed');
    sidebar.innerHTML = '';
    
    if (toggleBtn) {
        toggleBtn.classList.remove('hidden');
        toggleBtn.onclick = () => sidebar.classList.toggle('collapsed');
    }
    if (topbarDivider) topbarDivider.style.display = 'block';
    
    moduleLessons.forEach(ls => {
        const item = document.createElement('div');
        item.className = 'lesson-sidebar-item';
        if (ls.file === currentEx.file) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="lesson-sidebar-item-subject">${esc(ls.subject || 'Général')}</div>
            <div class="lesson-sidebar-item-title">${esc(ls.title)}</div>
        `;
        
        item.addEventListener('click', () => {
            if (ls.file !== currentEx.file) {
                openLesson(ls);
            }
        });
        
        sidebar.appendChild(item);
    });
}

let currentZoom = 1;
let zoomInitialized = false;

function initZoom() {
    if (zoomInitialized) return;
    const btnIn = $('btn-zoom-in');
    const btnOut = $('btn-zoom-out');
    if (!btnIn || !btnOut) return;

    btnIn.addEventListener('click', () => {
        if (currentZoom < 2) currentZoom += 0.1;
        applyZoom();
    });
    btnOut.addEventListener('click', () => {
        if (currentZoom > 0.5) currentZoom -= 0.1;
        applyZoom();
    });
    zoomInitialized = true;
}

function applyZoom() {
    const body = $('lesson-body');
    const level = $('zoom-level');
    if (!body || !level) return;
    
    currentZoom = Math.round(currentZoom * 10) / 10;
    body.style.zoom = currentZoom;
    level.textContent = Math.round(currentZoom * 100) + '%';
    
    if (typeof body.style.zoom === 'undefined' || navigator.userAgent.toLowerCase().includes('firefox')) {
        body.style.transform = `scale(${currentZoom})`;
        body.style.transformOrigin = 'top center';
        body.style.marginBottom = `${(currentZoom - 1) * body.offsetHeight}px`;
    }
}
