import { state } from './state.js';
import { $, esc, showToast } from './utils.js';
import { fetchModules, fetchExercises, fetchLessons } from './api.js';
import { openExercise } from './exercise.js';
import { openLesson } from './lesson.js';

export async function loadExerciseList(isRefresh) {
    const listContainer = $('exercise-list');
    const empty = $('empty-state');
    const loading = $('loading-state');

    if (listContainer) listContainer.innerHTML = '';
    if (empty) empty.classList.add('hidden');
    if (loading) loading.classList.remove('hidden');

    try {
        const data = await fetchModules();
        const modules = data.modules || [];
        state.modules = modules;
        
        let allExercises = [];
        let allLessons = [];
        for (const mod of modules) {
            try {
                const modData = await fetchExercises(mod.folder);
                const exercises = modData.exercises || [];
                exercises.forEach(ex => {
                    ex.moduleFolder = mod.folder;
                    ex.moduleName = mod.name;
                    ex.moduleIcon = mod.icon || '📝';
                    ex.sourceCount = mod.sourceCount || 0;
                    ex.type = 'exercice';
                    if (!ex.subject) ex.subject = mod.name;
                    allExercises.push(ex);
                });
            } catch(e) { console.error('Error loading module exercices', mod.folder, e); }
            
            try {
                const modData = await fetchLessons(mod.folder);
                const lessons = modData.lessons || modData.exercises || [];
                lessons.forEach(ls => {
                    ls.moduleFolder = mod.folder;
                    ls.moduleName = mod.name;
                    ls.moduleIcon = mod.icon || '📚';
                    ls.sourceCount = mod.sourceCount || 0;
                    ls.type = 'cours';
                    if (!ls.subject) ls.subject = mod.name;
                    allLessons.push(ls);
                });
            } catch(e) { console.error('Error loading module cours', mod.folder, e); }
        }
        state.exerciseList = allExercises;
        state.lessonList = allLessons;
        if (loading) loading.classList.add('hidden');

        if (allExercises.length === 0 && allLessons.length === 0 && empty) {
            if (state.modules.length === 0) {
                empty.innerHTML = `
                    <div class="empty-icon">📂</div>
                    <h2>Aucun module trouvé</h2>
                    <p>Cliquez sur "Nouveau Module" pour commencer votre bibliothèque.</p>
                `;
            } else {
                empty.innerHTML = `
                    <div class="empty-icon">📭</div>
                    <h2>Aucun contenu trouvé</h2>
                    <p>Aucun exercice ni cours n'a été généré dans vos modules.</p>
                `;
            }
            empty.classList.remove('hidden');
        } else {
            if (empty) empty.classList.add('hidden');
            renderModules(allExercises, allLessons);
            if (isRefresh) showToast('Liste actualisée', 'success');
        }
    } catch (e) {
        console.error(e);
        if (loading) loading.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        if (isRefresh) showToast('Erreur de chargement', 'error');
    }
}

export function filterExercises(q) {
    q = q.toLowerCase().trim();
    const filteredEx = state.exerciseList.filter(
        (ex) => ex.title.toLowerCase().includes(q) || (ex.subject || '').toLowerCase().includes(q)
    );
    const filteredLs = state.lessonList.filter(
        (ls) => ls.title.toLowerCase().includes(q) || (ls.subject || '').toLowerCase().includes(q)
    );
    
    const empty = $('empty-state');
    if (filteredEx.length === 0 && filteredLs.length === 0 && q && empty) {
        $('exercise-list').innerHTML = '';
        empty.innerHTML = `
            <div class="empty-icon">🔍</div>
            <h2>Aucun résultat</h2>
            <p>Aucun contenu ne correspond à "${q}".</p>
        `;
        empty.classList.remove('hidden');
    } else {
        if (empty) empty.classList.add('hidden');
        renderModules(filteredEx, filteredLs, !!q);
    }
}

