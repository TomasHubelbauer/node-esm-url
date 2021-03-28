import delay from 'https://raw.githubusercontent.com/TomasHubelbauer/esm-delay/main/index.js';

void async function () {
  console.log('Watch the delay:');
  await delay(1000);
  console.log('A second later…');
}()
