import { init, captureError } from '@satyamx55/errsource-browser';

init({
  endpoint: 'http://localhost:4517',
  debug: true,
});

function boom(input: { items?: string[] }) {
  // throws at runtime when items is undefined
  return input.items!.map((s) => s.toUpperCase());
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <button id="crash">throw an uncaught error</button>
  <button id="reject">unhandled promise rejection</button>
  <button id="manual">caught error + captureError()</button>
`;

document.getElementById('crash')!.addEventListener('click', () => {
  boom({});
});

document.getElementById('reject')!.addEventListener('click', () => {
  void Promise.reject(new Error('nobody caught this promise'));
});

document.getElementById('manual')!.addEventListener('click', () => {
  try {
    boom({});
  } catch (err) {
    captureError(err, { where: 'manual-button' });
  }
});
