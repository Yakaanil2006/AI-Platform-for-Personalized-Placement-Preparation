export type Target = {id: string; company: string; role: string; description: string; analysis: {required: string[]; preferred: string[]; responsibilities: string[]}};
export type Resume = {skills: string[]; projects: string[]; education: string[]; experience: string[]; certifications: string[]; cgpa: number | null};
export type User = {name: string; email: string; role: 'student' | 'senior' | 'moderator' | 'administrator'; demo: boolean; target: Target | null; resume: Resume | null; profile: {program?: string; graduation?: string}};
export type Gap = {topic: string; required: boolean; status: string; score: number | null};
export type Feedback = {score: number; explanation: string; strengths?: string[]; improvements?: string[]; topics?: Record<string, number>; method?: string; results?: {id: string; topic: string; correct: boolean; correct_choice: number; explanation: string}[]};
export type Catalog = {coding: {id: string; title: string; topic: string; prompt: string; example: string}[]; aptitude: {id: string; topic: string; prompt: string; choices: string[]}[]; communication: string};
export type Source = {id: string; title: string; excerpt: string; sample: boolean; kind?: string; url?: string; publisher?: string; category?: string; scope?: string; available?: boolean; fetched_at?: string | null};
export type Experience = {id: string; title: string; company: string; role: string; process: string; rounds: string[]; questions: string[]; topics: string[]; difficulty: string; tips: string; sample: boolean; status: string};
export type SearchResult = {answer: string; sources: Source[]; citations: number[]; public_fallback?: boolean};
export type Question = {id: string; prompt: string; topic: string; difficulty: string; sources: Source[]};
export type Interview = {id: string; question: Question | null; turns: {question: Question; answer: string; feedback: Feedback}[]; score: number | null};
export type Roadmap = {tasks: {id: string; week: number; topic: string; activity: string; outcome: string; completed: boolean}[]};
export type Report = {score: number | null; coverage: number; components: {kind: string; score: number | null; weight: number}[]; gaps: Gap[]; evidence: Feedback[]};

export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const form = data instanceof FormData;
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: data && !form ? {'Content-Type': 'application/json'} : undefined,
    body: data ? form ? data : JSON.stringify(data) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = result?.detail;
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map(item => [item.loc?.slice(1).join('.'), String(item.msg)].filter(Boolean).join(' — ')).join(' ') : 'The server could not complete the request.');
  }
  return result;
}
