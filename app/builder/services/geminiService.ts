"use client";

import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { Scene, VideoStyle, VideoProject } from "../types";
import { getFirstApiKey } from "../../lib/apikeyStore";

const getAI = () => {
  const apiKey = getFirstApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING: buka /settings dan isi minimal 1 API key");
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MASTER_VISUAL_LOCK = `
MASTER VISUAL LOCK — PROFESSIONAL DIORAMA MACRO PHOTOGRAPHY:
GAYA UTAMA:
Photorealistic historical miniature realism dengan efek TILT-SHIFT profesional. Visual harus terlihat seperti hasil foto makro tingkat tinggi menggunakan lensa khusus, menciptakan kesan dunia miniatur yang hidup.

SKALA & OPTIK (TILT-SHIFT):
- Gunakan SHALLOW DEPTH OF FIELD yang kuat.
- Bagian atas dan bawah frame harus BLUR (bokeh lembut) untuk memusatkan fokus pada subjek di tengah.
- Sharp focus hanya pada bidang horizontal utama (the miniature plane).
- Miniatur terlihat sangat detail namun tetap terasa kecil secara optik.

KAMERA:
- Eye-level atau slightly elevated human perspective (dokumenter).
- Lensa makro dengan detail tinggi pada tekstur fisik.
- Sudut pandang yang menciptakan rasa "berada di dalam" diorama tersebut.

LIGHTING & WARNA:
- Natural daylight dengan kontras yang sedikit ditingkatkan.
- Saturasi warna yang sedikit dinaikkan pada objek miniatur untuk memberikan kesan "physical model" yang berkualitas.
- Earthy tones (coklat tanah, hijau kusam, abu batu).

TEKSTUR & DETAIL:
- Tekstur fisik miniatur terlihat jelas: lumut, debu, retakan kayu, dan air dengan riak kristal.
- Detail kecil: kerikil acak, daun basah, lumpur, kayu tercecer, alat kerja sederhana.

MANUSIA:
- Figur manusia mini bekerja, mengamati, berjalan, memikul. Gesture natural, tidak pose.
- Ekspresi tenang, fokus, lelah, atau serius.

DILARANG:
- Jangan ada tangan manusia atau alat workshop di dalam frame.
- Jangan terlihat seperti ilustrasi digital atau 3D render glossy tanpa depth of field.
`;

const STYLE_PROMPTS: Record<VideoStyle, string> = {
  'ERA_KOLONIAL': `Indonesian Colonial Era (Hindia Belanda). Fokus pada kanal lama Batavia, arsitektur VOC lapuk, pelabuhan ramai, and infrastruktur masif. ${MASTER_VISUAL_LOCK}`,
  'SEJARAH_PERJUANGAN': `Indonesian Independence Struggle. Fokus pada taktik gerilya, hutan tropis lembap, bambu runcing, reruntuhan batu berlumut, and kerumunan warga. ${MASTER_VISUAL_LOCK}`,
  'LEGENDA_RAKYAT': `Indonesian Folklore. Fokus pada lanskap mistis nusantara, desa tradisional terpencil, and elemen mistis yang terasa sebagai miniatur fisik nyata. ${MASTER_VISUAL_LOCK}`,
  'BUDAYA_NUSANTARA': `Indonesian Cultural Heritage. Fokus pada upacara adat kolosal, pasar tradisional ramai, rumah Joglo/Gadang, and detail kostum tradisional. ${MASTER_VISUAL_LOCK}`
};

async function retryApiCall<T>(apiCall: () => Promise<T>, retries: number = 3, initialDelay: number = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      const status = error.status || error.code;
      if ((status === 429 || status === 500 || status === 503) && i < retries - 1) {
        await wait(initialDelay * Math.pow(2, i));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const findTrendingTopic = async (style: VideoStyle): Promise<string> => {
  const ai = getAI();

  const styleDescriptions: Record<VideoStyle, string> = {
    'ERA_KOLONIAL': 'peristiwa sejarah spesifik, bangunan bersejarah, atau tokoh masa Hindia Belanda/VOC yang dramatis',
    'SEJARAH_PERJUANGAN': 'momen pertempuran revolusi, taktik gerilya, atau kisah heroik pahlawan Indonesia yang jarang diketahui',
    'LEGENDA_RAKYAT': 'legenda rakyat nusantara yang mistis, asal-usul tempat, atau cerita rakyat daerah yang populer',
    'BUDAYA_NUSANTARA': 'upacara adat, ritual sakral, atau tradisi suku bangsa di Indonesia yang unik dan visual'
  };

  const prompt = `Gunakan Google Search untuk menemukan 1 topik yang sangat menarik dan viral tentang ${styleDescriptions[style]}. 
  Topik harus memiliki potensi konflik, drama, atau visual epik untuk diorama makro.
  Berikan HANYA judul pendek (maks 5 kata). Jangan ada penjelasan tambahan.`;

  const response = await retryApiCall<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  }));

  return response.text?.replace(/["']/g, "").trim() || "Misteri Gajah Mada";
};

export const generateVideoScript = async (project: VideoProject): Promise<{ scenes: Scene[] }> => {
  const ai = getAI();
  const systemInstruction = `
Kamu adalah "Director + Historian + Cinematographer" untuk serial NUSANTARA DIORAMA AI. 
Fokus kamu: VISUAL EPIC, DAHSYAT, penuh aksi, tidak sepi, tidak monoton.

TUGAS: Buat 9 panel skrip sinematik untuk: "${project.topic}".

PROSEDUR WAJIB PER PANEL:
1. NARASI: 
   - Gunakan gaya bahasa FILM DOKUMENTER yang CEPAT, LUGAS, dan MENGALUN.
   - Narasi harus terasa bercerita, bukan sekadar memberikan informasi kering.
   - DILARANG menggunakan gaya bahasa pantun, rima akhir, atau bahasa puitis yang dipaksakan.
   - PANJANG NARASI: Harus berkisar antara 25 sampai 32 kata agar durasi bicaranya pas sekitar 10-12 detik per panel. JANGAN KURANG DAN JANGAN LEBIH.
   - Fokus pada fakta mendalam, suasana saat itu, dan tensi kejadian.

2. VISUAL THESIS: Tentukan makna gambar untuk panel A (Setup) dan B (Klimaks).
3. PROMPT GENERATION:
   - Panel A (SETUP): Membangun skala & ancaman (menegangkan, ramai, detail). Wide establishing shot atau high vantage.
   - Panel B (KLIMAKS): Momen pengungkapan/konsekuensi (lebih brutal/menohok, lebih ramai, lebih dramatis). Closer dramatic shot atau low-angle action.

ATURAN "EPIC":
- JANGAN ADA FRAME SEPI. Minimal 8-20 figur manusia terlihat bekerja/berteriak/berlari/menonton/menunjuk.
- Tambahkan elemen skala: tembok benteng besar, menara raksasa, dermaga panjang, kapal uap, awan gelap, asap mesiu, debris.
- Komposisi dinamis: Diagonal lines, leading lines, framing.
- Atmosfer: Debu, kabut, asap, hujan gerimis, cahaya temaram.

GAYA VISUAL: ${MASTER_VISUAL_LOCK}

Format: JSON valid sesuai schema.`;

  const response = await retryApiCall<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                narrative: { type: Type.STRING },
                imagePromptA: { type: Type.STRING },
                imagePromptB: { type: Type.STRING },
                videoPrompt: { type: Type.STRING }
              },
              required: ["narrative", "imagePromptA", "imagePromptB", "videoPrompt"]
            }
          }
        },
        required: ["scenes"]
      }
    },
    contents: `Buat 9 panel skrip diorama makro EPIC untuk: ${project.topic}. Gaya: ${project.style}. Gunakan narasi gaya film dokumenter yang lugas, mengalir, dan berisi tepat 25-32 kata per panel untuk target durasi 12 detik.`,
  }));

  const text = response.text || '{"scenes":[]}';
  try {
    const res = JSON.parse(text);
    return {
      scenes: (res.scenes || []).map((s: any, i: number) => ({ id: `scene-${i}`, ...s }))
    };
  } catch (e) {
    throw new Error("Gagal memproses skrip.");
  }
};

