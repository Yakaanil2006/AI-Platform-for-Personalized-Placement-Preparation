import React, {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {LayoutGrid, Target as TargetIcon, Code2, ListChecks, MessageSquareText, AudioLines, BookOpenText, CalendarDays, ChartNoAxesCombined, UserRound, LogOut, Sparkles, BriefcaseBusiness, Menu, Check, Upload, GraduationCap, Search, ShieldCheck, Eye, EyeOff} from 'lucide-react';
import {api, type Catalog, type Experience, type Feedback, type Gap, type Interview, type Report, type Roadmap, type SearchResult, type Source, type User} from './api';
import './styles.css';
import {DynamicTests} from './DynamicTests';
import {InterviewAnswer} from './InterviewAnswer';
import {waitForServer} from './serverStartup';

const navigation = [
  ['overview', 'Overview', LayoutGrid], ['target', 'Resume & target', TargetIcon], ['coding', 'Coding', Code2],
  ['aptitude', 'Aptitude', ListChecks], ['communication', 'Communication', MessageSquareText],
  ['interview', 'Mock interview', AudioLines], ['experiences', 'Interview experiences', BookOpenText],
  ['roadmap', 'Learning roadmap', CalendarDays], ['report', 'Readiness report', ChartNoAxesCombined],
  ['profile', 'Profile', UserRound],
] as const;
type Page = typeof navigation[number][0];

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try {await action();} catch (failure) {setError(failure instanceof Error ? failure.message : 'Something went wrong.');}
    finally {setBusy(false);}
  }
  return {run, busy, error, clearError: () => setError('')};
}

function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));
  useEffect(() => {
    let active = true;
    setLoading(Boolean(path)); setError(''); setData(undefined);
    if (path) api<T>(path).then(value => {if (active) setData(value);})
      .catch(failure => {if (active) setError(failure.message);})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [path]);
  return {data, setData, error, loading};
}

function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
}

function Alert({text}: {text?: string}) {return text ? <p role="alert" className="error">{text}</p> : null;}
function Card({title, children, className = ''}: {title?: string; children: ReactNode; className?: string}) {
  return <section className={'card ' + className}>{title && <h2>{title}</h2>}{children}</section>;
}
function Pill({children}: {children: ReactNode}) {return <span className="pill">{children}</span>;}
function List({items}: {items?: string[]}) {return items?.length ? <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : null;}
function Logo({compact = false}: {compact?: boolean}) {return <div className="logo"><span><GraduationCap size={23}/></span><strong>{compact ? 'AI Placement Prep' : 'An Intelligent AI Platform for Personalized Placement Preparation'}</strong></div>;}
function Loading({show}: {show: boolean}) {return show ? <p role="status" className="muted">Loading…</p> : null;}