export function renderModules(exercises, lessons, autoExpand = false) {
    const listContainer = $('exercise-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    const groups = {};
    
    state.modules.forEach(mod => {
        groups[mod.name] = { 
            folder: mod.folder,
            icon: mod.icon || '📝', 
            sourceCount: mod.sourceCount || 0,
            folderExists: mod.folderExists !== false,
            hasAgents: mod.hasAgents !== false,
            exercises: [],
            lessons: []
        };
    });

    exercises.forEach(ex => {
        const mName = ex.moduleName || 'Autres';
        if (!groups[mName]) groups[mName] = { icon: ex.moduleIcon || '📝', sourceCount: ex.sourceCount || 0, exercises: [], lessons: [] };
        groups[mName].exercises.push(ex);
    });
    
    lessons.forEach(ls => {
        const mName = ls.moduleName || 'Autres';
        if (!groups[mName]) groups[mName] = { icon: ls.moduleIcon || '📚', sourceCount: ls.sourceCount || 0, exercises: [], lessons: [] };
        groups[mName].lessons.push(ls);
    });

    Object.keys(groups).forEach(mName => {
        const grp = groups[mName];
        
        // If filtering and this module is empty, skip rendering it
        if (exercises.length < state.exerciseList.length && grp.exercises.length === 0 && grp.lessons.length === 0) {
            return;
        }
        
        const section = document.createElement('div');
        section.className = 'module-accordion';
        
        const header = document.createElement('div');
        header.className = 'module-accordion-header';
        
        const left = document.createElement('div');
        left.className = 'module-accordion-left';
        left.innerHTML = `<span class="module-icon">${grp.icon}</span> <span class="module-name">${esc(mName)}</span>`;
        
        const right = document.createElement('div');
        right.className = 'module-accordion-right';
        
        let badgesHtml = '';
        if (!grp.folderExists) {
            badgesHtml += `<span class="badge badge-error">⚠️ Dossier Manquant</span>`;
        } else if (!grp.hasAgents) {
            badgesHtml += `<span class="badge badge-warning" title="Instructions IA non configurées">⚠️ Pas d'IA</span>`;
        }
        
        if (grp.lessons.length > 0) badgesHtml += `<span class="badge badge-lesson">${grp.lessons.length} Cours</span>`;
        if (grp.exercises.length > 0) badgesHtml += `<span class="badge badge-exercise">${grp.exercises.length} Exercices</span>`;
        if (grp.sourceCount > 0) badgesHtml += `<span class="badge badge-source">📄 ${grp.sourceCount} Source(s)</span>`;
        
        right.innerHTML = `
            <div class="module-badges">${badgesHtml}</div>
            <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        `;
        
        header.appendChild(left);
        header.appendChild(right);
        
        const content = document.createElement('div');
        content.className = 'module-accordion-content';
        if (autoExpand) content.style.display = 'block';
        
        header.addEventListener('click', () => {
            header.classList.toggle('open');
            content.style.display = header.classList.contains('open') ? 'block' : 'none';
        });

        // Add context menu listener
        header.addEventListener('contextmenu', (e) => {
            if (grp.folder) {
                e.preventDefault();
                // Dispatch custom event to main.js
                document.dispatchEvent(new CustomEvent('moduleContextMenu', { 
                    detail: { x: e.pageX, y: e.pageY, folder: grp.folder, name: mName, icon: grp.icon }
                }));
            }
        });

        if (autoExpand) header.classList.add('open');

        // Render lessons list
        if (grp.lessons.length > 0) {
            const lsTitle = document.createElement('h4');
            lsTitle.className = 'list-title';
            lsTitle.textContent = '📚 Cours';
            content.appendChild(lsTitle);
            
            const lsList = document.createElement('div');
            lsList.className = 'item-list';
            grp.lessons.forEach(ls => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<div class="item-subject">${esc(ls.subject || 'Général')}</div><div class="item-title">${esc(ls.title)}</div>`;
                item.addEventListener('click', () => openLesson(ls));
                lsList.appendChild(item);
            });
            content.appendChild(lsList);
        }

        // Render exercises list
        if (grp.exercises.length > 0) {
            const exTitle = document.createElement('h4');
            exTitle.className = 'list-title';
            exTitle.textContent = '📝 Exercices';
            content.appendChild(exTitle);
            
            const exList = document.createElement('div');
            exList.className = 'item-list';
            grp.exercises.forEach(ex => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<div class="item-subject">${esc(ex.subject || 'Général')}</div><div class="item-title">${esc(ex.title)}</div>`;
                item.addEventListener('click', () => openExercise(ex));
                exList.appendChild(item);
            });
            content.appendChild(exList);
        }

        if (grp.lessons.length === 0 && grp.exercises.length === 0) {
            content.innerHTML = '<div class="empty-module">Aucun contenu dans ce module.</div>';
        }

        section.appendChild(header);
        section.appendChild(content);
        listContainer.appendChild(section);
    });
}
