export const musicPlayer = {
    audio: new Audio(),
    songs: [],
    currentIndex: 0,
    isLooping: false,
    isVisible: false,

    init() {
        this.fetchSongs();
        this.bindEvents();
        
        // Listen to audio events
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => {
            if (this.isLooping) {
                this.audio.currentTime = 0;
                this.audio.play();
            } else {
                this.nextSong();
            }
        });

        // Global shortcut
        document.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                this.toggleVisibility();
            }
        });
    },

    async fetchSongs() {
        try {
            const res = await fetch('/api/music');
            const data = await res.json();
            this.songs = data.songs || [];
            if (this.songs.length > 0) {
                this.loadSong(0);
            } else {
                document.getElementById('music-player-title').textContent = 'Aucune piste';
            }
        } catch (e) {
            console.error('Failed to load music', e);
        }
    },

    loadSong(index) {
        if (index < 0 || index >= this.songs.length) return;
        this.currentIndex = index;
        const songName = this.songs[index];
        this.audio.src = `/Music/${encodeURIComponent(songName)}`;
        document.getElementById('music-player-title').textContent = songName.replace(/\.[^/.]+$/, "");
    },

    play() {
        if (this.songs.length === 0) return;
        this.audio.play();
        document.getElementById('music-icon-play').classList.add('hidden');
        document.getElementById('music-icon-pause').classList.remove('hidden');
    },

    pause() {
        this.audio.pause();
        document.getElementById('music-icon-play').classList.remove('hidden');
        document.getElementById('music-icon-pause').classList.add('hidden');
    },

    togglePlay() {
        if (this.audio.paused) this.play();
        else this.pause();
    },

    nextSong() {
        if (this.songs.length === 0) return;
        let nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.songs.length) nextIndex = 0; // wrap around
        this.loadSong(nextIndex);
        this.play();
    },

    prevSong() {
        if (this.songs.length === 0) return;
        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) prevIndex = this.songs.length - 1; // wrap around
        this.loadSong(prevIndex);
        this.play();
    },

    toggleLoop() {
        this.isLooping = !this.isLooping;
        const btn = document.getElementById('music-btn-loop');
        if (this.isLooping) btn.classList.add('active');
        else btn.classList.remove('active');
    },

    toggleVisibility() {
        this.isVisible = !this.isVisible;
        const player = document.getElementById('music-player');
        if (this.isVisible) {
            player.classList.remove('hidden');
        } else {
            player.classList.add('hidden');
        }
    },

    updateProgress() {
        if (!this.audio.duration) return;
        const pct = (this.audio.currentTime / this.audio.duration) * 100;
        document.getElementById('music-progress-bar').style.width = pct + '%';
    },

    seek(e) {
        if (!this.audio.duration) return;
        const container = document.getElementById('music-progress-container');
        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        this.audio.currentTime = pct * this.audio.duration;
    },

    bindEvents() {
        document.getElementById('music-btn-play').addEventListener('click', () => this.togglePlay());
        document.getElementById('music-btn-next').addEventListener('click', () => this.nextSong());
        document.getElementById('music-btn-prev').addEventListener('click', () => this.prevSong());
        document.getElementById('music-btn-loop').addEventListener('click', () => this.toggleLoop());
        document.getElementById('music-btn-close').addEventListener('click', () => this.toggleVisibility());
        document.getElementById('music-progress-container').addEventListener('click', (e) => this.seek(e));
    }
};