function Auth({onUser}: {onUser: (user: User) => void}) {
  const [register, setRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const action = useAction();
  return <main className="auth"><div className="auth-intro"><Logo/><div><p className="eyebrow">YOUR PLACEMENT WORKSPACE</p><h1>Build confidence for your next interview.</h1><p>Find your skill gaps, practice with an adaptive AI coach, and learn from senior interview experiences.</p></div></div>
    <div className="auth-form"><Card title={register ? 'Create your account' : 'Sign in'}>
      <form onSubmit={event => {const payload = values(event); void action.run(async () => onUser(await api<User>('/auth/' + (register ? 'register' : 'login'), 'POST', payload)));}}>
        {register && <label>Name<input name="name" autoComplete="name" required maxLength={100}/></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required/></label>
        <label htmlFor="auth-password">Password</label>
        <div className="password-field"><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required/>
          <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} aria-controls="auth-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={20} aria-hidden="true"/> : <Eye size={20} aria-hidden="true"/>}</button></div>
        {register && <label>Account type<select name="role"><option value="student">Student preparing for placements</option><option value="senior">Senior sharing experiences</option></select></label>}
        <Alert text={action.error}/><button disabled={action.busy}>{action.busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      </form>
      <button className={!register && action.error === 'No account found. Please create an account.' ? 'secondary' : 'text-button'} onClick={() => {setRegister(!register); setShowPassword(false); action.clearError();}}>{register ? 'Already have an account? Sign in' : action.error === 'No account found. Please create an account.' ? 'Create account' : 'New here? Create an account'}</button>
    </Card></div></main>;
}

function Dashboard({user, navigate}: {user: User; navigate: (page: Page) => void}) {
  const {data, error} = useLoad<Report>(user.target?.id ? '/reports/latest' : null);
  const name = user.name.split(' ')[0];
  return <>
    <section className="hero"><div><span className="hero-label"><Sparkles size={15}/> YOUR AI PLACEMENT COACH</span><h1>Welcome, {name}.</h1>
      <p>{user.target?.id ? `Preparing for ${user.target.role} at ${user.target.company}. Keep building evidence for your readiness report.` : 'Upload your resume and add a target role to get a preparation plan that reflects your skills.'}</p>
      <button onClick={() => navigate(user.target?.id ? 'roadmap' : 'target')}>{user.target?.id ? 'View learning roadmap' : 'Set up your target'}</button></div>
      <span className="hero-art" aria-hidden="true"><GraduationCap size={136} strokeWidth={0.85}/></span>
    </section>
    <Alert text={error}/>
    <div className="stats">
      <Card><span className="tile-icon"><TargetIcon size={21}/></span><p>Target company</p><strong>{user.target?.company || 'Set a target'}</strong></Card>
      <Card><span className="tile-icon teal"><ListChecks size={21}/></span><p>Readiness components</p><strong>{data?.coverage ?? 0} / 5</strong></Card>
      <Card><span className="tile-icon gold"><ChartNoAxesCombined size={21}/></span><p>Readiness score</p><strong>{data?.score == null ? 'Pending' : data.score + '%'}</strong></Card>
    </div>
    <Card title="Continue preparing"><div className="quick-links">
      {([['coding', Code2, 'Coding practice'], ['interview', AudioLines, 'Mock interview'], ['experiences', BookOpenText, 'Senior experiences'], ['report', ChartNoAxesCombined, 'Readiness report']] as const).map(([page, Icon, label]) =>
        <button className="secondary" key={page} onClick={() => navigate(page)}><Icon size={19}/>{label}</button>)}
    </div></Card>
  </>;
}

function Gaps({gaps}: {gaps?: Gap[]}) {
  if (!gaps?.length) return <p className="muted">No skill requirements to compare yet.</p>;
  return <div className="table-wrap"><table><thead><tr><th>Skill</th><th>Requirement</th><th>Evidence</th><th>Score</th></tr></thead>
    <tbody>{gaps.map(gap => <tr key={gap.topic}><td>{gap.topic}</td><td>{gap.required ? 'Required' : 'Preferred'}</td><td><Pill>{gap.status}</Pill></td><td>{gap.score ?? '—'}</td></tr>)}</tbody></table></div>;
}

function TargetSetup({user, refresh}: {user: User; refresh: () => Promise<void>}) {
  const {data: gaps, setData, error, loading} = useLoad<Gap[]>(user.target?.id ? '/skill-gaps' : null);
  const upload = useAction();
  const target = useAction();
  const analyze = useAction();
  return <><div className="columns">
    <Card title="Resume analysis"><form onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      void upload.run(async () => {await api('/resumes', 'POST', form); await refresh(); if (user.target?.id) setData(await api('/skill-gaps'));});
    }}>
      <label>Resume PDF<input type="file" name="file" accept="application/pdf,.pdf" required/></label>
      <p className="muted">Text-based PDF, up to 5 MB.</p><Alert text={upload.error}/>
      <button disabled={upload.busy}><Upload size={17}/>{upload.busy ? 'Analyzing…' : 'Analyze resume'}</button>
    </form>
      {user.resume && <div className="result"><h3>Extracted skills</h3><div className="tags">{user.resume.skills.map(skill => <Pill key={skill}>{skill}</Pill>)}</div>
        {!user.resume.skills.length && <p className="muted">No skills extracted.</p>}
        {(['education', 'projects', 'experience', 'certifications'] as const).map(key => user.resume?.[key].length ? <div key={key}><h3 className="capitalize">{key}</h3><List items={user.resume[key]}/></div> : null)}
        {user.resume.cgpa != null && <p>CGPA {user.resume.cgpa}</p>}</div>}
    </Card>
    <Card title="Target job"><form onSubmit={event => {const payload = values(event); void target.run(async () => {await api('/job-descriptions', 'POST', payload); await refresh();});}}>
      <label>Company<input name="company" defaultValue={user.target?.company} required maxLength={100} placeholder="Amazon"/></label>
      <label>Role<input name="role" defaultValue={user.target?.role} required maxLength={100} placeholder="Software Development Engineer"/></label>
      <label>Job description<textarea name="description" defaultValue={user.target?.description} required rows={5} maxLength={12000} placeholder="Paste requirements and responsibilities here"/></label>
      {user.target?.id && <p className="muted">Saving creates a new target with fresh preparation progress.</p>}
      <Alert text={target.error}/><button disabled={target.busy}>{target.busy ? 'Analyzing…' : 'Save target'}</button>
    </form>{user.target?.analysis && <div className="result"><h3>Responsibilities</h3><List items={user.target.analysis.responsibilities}/>{!user.target.analysis.responsibilities.length && <p className="muted">No responsibilities extracted.</p>}</div>}</Card>
    </div><Card title="Skill gaps"><Alert text={error || analyze.error}/><Loading show={loading}/><Gaps gaps={gaps}/>
      {user.resume && user.target?.id && <button className="secondary" disabled={analyze.busy} onClick={() => void analyze.run(async () => setData(await api('/preparation/analyze', 'POST')))}>{analyze.busy ? 'Analyzing…' : 'Reanalyze profile'}</button>}
    </Card></>;
}

