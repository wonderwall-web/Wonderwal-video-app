import { VideoFormat, Scene, MotionEasing } from '../types';

const getCaptionSegment = (narrative: string, progress: number): { lines: string[] } => {
  if (!narrative) return { lines: [] };
  const words = narrative.trim().split(/\s+/);
  const wordsPerSegment = 4;
  const totalSegments = Math.ceil(words.length / wordsPerSegment);
  const currentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);
  const segmentWords = words.slice(currentIdx * wordsPerSegment, currentIdx * wordsPerSegment + wordsPerSegment);
  return { lines: [segmentWords.join(" ").toUpperCase()] };
};

export const renderFullProjectToVideo = async (
  scenes: Scene[],
  format: VideoFormat
): Promise<Blob> => {
  return new Promise(async (resolve, reject) => {
    const validScenes = scenes.filter(s => s.audioData && (s.imageDataA || s.imageDataB));
    if (validScenes.length === 0) return reject(new Error("Missing assets"));

    const loadedA: HTMLImageElement[] = [];
    const loadedB: HTMLImageElement[] = [];

    for (const s of validScenes) {
      const imgA = new Image(); imgA.src = `data:image/jpeg;base64,${s.imageDataA}`; await new Promise(r => imgA.onload = r as any);
      const imgB = new Image(); imgB.src = `data:image/jpeg;base64,${s.imageDataB || s.imageDataA}`; await new Promise(r => imgB.onload = r as any);
      loadedA.push(imgA); loadedB.push(imgB);
    }

    const canvas = document.createElement('canvas');
    const width = format === 'SHORT' ? 1080 : 1920;
    const height = format === 'SHORT' ? 1920 : 1080;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const audioCtx = new AudioContext({ sampleRate: 24000 });
    const dest = audioCtx.createMediaStreamDestination();
    let accumulatedTime = 0;
    const startWallTime = audioCtx.currentTime + 0.5;

    const timings = validScenes.map(s => {
      const duration = s.audioData!.duration;
      const start = accumulatedTime;
      const source = audioCtx.createBufferSource();
      source.buffer = s.audioData!;
      source.connect(dest);
      source.start(startWallTime + start);
      accumulatedTime += duration;
      return { start, duration, end: accumulatedTime };
    });

    const ctaDuration = 4.0;
    const totalVideoTime = accumulatedTime + ctaDuration;

    const recorder = new MediaRecorder(new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]), {
      mimeType: MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm',
      videoBitsPerSecond: 12000000
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => { audioCtx.close(); resolve(new Blob(chunks, { type: recorder.mimeType })); };
    recorder.start();

    const render = () => {
      const elapsed = audioCtx.currentTime - startWallTime;
      if (elapsed >= totalVideoTime) { recorder.stop(); return; }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      if (elapsed >= 0 && elapsed < accumulatedTime) {
        let idx = timings.findIndex(t => elapsed >= t.start && elapsed < t.end);
        if (idx === -1) idx = timings.length - 1;

        const t = timings[idx];
        const prog = (elapsed - t.start) / t.duration;
        const currentImg = prog < 0.5 ? loadedA[idx] : loadedB[idx];

        ctx.drawImage(currentImg, 0, 0, width, height);

        const { lines } = getCaptionSegment(validScenes[idx].narrative, prog);
        if (lines[0]) {
          ctx.save();
          ctx.font = '900 80px "Luckiest Guy", cursive, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const y = height - 400;
          ctx.strokeStyle = 'black'; ctx.lineWidth = 20; ctx.strokeText(lines[0], width/2, y);
          ctx.fillStyle = 'white'; ctx.fillText(lines[0], width/2, y);
          ctx.restore();
        }
      } else if (elapsed >= accumulatedTime) {
        const ctaProg = (elapsed - accumulatedTime) / ctaDuration;
        ctx.fillStyle = "#fde047";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "rgba(0,0,0,0.15)";
        for (let x = 0; x < width; x += 30) {
          for (let y = 0; y < height; y += 30) {
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
          }
        }

        ctx.save();
        const scale = 1 + Math.sin(ctaProg * Math.PI * 3) * 0.08;
        ctx.translate(width/2, height/2);
        ctx.scale(scale, scale);

        ctx.font = '900 120px "Luckiest Guy", cursive, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = 'black'; ctx.lineWidth = 30;
        ctx.strokeText("FOLLOW AKU UNTUK", 0, -120);
        ctx.fillStyle = '#f472b6';
        ctx.fillText("FOLLOW AKU UNTUK", 0, -120);

        ctx.strokeText("CERITA LAIN-NYA!", 0, 120);
        ctx.fillStyle = 'white'; ctx.fillText("CERITA LAIN-NYA!", 0, 120);

        if (ctaProg > 0.2) {
          const heartScale = Math.min((ctaProg - 0.2) * 5, 1);
          ctx.font = '900 200px "Inter"';
          ctx.save();
          ctx.translate(0, 350);
          ctx.scale(heartScale, heartScale);
          ctx.fillStyle = 'red';
          ctx.fillText("❤️", 0, 0);
          ctx.restore();
        }

        ctx.restore();
      }
      requestAnimationFrame(render);
    };
    render();
  });
};
