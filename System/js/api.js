export async function fetchModules() {
    const r = await fetch('/api/modules?t=' + Date.now());
    if (!r.ok) {
        if (r.status === 404) throw new Error('API not found');
        throw new Error(r.status);
    }
    return r.json();
}

export async function createModule(name, icon) {
    const r = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon })
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
