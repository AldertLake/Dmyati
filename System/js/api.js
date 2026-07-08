export async function fetchModules() {
    const r = await fetch('/api/modules?t=' + Date.now());
    if (!r.ok) {
        if (r.status === 404) throw new Error('API not found');
        throw new Error(r.status);
    }
    return r.json();
}

export async function fetchProgress() {
    const r = await fetch('/api/progress?t=' + Date.now());
    if (!r.ok) return {};
    return r.json();
}

export async function saveProgress(progress) {
    const r = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progress)
    });
    if (!r.ok) throw new Error('Erreur API');
    return r.json();
}

export async function createModule(name, icon, info = '') {
    const r = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, info })
    });
    if (!r.ok) throw new Error('Erreur API');
    return r.json();
}

export async function fetchExercises(folder) {
    const r = await fetch(`Modules/${folder}/exercices/index.json?t=` + Date.now());
    if (!r.ok) throw new Error(r.status);
    return r.json();
}

export async function fetchLessons(folder) {
    const r = await fetch(`Modules/${folder}/Cour/index.json?t=` + Date.now());
    if (!r.ok) throw new Error(r.status);
    return r.json();
}

export async function fetchExerciseData(folder, file) {
    const r = await fetch(`Modules/${folder}/exercices/${file}?t=` + Date.now());
    if (!r.ok) throw new Error(r.status);
    return r.json();
}

export async function fetchLessonData(folder, file) {
    const r = await fetch(`Modules/${folder}/Cour/${file}?t=` + Date.now());
    if (!r.ok) throw new Error(r.status);
    return r.json();
}
export async function updateModule(folder, name, icon) {
    const r = await fetch(`/api/modules/${folder}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon })
    });
    if (!r.ok) throw new Error('Erreur API');
    return r.json();
}

export async function deleteModule(folder) {
    const r = await fetch(`/api/modules/${folder}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Erreur API');
    return r.json();
}

export async function fetchModuleInfo(folder) {
    const r = await fetch(`/api/modules/${folder}/info?t=` + Date.now());
    if (!r.ok) throw new Error(r.status);
    return r.json();
}

export async function updateModuleInfo(folder, info) {
    const r = await fetch(`/api/modules/${folder}/info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ info })
    });
    if (!r.ok) throw new Error('Erreur API');
    return r.json();
}

export async function fetchSettings() {
    const r = await fetch('/api/settings?t=' + Date.now());
    if (!r.ok) return {};
    return r.json();
}

export async function updateSettings(settings) {
    const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    if (!r.ok) throw new Error('Erreur API');
    return r.json();
}

export async function fetchObjectives() {
    const r = await fetch('/api/objectives?t=' + Date.now());
    if (!r.ok) return [];
    return r.json();
}

export async function updateObjectives(obs) {
    const r = await fetch('/api/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obs)
    });
    if (!r.ok) throw new Error('Erreur API');
    return r.json();
}
