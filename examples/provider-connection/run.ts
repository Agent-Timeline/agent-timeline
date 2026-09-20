import { createTimelineProvider } from '../../client/provider';
// This process is a separate consumer of the local HTTP provider.
const provider = createTimelineProvider({ endpoint: 'http://127.0.0.1:4318/api/generate' });
for await (const event of provider.generate()) {
  if (event.type === 'text') process.stdout.write(event.text);
  if (event.type === 'error') { console.error(event.message); process.exitCode = 1; }
}
process.stdout.write('\n');
