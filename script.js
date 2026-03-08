/**
 * NeuroVis — Versión SIN CARPETAS para GitHub
 * Esta versión busca los modelos directamente en la raíz para facilitar la subida manual.
 */

class VideoManager {
  constructor() {
    this.video = document.getElementById('video-player');
    this.fileInput = document.getElementById('file-input');
    this.uploadSection = document.getElementById('upload-section');
    this.uploadCard = this.uploadSection.querySelector('.upload-card');
    this.workspace = document.getElementById('workspace');
    this.btnPlay = document.getElementById('btn-play');
    this.iconPlay = document.getElementById('icon-play');
    this.iconPause = document.getElementById('icon-pause');
    this.timeCurrent = document.getElementById('time-current');
    this.timeDuration = document.getElementById('time-duration');
    this.progressTrack = document.getElementById('progress-track');
    this.progressFill = document.getElementById('progress-fill');
    this.progressThumb = document.getElementById('progress-thumb');
    this.filenameEl = document.getElementById('video-filename');
    this.duration = 0;
    this.isLoaded = false;
    this._initEvents();
  }

  _initEvents() {
    this.fileInput.addEventListener('change', (e) => { if (e.target.files.length) this._loadFile(e.target.files[0]); });
    this.uploadCard.addEventListener('dragover', (e) => { e.preventDefault(); this.uploadCard.classList.add('drag-over'); });
    this.uploadCard.addEventListener('dragleave', () => { this.uploadCard.classList.remove('drag-over'); });
    this.uploadCard.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadCard.classList.remove('drag-over');
      if (e.dataTransfer.files.length) this._loadFile(e.dataTransfer.files[0]);
    });
    this.btnPlay.addEventListener('click', () => this.togglePlay());
    this.video.addEventListener('timeupdate', () => {
      const pct = (this.video.currentTime / this.duration) * 100;
      if (this.progressFill) this.progressFill.style.width = `${pct}%`;
      if (this.progressThumb) this.progressThumb.style.left = `${pct}%`;
      this.timeCurrent.textContent = this._formatTime(this.video.currentTime);
    });
    this.video.addEventListener('loadedmetadata', () => {
      this.duration = this.video.duration;
      this.timeDuration.textContent = this._formatTime(this.duration);
      this.isLoaded = true;
    });
  }

  _loadFile(file) {
    this.video.src = URL.createObjectURL(file);
    this.filenameEl.textContent = file.name;
    this.video.load();
    this.uploadSection.classList.add('hidden');
    this.workspace.classList.remove('hidden');
  }

  togglePlay() {
    if (this.video.paused) { this.video.play(); this.iconPlay.classList.add('hidden'); this.iconPause.classList.remove('hidden'); } 
    else { this.video.pause(); this.iconPlay.classList.remove('hidden'); this.iconPause.classList.add('hidden'); }
  }

  _formatTime(s) { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; }
}

class FaceAnalyzer {
  constructor() { this.modelsLoaded = false; this.isAnalyzing = false; }

  async loadModels() {
    if (this.modelsLoaded) return;
    
    // RUTA CAMBIADA A LA RAÍZ (./) para evitar la carpeta 'models'
    const MODEL_URL = './'; 
    
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      this.modelsLoaded = true;
    } catch (e) {
      console.error('Error cargando modelos:', e);
      throw new Error("No se encontraron los modelos en la raíz del repositorio. Asegúrate de haber subido todos los archivos sueltos.");
    }
  }

  async analyzeVideo(video, duration, intervalMs = 200, onProgress = null, onFrameResult = null) {
    if (!this.modelsLoaded) await this.loadModels();
    this.isAnalyzing = true;
    const results = [];
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    const intervalSec = intervalMs / 1000;
    const totalFrames = Math.ceil(duration / intervalSec);
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });

    for (let t = 0; t <= duration; t += intervalSec) {
      if (!this.isAnalyzing) break;
      await new Promise(r => {
        const seeked = () => { video.removeEventListener('seeked', seeked); requestAnimationFrame(() => requestAnimationFrame(r)); };
        video.addEventListener('seeked', seeked);
        video.currentTime = t;
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const detection = await faceapi.detectSingleFace(canvas, options).withFaceExpressions();
      const res = { timestamp: t, expressions: detection ? detection.expressions : null, faceDetected: !!detection };
      results.push(res);
      if (onProgress) onProgress(results.length / totalFrames, t);
      if (onFrameResult) onFrameResult(res, results.length, totalFrames);
      if (t + intervalSec > duration && t < duration) t = duration - intervalSec;
    }
    this.isAnalyzing = false;
    return results;
  }

  cancel() { this.isAnalyzing = false; }
}

