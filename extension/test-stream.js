const { spawn } = require('child_process');

const args = [
  '-p',
  '--output-format', 'stream-json',
  '--verbose',
  '--model', 'haiku',
  '--no-session-persistence',
  '--system-prompt', '당신은 시니어 백엔드 개발자입니다. 한 문장으로만 답변하세요.',
  'Next.js vs Remix 어떤 걸 추천하나요?'
];

const proc = spawn('claude', args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });

let buffer = '';
let lastText = '';
let gotDelta = false;

proc.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }

    if (event.type === 'assistant' && event.message && event.message.content) {
      for (const block of event.message.content) {
        if (block.type === 'text' && block.text && block.text.length > lastText.length) {
          const delta = block.text.slice(lastText.length);
          lastText = block.text;
          process.stdout.write(delta);
          gotDelta = true;
        }
      }
    }

    if (event.type === 'result') {
      console.log('\n--- STREAM OK ---');
      console.log('tokens:', event.usage && event.usage.input_tokens, 'in /', event.usage && event.usage.output_tokens, 'out');
    }
  }
});

proc.on('close', (code) => {
  console.log('exit:', code, '| deltas:', gotDelta);
});
