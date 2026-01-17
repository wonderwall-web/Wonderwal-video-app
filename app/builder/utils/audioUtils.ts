export const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

let sharedContext: AudioContext | null = null;

export const getAudioContext = () => {
  if (sharedContext) return sharedContext;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  sharedContext = new AudioContextClass({ sampleRate: 24000 });
  return sharedContext;
};

export const mergeAudioBuffers = (buffers: AudioBuffer[], ctx: AudioContext): AudioBuffer | null => {
  if (buffers.length === 0) return null;

  const totalLength = buffers.reduce((acc, curr) => acc + curr.length, 0);
  const numChannels = buffers[0].numberOfChannels;
  const sampleRate = buffers[0].sampleRate;

  const output = ctx.createBuffer(numChannels, totalLength, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const outputData = output.getChannelData(channel);
    let offset = 0;
    for (const buffer of buffers) {
      if (buffer.numberOfChannels > channel) {
        outputData.set(buffer.getChannelData(channel), offset);
      } else {
        outputData.set(buffer.getChannelData(0), offset);
      }
      offset += buffer.length;
    }
  }

  return output;
};

const interleave = (inputL: Float32Array, inputR: Float32Array) => {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
};

const encodeWAVHelper = (samples: Float32Array, format: number, sampleRate: number, numChannels: number, bitDepth: number) => {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  };

  floatTo16BitPCM(view, 44, samples);
  return buffer;
};

export const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  let result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  return encodeWAVHelper(result, format, sampleRate, numChannels, bitDepth);
};