function FeedbackCard({feedback, catalog}: {feedback: Feedback; catalog?: Catalog}) {
  return <Card title="Feedback"><div className="score">{feedback.score}%</div>{feedback.method && <Pill>{feedback.method}</Pill>}
    <p>{feedback.explanation}</p>
    {feedback.strengths?.length ? <><h3>Strengths</h3><List items={feedback.strengths}/></> : null}
    {feedback.improvements?.length ? <><h3>What to improve</h3><List items={feedback.improvements}/></> : null}
    {feedback.topics && <div className="tags">{Object.entries(feedback.topics).map(([topic, score]) => <Pill key={topic}>{topic} · {score}%</Pill>)}</div>}
    {feedback.results?.map(row => <p key={row.id}><strong>{row.topic} · {row.correct ? 'Correct' : 'Incorrect'}</strong><br/>{row.explanation} {catalog?.aptitude.find(item => item.id === row.id)?.choices[row.correct_choice]}</p>)}
  </Card>;
}

function StudentGuidance({answer}: {answer: string}) {
  const blocks = answer.split(/\n\s*\n/).filter(Boolean);
  return <div className="student-guidance">{blocks.map((block, index) => {
    const lines = block.split('\n');
    return <div key={index}>{lines.map((line, number) => {
      const heading = line.match(/^#{1,6}\s+(.+)/);
      if (heading) return <h3 key={number}>{heading[1].replace(/\*\*/g, '')}</h3>;
      const bullet = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)/);
      if (bullet) return <p className="guidance-item" key={number}>• {bullet[1].replace(/\*\*/g, '')}</p>;
      return line.trim() ? <p key={number}>{line.replace(/\*\*/g, '')}</p> : null;
    })}</div>;
  })}</div>;
}

function SourceLinks({sources, onOpen}: {sources: Source[]; onOpen: (id: string) => void}) {
  const unique = sources.filter((source, index) => sources.findIndex(item => item.id === source.id) === index);
  return <details className="sources"><summary>Sources ({unique.length})</summary>{unique.map(source =>
    <div key={source.id}>{source.url
        ? <a className="text-button" href={source.url} target="_blank" rel="noopener noreferrer">[{sources.findIndex(item => item.id === source.id) + 1}] {source.title}</a>
        : <button className="text-button" onClick={() => onOpen(source.id)}>{source.title}</button>}
      {source.category && <Pill>{source.category}</Pill>}
      {source.publisher && <p className="muted">{source.publisher}{source.available === false ? ' · Link only — page unavailable' : ''}</p>}
      {source.scope && <p className="muted">{source.scope}</p>}
      {source.fetched_at && <p className="muted">Retrieved {new Date(source.fetched_at).toLocaleDateString()}</p>}
      {source.sample && <Pill>Demo sample</Pill>}</div>)}</details>;

}

function ExperienceDetails({id, close}: {id: string; close: () => void}) {
  const {data, error, loading} = useLoad<Experience>('/experiences/' + id);
  return <Card title="Source experience"><button className="secondary" onClick={close}>Close source</button><Loading show={loading}/><Alert text={error}/>
    {data && <><h3>{data.title}</h3><p>{data.company} · {data.role}</p>{data.sample && <Pill>Demo sample</Pill>}<p>{data.process}</p><h3>Rounds</h3><List items={data.rounds}/><h3>Questions</h3><List items={data.questions}/><p>{data.tips}</p></>}
  </Card>;
}

