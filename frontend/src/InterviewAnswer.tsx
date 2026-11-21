import {useEffect, useRef, useState} from 'react';
import {Mic, Square} from 'lucide-react';

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {results: ArrayLike<{isFinal: boolean; 0: {transcript: string}}>; resultIndex: number}) => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function InterviewAnswer({busy}: {busy: boolean}) {
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const speechWindow = window as SpeechWindow;
  const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  useEffect(() => () => {
    const current = recognition.current;
    if (current) {
      current.onresult = null;
      current.onerror = null;
      current.onend = null;
      current.abort();
    }
  }, []);

  function start() {
    if (!Constructor || recognition.current) return;
    setError('');
    const current = new Constructor();
    recognition.current = current;
    current.lang = 'en-IN';
    current.continuous = true;
    current.interimResults = true;
    current.onresult = event => {
      let final = '';
      let draft = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) final += result[0].transcript + ' ';
        else draft += result[0].transcript;
      }
      if (final) setAnswer(previous => (previous.trimEnd() + (previous.trim() ? ' ' : '') + final.trim()).slice(0, 12000));
      setInterim(draft);
    };
    current.onerror = event => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone permission was denied. Allow microphone access in your browser and try again.',
        'service-not-allowed': 'Speech recognition is unavailable in this browser. Try Chrome or Edge.',
        'audio-capture': 'No microphone was found. Connect a microphone and try again.',
        'network': 'Speech recognition could not connect. Check your connection and try again.',
        'no-speech': 'No speech was detected. Start recording and speak clearly.',
      };
      if (event.error !== 'aborted') setError(messages[event.error] || 'Speech recognition stopped. Please try again.');
    };
    current.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim('');
    };
    try {
      current.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setError('Could not start the microphone. Please try again.');
    }
  }

  return <>
    <label>Your answer<textarea name="answer" required maxLength={12000} rows={6} value={answer}
      onChange={event => setAnswer(event.target.value)} disabled={listening || busy}/></label>
    {Constructor ? <>
      <button className="secondary" type="button" disabled={busy} onClick={() => listening ? recognition.current?.stop() : start()}>
        {listening ? <Square size={17}/> : <Mic size={17}/>}
        {listening ? 'Stop recording' : 'Speak your answer'}
      </button>
      <p className="muted">Speech is transcribed in English through your browser’s speech service. Review the text before submitting.</p>
    </> : <p className="muted">Voice input is unavailable in this browser. Open this page in Chrome or Edge to use it.</p>}
    <p role="status" aria-live="polite">{listening ? 'Listening… ' + interim : ''}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy || listening}>{busy ? 'Evaluating…' : 'Submit answer'}</button>
  </>;
}
