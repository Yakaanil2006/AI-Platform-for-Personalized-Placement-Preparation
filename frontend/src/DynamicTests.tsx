import {useEffect, useState} from 'react';
import {api, type Feedback} from './api';
import {CodingPrompt} from './CodingPrompt';

type Question = {id: string; topic: string; prompt: string; choices: string[]};
type Test = {id: string; kind: string; language?: string | null; questions: Question[]; results: Record<string, Feedback & {correct_choice?: number}>; complete: boolean};

export function DynamicTests({kind}: {kind: 'coding' | 'aptitude' | 'communication'}) {
  const [tests, setTests] = useState<Test[]>([]);
  const [current, setCurrent] = useState<Test>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(10);
  const [aptitudeMode, setAptitudeMode] = useState("general");
  const [difficulty, setDifficulty] = useState("mixed");
  const [language, setLanguage] = useState("Python");
  useEffect(() => {
    let active = true;
    api<Test[]>('/tests').then(data => {
      if (active) {
        setTests(data);
        setCurrent(data.find(test => test.kind === kind && !test.complete));
      }
    }).catch(failure => {if (active) setError(failure.message);});
    return () => {active = false;};
  }, [kind]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try {await action();} catch (failure) {setError(failure instanceof Error ? failure.message : 'Request failed.');}
    finally {setBusy(false);}
  }
  function update(test: Test) {
    setCurrent(test);
    setTests(previous => [test, ...previous.filter(item => item.id !== test.id)]);
  }
  return <>
    <section className="card"><h2>Start a new test</h2>
      <form onSubmit={event => {event.preventDefault(); void run(async () => update(await api<Test>('/tests', 'POST', {kind, count, language, aptitude_mode: aptitudeMode, difficulty})));}}>
        <label>Number of questions<input type="number" min={1} max={50} required value={count} onChange={event => setCount(Number(event.target.value))}/></label>
        {kind === 'coding' && <label>Programming language<select value={language} onChange={event => setLanguage(event.target.value)} disabled={busy}>{['Python','Java','C++','JavaScript'].map(value => <option key={value}>{value}</option>)}</select></label>}
        {kind === 'aptitude' && <>
          <label>Test style<select value={aptitudeMode} onChange={event => setAptitudeMode(event.target.value)} disabled={busy}>
            <option value="general">General placement aptitude</option><option value="target">Target-role aptitude</option>
          </select></label>
          <label>Difficulty<select value={difficulty} onChange={event => setDifficulty(event.target.value)} disabled={busy}>
            <option value="mixed">Easy to hard</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select></label>
        </>}
        <button disabled={busy}>{busy ? 'Working…' : 'Generate new test'}</button>
      </form><p className="muted">{kind === 'aptitude' ? 'Choose 1–50 fresh quantitative, verbal, and logical reasoning questions. General practice progresses from easy to hard or uses your chosen difficulty.' : 'Choose 1–50 questions. Each new test generates a fresh set for your target role.'}</p>
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    {current && <section className="card"><h2>{current.questions.length}-question test{current.language ? " · " + current.language : ""}</h2>
      <p role="status">{Object.keys(current.results).length} of {current.questions.length} answered{current.complete ? ' · Complete' : ''}</p>
      {current.complete && <p className="score">{Math.round(Object.values(current.results).reduce((total, result) => total + result.score, 0) / current.questions.length)}%</p>}
      {current.questions.map((question, index) => {
        const result = current.results[question.id];
        return <section className="result" key={question.id}><h3>Question {index + 1} · {question.topic}</h3><>{kind === 'coding' ? <CodingPrompt prompt={question.prompt}/> : <p className="preserve">{question.prompt}</p>}</>
          {result ? <><strong>{result.score}%</strong><p>{result.explanation}</p>
            {result.correct_choice != null && <p>Correct answer · {question.choices[result.correct_choice]}</p>}
            {result.improvements?.map((text, i) => <p key={i}>{text}</p>)}</> :
          <form onSubmit={event => {
            event.preventDefault();
            const fields = Object.fromEntries(new FormData(event.currentTarget));
            const payload = kind === 'aptitude' ? {answers: {[question.id]: Number(fields.choice)}} : fields;
            void run(async () => update(await api<Test>('/tests/' + current.id + '/questions/' + question.id + '/submit', 'POST', payload)));
          }}>
            {kind === 'aptitude' ? <fieldset><legend>Select your answer</legend>{question.choices.map((choice, i) =>
              <label className="radio" key={i}><input type="radio" name="choice" value={i} required disabled={busy}/>{choice}</label>)}</fieldset> :
              <>{kind === 'coding' && <label>Language<select name="language" defaultValue={current.language || "Python"} disabled={busy}>{(current.language ? [current.language] : ['Python','Java','C++','JavaScript']).map(language => <option key={language}>{language}</option>)}</select></label>}
              <label>Your answer<textarea name="answer" required rows={6} maxLength={12000} disabled={busy}/></label></>}
            <button disabled={busy}>Submit answer</button>
          </form>}
        </section>;
      })}
    </section>}
    <section className="card"><h2>Your tests</h2>
      {!tests.some(test => test.kind === kind) && <p className="muted">Your tests will appear here.</p>}
      {tests.filter(test => test.kind === kind).map((test, index) => <div className="list-row" key={test.id}>
        <span>Test {tests.filter(test => test.kind === kind).length - index} · {test.questions.length} questions · {test.complete ? 'Complete' : 'In progress'}</span>
        <button className="secondary" disabled={busy} onClick={() => setCurrent(test)}>Open test</button>
      </div>)}
    </section>
  </>;
}