function Experiences({user}: {user: User}) {
  const {data, setData, loading, error} = useLoad<Experience[]>(user.role === 'student' ? null : '/experiences');
  const search = useAction();
  const submit = useAction();
  const review = useAction();
  const [result, setResult] = useState<SearchResult>();
  const [source, setSource] = useState<string>();
  const [status, setStatus] = useState('');
  return <>
    {user.role === 'student' && <Card title="Search interview experiences"><form onSubmit={event => {
      const fields = values(event);
      void search.run(async () => {setSource(undefined); setResult(await api('/experiences/search?' + new URLSearchParams(fields as Record<string, string>)));});
    }}>
      <div className="columns"><label>Company<input name="company" defaultValue={user.target?.company || (user.demo ? 'Amazon' : '')} required maxLength={100}/></label><label>Role<input name="role" defaultValue={user.target?.role || (user.demo ? 'Software Development Engineer' : '')} required maxLength={100}/></label></div>
      <label>What would you like to know?<input name="q" required maxLength={1000} placeholder="What tree traversal questions came up?"/></label>
      <Alert text={search.error}/><button disabled={search.busy}><Search size={17}/>{search.busy ? 'Searching…' : 'Search experiences'}</button>
    </form>
      {result && <div className="result">{result.public_fallback && <p className="muted">No approved senior submissions matched. This guidance uses public references with their stated scope.</p>}
      {result.public_fallback && result.public_search_enabled === false && <p className="muted">Live public search is not configured. Only available employer guidance and candidate/community reports are shown.</p>}
      <StudentGuidance answer={result.answer}/><SourceLinks sources={result.public_fallback ? result.sources : result.citations.map(i => result.sources[i - 1]).filter(Boolean)} onOpen={setSource}/></div>}
    </Card>}
    {user.role === 'senior' && <Card title="Share an interview experience"><form onSubmit={event => {
      const form = event.currentTarget;
      const payload = values(event);
      for (const key of ['rounds','questions','topics']) {
        (payload as Record<string, unknown>)[key] = String(payload[key]).split('\n').map(value => value.trim()).filter(Boolean);
      }
      void submit.run(async () => {const entry = await api<Experience>('/experiences','POST',payload); setData([entry, ...(data || [])]); form.reset(); setStatus('Experience submitted for review.');});
    }}>
      <div className="columns"><label>Company<input name="company" required maxLength={100}/></label><label>Role<input name="role" required maxLength={100}/></label></div>
      <label>Title<input name="title" required maxLength={100}/></label><label>Recruitment process<textarea name="process" required minLength={10} maxLength={4000}/></label>
      <div className="columns">{['rounds','questions','topics'].map(key => <label key={key} className="capitalize">{key} (one per line, up to 100)<textarea name={key} required rows={3}/></label>)}</div>
      <label>Difficulty<select name="difficulty"><option>medium</option><option>easy</option><option>hard</option></select></label>
      <label>Preparation tips<textarea name="tips" maxLength={2000}/></label><Alert text={submit.error}/>
      <button disabled={submit.busy}>Submit for review</button><p role="status">{status}</p>
    </form></Card>}
    {source && <ExperienceDetails id={source} close={() => setSource(undefined)}/>}
    {user.role !== 'student' && <Card title={['moderator', 'administrator'].includes(user.role) ? 'Pending moderation' : user.role === 'senior' ? 'Your submissions' : 'Approved experiences'}>
      <Loading show={loading}/><Alert text={error || review.error}/>
      {!loading && !data?.length && <p className="muted">No experiences to display.</p>}
      {data?.map(item => <div className="list-row" key={item.id}><div><button className="text-button" onClick={() => setSource(item.id)}>{item.title}</button><p>{item.company} · {item.role}</p></div>
        <Pill>{item.sample ? 'Demo sample' : item.status}</Pill>
        {['moderator', 'administrator'].includes(user.role) && (['approved', 'rejected'] as const).map(status => <button className="secondary" key={status} disabled={review.busy} onClick={() => void review.run(async () => {
          await api('/experiences/' + item.id + '/review', 'PATCH', {status}); setData(data.filter(row => row.id !== item.id)); setSource(undefined);
        })}>{status === 'approved' ? 'Approve' : 'Reject'}</button>)}
      </div>)}
    </Card>}
  </>;
}

