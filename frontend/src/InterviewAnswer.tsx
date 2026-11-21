import {useEffect, useRef, useState} from 'react';
import {Mic, Square} from 'lucide-react';
import {api} from './api';

type Recording = {stream: MediaStream; context: AudioContext; processor: ScriptProcessorNode; source: MediaStreamAudioSourceNode; timer?: ReturnType<typeof setTimeout>; chunks: Float32Array[]; samples: number};

function wav(recording: Recording): Blob {
  const input = new Float32Array(recording.samples);
  let offset = 0;
  for (const chunk of recording.chunks) {input.set(chunk, offset); offset += chunk.length;}
  const ratio = recording.context.sampleRate / 16000;
  const count = Math.min(960000, Math.floor(input.length / ratio));
  const bytes = new ArrayBuffer(44 + count * 2);
  const view = new DataView(bytes);
  function text(offset: number, value: string) {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  }
  text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, count * 2, true);
  for (let index = 0; index < count; index++) {
    const sample = Math.max(-1, Math.min(1, input[Math.floor(index * ratio)]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return new Blob([bytes], {type: 'audio/wav'});
}

function release(recording: Recording) {
  clearTimeout(recording.timer);
  recording.processor.onaudioprocess = null;
  recording.processor.disconnect();
  recording.source.disconnect();
  recording.stream.getTracks().forEach(track => track.stop());
  void recording.context.close();
}

export function InterviewAnswer({busy}: {busy: boolean}) {
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState<'idle' | 'starting' | 'recording' | 'transcribing'>('idle');
  const [error, setError] = useState('');
  const recording = useRef<Recording | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false; if (recording.current) release(recording.current); recording.current = null;};
  }, []);

  async function stop() {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    release(current);
    setState('transcribing');
    try {
      const form = new FormData();
      form.append('file', wav(current), 'answer.wav');
      const result = await api<{text: string}>('/interviews/transcribe', 'POST', form);
      if (mounted.current) {
        if (!result.text) setError('No speech was detected. Please try again.');
        else setAnswer(previous => (previous.trimEnd() + (previous.trim() ? ' ' : '') + result.text).slice(0, 12000));
      }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Transcription failed.');
    } finally {if (mounted.current) setState('idle');}
  }

  async function start() {
    setError(''); setState('starting');
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1}});
      if (!mounted.current) {stream.getTracks().forEach(track => track.stop()); return;}
      context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const current: Recording = {stream, context, source, processor, chunks: [], samples: 0};
      processor.onaudioprocess = event => {
        if (current.samples >= current.context.sampleRate * 60) return;
        const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
        current.chunks.push(chunk); current.samples += chunk.length;
      };
      source.connect(processor); processor.connect(context.destination);
      recording.current = current;
      current.timer = setTimeout(() => void stop(), 60000);
      setState('recording');
    } catch (failure) {
      stream?.getTracks().forEach(track => track.stop());
      if (context) void context.close();
      if (mounted.current) {
        setState('idle');
        setError(failure instanceof DOMException && failure.name === 'NotAllowedError'
          ? 'Allow microphone access in your browser to record an answer.' : 'Could not access the microphone. Check your device and browser permissions.');
      }
    }
  }

  const working = state !== 'idle';
  return <>
    <label>Your answer<textarea name="answer" required maxLength={12000} rows={6} value={answer}
      onChange={event => setAnswer(event.target.value)} disabled={working || busy}/></label>
    <button className="secondary" type="button" disabled={busy || state === 'starting' || state === 'transcribing'}
      onClick={() => void (state === 'recording' ? stop() : start())}>
      {state === 'recording' ? <Square size={17}/> : <Mic size={17}/>}
      {state === 'recording' ? 'Stop and transcribe' : 'Speak your answer'}
    </button>
    <p className="muted">Record up to 60 seconds. Audio is sent to NVIDIA for transcription. Review and edit the transcript before submitting.</p>
    <p role="status" aria-live="polite">{state === 'recording' ? 'Recording…' : state === 'transcribing' ? 'Transcribing your answer…' : state === 'starting' ? 'Opening microphone…' : ''}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy || working}>{busy ? 'Evaluating…' : 'Submit answer'}</button>
  </>;
}
