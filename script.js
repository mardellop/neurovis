/**
 * NeuroVis — VERSIÓN FLUIDA (Análisis en Tiempo Real)
 * - El video se reproduce a velocidad normal (1x).
 * - El análisis ocurre mientras el video avanza, de forma fluida.
 * - La duración del análisis coincide con la duración del video.
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
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      this.modelsLoaded = true;
    } catch (e) { throw new Error("No se pudieron cargar los modelos de IA."); }
  }

  async analyzeVideoLive(video, duration, onProgress = null, onFrameResult = null) {
    if (!this.modelsLoaded) await this.loadModels();
    this.isAnalyzing = true;
    
    // Configuramos el video para reproducirse fluido
    video.currentTime = 0;
    video.playbackRate = 1.0; 
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });

    return new Promise((resolve) => {
      const processFrame = async () => {
        if (!this.isAnalyzing || video.ended || video.paused) {
          this.isAnalyzing = false;
          resolve();
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const detection = await faceapi.detectSingleFace(canvas, options).withFaceExpressions();
        
        const res = { 
          timestamp: video.currentTime, 
          expressions: detection ? detection.expressions : null, 
          faceDetected: !!detection 
        };

        if (onProgress) onProgress(video.currentTime / duration, video.currentTime);
        if (onFrameResult) onFrameResult(res);

        // Analizamos cada frame que el procesador permita sin bloquear el video
        requestAnimationFrame(processFrame);
      };
      
      processFrame();
    });
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
        { label: 'Valence', data: [], borderColor: '#00e67a', backgroundColor: 'rgba(0,230,122,0.1)', fill: true, tension: 0.4, pointRadius: 0 },
        { label: 'Arousal', data: [], borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)', fill: true, tension: 0.4, pointRadius: 0 }
      ]},
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { min: -1, max: 1 } }, plugins: { legend: { display: false } } }
    });
  }
  update(metrics) {
    // Para fluido, limitamos la cantidad de puntos en pantalla si es muy largo
    this.chart.data.labels = metrics.map(m => m.timestamp.toFixed(1));
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
    btn.disabled = true; prog.classList.remove('hidden'); status.textContent = 'Iniciando Análisis Fluido...';
    this.engine.reset();
    try {
      // El análisis dura lo que dura el video y se ve en tiempo real
      await this.ia.analyzeVideoLive(this.video.video, this.video.duration, (p) => {
        bar.style.width = `${p * 100}%`;
        status.textContent = `Analizando en vivo... ${Math.round(p * 100)}%`;
      }, (res) => {
        const point = this.engine.processFrame(res);
        this.chart.update(this.engine.metrics);
        // Pasamos el punto actual (point) para que las barras suban y bajen en vivo
        this._updateUI(point); 
      });
      status.textContent = '¡Análisis Completo!';
      btn.innerHTML = 'Completo ✓';
      document.getElementById('btn-export').disabled = false;
      
      // AL TERMINAR: Mostramos los promedios finales en el tablero
      // para que coincidan con lo que se exportará en el PDF.
      this._updateUI(this.engine.averages); 

      this.video.pause();
      this.video.video.currentTime = 0;
    } catch (e) { status.textContent = 'Error: ' + e.message; btn.disabled = false; }
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
    const btn = document.getElementById('btn-export');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Generando PDF...';
    btn.disabled = true;

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 25;

      // 1. Encabezado Premium
      doc.setFillColor(10, 14, 26); doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(0, 212, 255); doc.setFontSize(24); doc.setFont('helvetica', 'bold');
      doc.text('Informe de NeuroVis', margin, 25);
      
      // Fecha
      doc.setTextColor(139, 146, 168); doc.setFontSize(10);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - margin - 40, 25);
      
      y = 55;
      
      // 2. Métricas Promedio
      doc.setTextColor(0, 0, 0); doc.setFontSize(16); doc.text('Resultados del análisis biométrico', margin, y);
      y += 12;
      
      const avg = this.engine.averages;
      doc.setDrawColor(200, 200, 200); doc.setFillColor(245, 247, 250);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 35, 3, 3, 'FD');
      
      let bx = margin + 10;
      doc.setFontSize(10); doc.setTextColor(80, 80, 80);
      doc.text('Engagement', bx, y + 10); doc.text('Valencia', bx + 60, y + 10); doc.text('Arousal', bx + 120, y + 10);
      
      doc.setFontSize(15); doc.setTextColor(10, 10, 10);
      doc.text(`${(avg.engagement * 100).toFixed(1)}%`, bx, y + 20);
      doc.text(`${(avg.valence * 100).toFixed(1)}%`, bx + 60, y + 20);
      doc.text(`${(avg.arousal * 100).toFixed(1)}%`, bx + 120, y + 20);
      
      const labels = { happy: 'Feliz', sad: 'Triste', angry: 'Enojado', surprised: 'Sorpresa', fearful: 'Miedo', disgusted: 'Disgusto', neutral: 'Neutral' };
      doc.setFontSize(11); doc.text(`Emoción dominante: ${labels[avg.dominant] || 'Neutral'}`, bx, y + 28);
      
      y += 50;

      // 3. Capturas de Pantalla (Evidencia Visual)
      doc.setFontSize(15); doc.text('Evidencia visual', margin, y);
      y += 8;
      
      const vCap = await this._capture();
      const cCap = this._captureChart();
      const imgW = (pageWidth - (margin * 2)) / 2 - 5;
      const imgH = (imgW * 9) / 16;
      
      if (vCap) doc.addImage(vCap, 'PNG', margin, y, imgW, imgH);
      if (cCap) doc.addImage(cCap, 'PNG', margin + imgW + 10, y, imgW, imgH);
      
      y += imgH + 20;

      // 4. Implicaciones de Venta
      doc.setFontSize(16); doc.setTextColor(0, 0, 0); doc.text('Implicaciones para tu producto', margin, y);
      y += 10;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      
      const implications = this._calculateImplications(avg);
      const splitText = doc.splitTextToSize(implications, pageWidth - (margin * 2));
      doc.text(splitText, margin, y);

      doc.save(`NeuroVis_Report_${new Date().getTime()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Error al generar el PDF: ' + e.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  _calculateImplications(avg) {
    let m = "";
    if (avg.engagement > 0.6) m += "ALTO COMPROMISO: El usuario está cautivado por el estímulo visual. Probablemente quiera comprar el producto.\n\n";
    else m += "ATENCIÓN BAJA: El contenido actual no engancha. Se recomienda usar más contraste o un inicio más impactante.\n\n";
    
    if (avg.valence > 0.1) m += "VALENCIA POSITIVA: El producto genera agrado. La predisposición a la compra es alta porque se asocia con algo placentero.\n\n";
    else if (avg.valence < -0.1) m += "VALENCIA NEGATIVA: Hay rechazo. Puede estar comunicando un mensaje que asusta o genera desconfianza.\n\n";
    else m += "NEUTRALIDAD: El usuario no siente nada especial. El vídeo es informativo pero no 'enamora'.\n\n";
    
    if (avg.arousal > 0.5) m += "ALTA ENERGÍA: El sujeto está alerta. Combinado con felicidad, es el estado ideal para cerrar una venta emocional.\n\n";
    
    m += "CONCLUSIÓN ESTRATÉGICA: ";
    if (avg.valence > 0 && avg.engagement > 0.5) return m + "El contenido está optimizado para la conversión directa.";
    return m + "Se recomienda ajustar el gancho emocional para mejorar el retorno de la inversión.";
  }

  async _capture() {
    const v = document.getElementById('video-player');
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0); return c.toDataURL('image/png');
  }

  _captureChart() {
    const c = document.getElementById('timeline-chart');
    const tc = document.createElement('canvas'); tc.width = c.width; tc.height = c.height;
    const tctx = tc.getContext('2d'); tctx.fillStyle = '#ffffff'; tctx.fillRect(0, 0, tc.width, tc.height);
    tctx.drawImage(c, 0, 0); return tc.toDataURL('image/png');
  }
}
window.addEventListener('DOMContentLoaded', () => new NeuroVisApp());