function MockInterview() {
  const {data, setData, loading, error} = useLoad<Interview | null>('/interviews/current');
  const action = useAction();
  const question = data?.question;
  const last = data?.turns.at(-1);
  return <>
    <Card title={question ? `Question ${(data?.turns.length || 0) + 1} of 5` : 'Adaptive mock interview'}>
      <Loading show={loading}/><Alert text={error || action.error}/>
      {!loading && !question && <>
        <p>{data?.score == null ? 'Practice five questions that adapt to your responses and draw on approved experiences when available.' : `Interview complete. Your score is ${data.score}%.`}</p>
        <button disabled={action.busy} onClick={() => void action.run(async () => {setData(await api('/interviews','POST'));})}>{action.busy ? 'Starting…' : data ? 'Start another interview' : 'Start interview'}</button>
      </>}
      {question && <><div className="tags"><Pill>{question.topic}</Pill><Pill>{question.difficulty}</Pill></div>
        <p>{question.prompt}</p>
        <form key={question.id} onSubmit={event => {const payload = values(event); void action.run(async () => {
          const result = await api<Interview>(`/interviews/${data?.id}/answer`, 'POST', {...payload, question_id: question.id}); setData(result);
        });}}><InterviewAnswer key={question.id} busy={action.busy}/></form>
      </>}
    </Card>
    {question && last && <FeedbackCard feedback={last.feedback}/>}
    {!question && data?.turns.map(turn => <details className="card" key={turn.question.id}><summary>{turn.question.topic} · {turn.feedback.score}%</summary><p>{turn.question.prompt}</p><p>{turn.answer}</p><FeedbackCard feedback={turn.feedback}/></details>)}
  </>;
}

function RoadmapView() {
  const {data, setData, loading, error} = useLoad<Roadmap | null>('/roadmaps/current');
  const action = useAction();
  return <>
    <Card title="Your four-week plan"><Loading show={loading}/><p className="muted">{data ? `${data.tasks.filter(task => task.completed).length} of ${data.tasks.length} tasks completed` : 'Generate a plan using your target requirements and available assessment evidence.'}</p>
      <Alert text={error || action.error}/><button disabled={loading || action.busy} onClick={() => void action.run(async () => setData(await api('/roadmaps/current', 'POST')))}>{action.busy ? 'Working…' : data ? 'Refresh roadmap' : 'Generate roadmap'}</button>
    </Card>
    {data && <div className="columns">{[1, 2, 3, 4].map(week => <Card key={week} title={'Week ' + week}>{data.tasks.filter(task => task.week === week).map(task =>
      <label className="task" key={task.id}><input type="checkbox" checked={task.completed} disabled={action.busy} onChange={event => {const completed = event.target.checked; void action.run(async () => setData(await api('/roadmaps/current/tasks/' + task.id, 'PATCH', {completed})));}}/>
      <span><strong>{task.topic}</strong><span>{task.activity}</span><span className="muted">{task.outcome}</span></span></label>)}</Card>)}</div>}
  </>;
}

function ReportView() {
  const {data, error, loading} = useLoad<Report>('/reports/latest');
  return <><Loading show={loading}/><Alert text={error}/>{data && <>
    <Card title="Placement readiness"><div className="score">{data.score == null ? 'Pending' : data.score + '%'}</div>
      <p>{data.coverage} of 5 components available. Scores summarize preparation evidence.</p>
      {data.components.map(item => <div key={item.kind} className="component">
        <strong className="capitalize">{item.kind.replace('_', ' ')}</strong><span>{item.weight}% weight</span><span>{item.score == null ? 'Pending' : item.score + '%'}</span>
        <progress aria-label={item.kind} max={100} value={item.score ?? 0}/></div>)}</Card>
    <Card title="Skills and evidence"><Gaps gaps={data.gaps}/></Card>
    {data.evidence.length > 0 && <Card title="Latest assessment evidence">{data.evidence.map((item, i) => <div key={i} className="list-row"><span>{item.explanation}</span><Pill>{item.score}%</Pill></div>)}</Card>}
  </>}</>;
}

function Profile({user, setUser}: {user: User; setUser: (user: User) => void}) {
  const action = useAction();
  const [saved, setSaved] = useState(false);
  return <Card title="Account details"><form onSubmit={event => {const fields = values(event); void action.run(async () => {setUser(await api('/profile','PATCH',fields)); setSaved(true);});}}>
    <label>Name<input name="name" defaultValue={user.name} required maxLength={100}/></label>
    <label>Email<input value={user.email} disabled/></label>
    <label>Program<input name="program" defaultValue={user.profile.program} maxLength={120}/></label>
    <label>Graduation year<input name="graduation" defaultValue={user.profile.graduation} maxLength={20}/></label>
    <Alert text={action.error}/><button disabled={action.busy}>Save profile</button>{saved && <p role="status">Profile saved.</p>}
  </form></Card>;
}

