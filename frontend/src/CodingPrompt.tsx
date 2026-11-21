type Props = {prompt: string};

export function CodingPrompt({prompt}: Props) {
  const normalized = prompt
    .replace(/\r\n/g, '\n')
    .replace(/\b(Expected behavior|Constraints|Function signature|Task|Complexity requirement|Examples)\s*:/gi, '\n$1:\n')
    .replace(/\b(Example\s+\d+)\s*:/gi, '\n$1:\n')
    .replace(/\s+(Your solution should run\b)/gi, '\nComplexity requirement:\n$1')
    .replace(/\s+(that returns\b)/i, '\nTask:\nReturns');
  const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
  return <div className="coding-prompt">{lines.map((line, index) => {
    if (/^(Task|Constraints|Expected behavior|Function signature|Complexity requirement|Examples|Example\s+\d+):$/i.test(line)) {
      return <h4 key={index}>{line.slice(0, -1)}</h4>;
    }
    const parts = line.split(/(`[^`]+`)/g);
    return <p key={index}>{parts.map((part, i) => part.startsWith('`') && part.endsWith('`')
      ? <code key={i}>{part.slice(1, -1)}</code> : part)}</p>;
  })}</div>;
}