class MetricsEngine {
  constructor() { this.reset(); }
  reset() { this.metrics = []; this.averages = { engagement: 0, valence: 0, arousal: 0, dominant: 'neutral' }; this._sums = { e: 0, v: 0, a: 0 }; this._count = 0; this._emotions = {}; }
  processFrame(frame) {
    let point = { timestamp: frame.timestamp, engagement: 0, valence: 0, arousal: 0, dominant: 'neutral', faceDetected: frame.faceDetected };
    if (frame.faceDetected && frame.expressions) {
      const e = frame.expressions;
      point.engagement = 1 - (e.neutral || 0);
      point.valence = (e.happy || 0) + (e.surprised * 0.5) - ((e.sad || 0) + (e.angry || 0) + (e.disgusted || 0) + (e.fearful || 0));
      point.arousal = (e.happy * 0.7) + (e.surprised) + (e.angry * 0.9) + (e.fearful * 0.8) + (e.disgusted * 0.5);
      point.dominant = Object.entries(e).reduce((a, b) => b[1] > a[1] ? b : a)[0];
      this._sums.e += point.engagement; this._sums.v += point.valence; this._sums.a += point.arousal; this._count++;
      this._emotions[point.dominant] = (this._emotions[point.dominant] || 0) + 1;
      this.averages.engagement = this._sums.e / this._count;
      this.averages.valence = this._sums.v / this._count;
      this.averages.arousal = this._sums.a / this._count;
      this.averages.dominant = Object.entries(this._emotions).reduce((a, b) => b[1] > a[1] ? b : a)[0];
    }
    this.metrics.push(point);
    return point;
  }
}

class TimelineChart {
  constructor() { this.chart = null; }
  init() {
    const ctx = document.getElementById('timeline-chart').getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'Engagement', data: [], borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.05)', fill: true, tension: 0.4, pointRadius: 0 },
        { label: 'Valence', data: [], borderColor: '#00e67a', backgroundColor: 'rgba(0,230,122,0.05)', fill: true, tension: 0.4, pointRadius: 0 },
        { label: 'Arousal', data: [], borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.05)', fill: true, tension: 0.4, pointRadius: 0 }
      ]},
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { min: -1, max: 1 } }, plugins: { legend: { display: false } } }
    });
  }
  update(metrics) {
    this.chart.data.labels = metrics.map(m => m.timestamp);
    this.chart.data.datasets[0].data = metrics.map(m => m.engagement);
    this.chart.data.datasets[1].data = metrics.map(m => m.valence);
    this.chart.data.datasets[2].data = metrics.map(m => m.arousal);
    this.chart.update('none');
  }
}

class NeuroVisApp {
  constructor() {
    this.video = new VideoManager();
    this.ia = new FaceAnalyzer();
    this.engine = new MetricsEngine();
    this.chart = new TimelineChart();
    this._init();
  }
  _init() {
    this.chart.init();
    document.getElementById('btn-analyze').addEventListener('click', () => this.start());
    document.getElementById('btn-export').addEventListener('click', () => this.export());
    document.getElementById('btn-new-session').addEventListener('click', () => location.reload());
  }
  async start() {
    if (!this.video.isLoaded) return;
    const btn = document.getElementById('btn-analyze');
    const bar = document.getElementById('analysis-bar');
    const status = document.getElementById('analysis-status');
    const prog = document.getElementById('analysis-progress');
    btn.disabled = true; prog.classList.remove('hidden'); status.textContent = 'Iniciando...';
    this.engine.reset();
    try {
      await this.ia.analyzeVideo(this.video.video, this.video.duration, 200, (p) => {
        bar.style.width = `${p * 100}%`;
        status.textContent = `Analizando... ${Math.round(p * 100)}%`;
      }, (res) => {
        this.engine.processFrame(res);
        this.chart.update(this.engine.metrics);
        this._updateUI(this.engine.averages);
      });
      status.textContent = '¡Análisis Completo!';
      btn.innerHTML = 'Completo ✓';
      document.getElementById('btn-export').disabled = false;
    } catch (e) { status.textContent = 'Error: ' + e.message; btn.disabled = false; btn.innerHTML = 'Reintentar Análisis'; }
  }
  _updateUI(avg) {
    const emojis = { happy: '😊', sad: '😢', angry: '😠', surprised: '😲', fearful: '😨', disgusted: '🤢', neutral: '😐' };
    const labels = { happy: 'Feliz', sad: 'Triste', angry: 'Enojado', surprised: 'Sorpresa', fearful: 'Miedo', disgusted: 'Disgusto', neutral: 'Neutral' };
    document.getElementById('val-engagement').textContent = `${(avg.engagement * 100).toFixed(1)}%`;
    document.getElementById('bar-engagement').style.width = `${avg.engagement * 100}%`;
    document.getElementById('val-valence').textContent = `${(avg.valence * 100).toFixed(1)}%`;
    document.getElementById('bar-valence').style.width = `${((avg.valence + 1) / 2) * 100}%`;
    document.getElementById('val-arousal').textContent = `${(avg.arousal * 100).toFixed(1)}%`;
    document.getElementById('bar-arousal').style.width = `${avg.arousal * 100}%`;
    const dom = avg.dominant || 'neutral';
    document.getElementById('val-dominant').textContent = `${emojis[dom]} ${labels[dom]}`;
  }
  async export() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22); doc.text('NeuroVis - Resultado del Análisis', 20, 30);
    doc.setFontSize(12);
    doc.text(`Engagement: ${document.getElementById('val-engagement').textContent}`, 20, 50);
    doc.text(`Valence: ${document.getElementById('val-valence').textContent}`, 20, 60);
    doc.text(`Arousal: ${document.getElementById('val-arousal').textContent}`, 20, 70);
    doc.text(`Emoción Dominante: ${document.getElementById('val-dominant').textContent}`, 20, 80);
    doc.save('Análisis_NeuroVis.pdf');
  }
}
window.addEventListener('DOMContentLoaded', () => new NeuroVisApp());