function ServerStartup({children}: {children: ReactNode}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void waitForServer(controller.signal).then(() => {
      if (!controller.signal.aborted) setReady(true);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not connect to the server.');
    });
    return () => controller.abort();
  }, [retry]);
  if (ready) return <>{children}</>;
  return <main className="loading"><Logo/>
    {error ? <><Alert text={error}/><button onClick={() => {setError(''); setRetry(value => value + 1);}}>Try connecting again</button></>
      : <div role="status" aria-live="polite"><h1>Starting server…</h1><p>Please wait while we connect. The first visit after inactivity can take about a minute.</p></div>}
  </main>;
}

function App() {
  const current = useLoad<User>('/profile');
  const [user, setUser] = useState<User | null>();
  const [page, setPage] = useState<Page>('overview');
  const [menu, setMenu] = useState(false);
  const logout = useAction();
  useEffect(() => {if (!current.loading && user === undefined) setUser(current.data ?? null);}, [current.loading, current.data, user]);
  function navigate(next: Page) {setPage(next); setMenu(false); window.scrollTo(0, 0);}
  function accept(next: User) {setUser(next); navigate(next.role === 'student' ? 'overview' : 'experiences');}
  if (user === undefined) return <main className="loading"><Logo/><Loading show/></main>;
  if (!user) return <Auth onUser={accept}/>;
  const actual = user.role === 'student' || page === 'profile' ? page : 'experiences';
  const nav = user.role === 'student' ? navigation : navigation.filter(([key]) => key === 'experiences' || key === 'profile');
  const title = ['moderator', 'administrator'].includes(user.role) && actual === 'experiences' ? 'Experience review' : navigation.find(([key]) => key === actual)?.[1];
  const needsTarget = ['coding', 'aptitude', 'communication', 'interview', 'roadmap', 'report'].includes(actual);
  const refresh = async () => setUser(await api<User>('/profile'));
  let body: ReactNode;
  if (needsTarget && !user.target?.id) body = <Card title="Add your target job"><p>Choose a company and role and add its job description to start this activity.</p><button onClick={() => navigate('target')}>Set up your target</button></Card>;
  else switch (actual) {
    case 'overview': body = <Dashboard user={user} navigate={navigate}/>; break;
    case 'target': body = <TargetSetup user={user} refresh={refresh}/>; break;
    case 'coding': case 'aptitude': case 'communication': body = <DynamicTests key={actual} kind={actual}/>; break;
    case 'interview': body = <MockInterview/>; break;
    case 'experiences': body = <Experiences user={user}/>; break;
    case 'roadmap': body = <RoadmapView/>; break;
    case 'report': body = <ReportView/>; break;
    case 'profile': body = <Profile user={user} setUser={setUser}/>; break;
  }
  return <div className="shell">
    <aside className={menu ? 'sidebar open' : 'sidebar'}><Logo compact/><nav aria-label="Workspace">{nav.map(([key, label, Icon]) => <button key={key} aria-current={actual === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={19}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="account"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><span className="capitalize">{user.role}</span></div></div>
      <button className="secondary" disabled={logout.busy} onClick={() => void logout.run(async () => {await api('/auth/logout','POST'); setUser(null);})}><LogOut size={17}/>Sign out</button><Alert text={logout.error}/></div>
    </aside>
    <div className="main"><header className="topbar"><button className="menu secondary" aria-label="Toggle navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={21}/></button>
      <div className="breadcrumb">{['moderator', 'administrator'].includes(user.role) ? <ShieldCheck size={19}/> : <BriefcaseBusiness size={19}/>}<span>Workspace</span><span className="slash">/</span><strong>{title}</strong></div>
      {user.demo && <Pill><Check size={14}/> Demo mode</Pill>}</header>
      <main className="content">{user.demo && <p className="demo-note">Demo mode uses simulated AI feedback and labeled sample experiences.</p>}{actual !== 'overview' && <h1 className="page-title">{title}</h1>}{body}</main>
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><ServerStartup><App/></ServerStartup></React.StrictMode>);
