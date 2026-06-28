import { $, esc, showToast } from './utils.js';
import { fetchLessonData } from './api.js';
import { renderContentBlock, renderAllMath, renderMermaidBlocks, renderCharts } from './renderer.js';
import { showView } from './ui.js';

export async function openLesson(ex) {
    try {
        const data = await fetchLessonData(ex.moduleFolder, ex.file);
        renderLesson(data);
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