export const generateSceneImage = async (prompt: string, style: VideoStyle, aspectRatio: string, refImage?: string): Promise<string> => {
  const ai = getAI();
  const stylePrompt = STYLE_PROMPTS[style];

  const visualLockInstruction = `
  EPIC SCENE RULES: 
  - NO EMPTY FRAMES. Crowded with at least 15+ tiny figurines in action.
  - SENSE OF SCALE: Large infrastructures vs small workers.
  - DOCUMENTARY STYLE: Archival photo look, slightly desaturated earthy tones.
  - TEXTURES: Wet mud, weathered wood, mossy stones, rusted iron.
  - ATMOSPHERE: Humid, smoky, dusty, or rainy Indonesian tropical vibes.
  - TILT-SHIFT EFFECT: Use professional shallow depth of field, blurred background and foreground to emphasize the macro miniature scale.
  - NO CGI GLOSSY LOOK. 
  Everything captured as a high-end realistic miniature diorama.
  `;

  const fullPrompt = `${stylePrompt}. 
  SPECIFIC SCENE: ${prompt}. 
  ${visualLockInstruction}`;

  const parts: any[] = [{ text: fullPrompt }];
  if (refImage) {
    parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: refImage } });
  }

  const response = await retryApiCall<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { imageConfig: { aspectRatio: aspectRatio as any } }
  }));

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return part.inlineData.data;
  }
  throw new Error("Gagal generate gambar.");
};

export const generateVoiceover = async (text: string): Promise<string | null> => {
  const ai = getAI();
  try {
    const response = await retryApiCall<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{
        parts: [{
          text: `Bawakan narasi dokumenter sejarah ini sebagai KARAKTER ALGENIB (Vokal Wanita yang cerdas, bersemangat, dan berwibawa). 
          Gaya bicara harus LUGAS, MENGALUN, and TIDAK HIPERBOLA. 
          Suara harus terdengar antusias namun tetap tenang, menunjukkan penguasaan materi sejarah yang mendalam. 
          Fokus pada intonasi yang mengalir lancar, memberikan penekanan pada momen-momen penting tanpa rima yang dipaksakan. 
          Teks Narasi: ${text}`
        }]
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' }
          }
        },
      },
    }));
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) {
    return null;
  }
};
