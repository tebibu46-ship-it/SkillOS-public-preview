const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const revealSelector = [
  '.today-workbench > *',
  '.quiet',
  '.atlas-stats',
  '.atlas-recommendation',
  '.atlas-search-band',
  '.atlas-explore',
  '.skill-tracked',
  '.atlas-catalog-head',
  '.atlas-card',
  '.atlas-detail > *',
  '.roadmap-summary',
  '.roadmap-path > li',
  '.roadmap-context > *',
  '.goal-detail > *',
  '.action-row',
  '.evidence-card',
  '.history-panel > *',
  '.history-item',
  '.review-panel > *',
  '.recommendation-panel > *',
  '.wide-empty > .records > li',
  '.roadmap-controls',
  '.daily-plan',
  '.first-journey',
  '.skill-gap',
].join(',');

let revealObserver: IntersectionObserver | null = null;
let ambientObserver: IntersectionObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let routeArtwork: HTMLElement | null = null;
let ambientScenes: HTMLElement[] = [];
let ambientPaused = false;

function reveal(element: HTMLElement) {
  element.classList.add('is-revealed');
  revealObserver?.unobserve(element);
}

function prepareReveals(root: ParentNode) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(revealSelector));
  if (root instanceof HTMLElement && root.matches(revealSelector)) candidates.unshift(root);

  candidates.forEach((element, index) => {
    if (element.classList.contains('motion-reveal')) return;
    element.classList.add('motion-reveal');
    element.style.setProperty('--motion-order', String(Math.min(index, 5)));
    if (reducedMotion.matches || !revealObserver) reveal(element);
    else revealObserver.observe(element);
  });
}

function setAmbientState() {
  for (const scene of ambientScenes) {
    const mayMove = !ambientPaused && !reducedMotion.matches && document.visibilityState === 'visible' && scene.dataset.inView === 'true';
    scene.classList.toggle('is-ambient', mayMove);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-motion-toggle]').forEach(toggle => {
    toggle.setAttribute('aria-pressed', String(ambientPaused));
    toggle.textContent = ambientPaused ? 'Play ambient motion' : 'Pause ambient motion';
  });
}

function registerAmbientScenes(root: ParentNode) {
  const scenes = Array.from(root.querySelectorAll<HTMLElement>('.ambient-scene'));
  if (root instanceof HTMLElement && root.matches('.ambient-scene')) scenes.unshift(root);
  for (const scene of scenes) {
    if (ambientScenes.includes(scene)) continue;
    scene.dataset.inView = 'true';
    ambientScenes.push(scene);
    ambientObserver?.observe(scene);
  }
  setAmbientState();
}

export function revealEditorialSurface(root: HTMLElement) {
  root.classList.remove('editorial-enter');
  void root.offsetWidth;
  root.classList.add('editorial-enter');
  prepareReveals(root);

  if (root.id === 'today' && routeArtwork) {
    routeArtwork.classList.remove('route-journey');
    void routeArtwork.offsetWidth;
    routeArtwork.classList.add('route-journey');
  }
}

export function closeEditorialDialog(dialog: HTMLDialogElement) {
  if (!dialog.open) return;
  if (reducedMotion.matches) {
    dialog.close();
    return;
  }
  dialog.classList.add('is-closing');
  window.setTimeout(() => {
    dialog.close();
    dialog.classList.remove('is-closing');
  }, 170);
}

export function initializeEditorialMotion() {
  document.documentElement.classList.add('motion-enabled');

  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target as HTMLElement);
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    ambientObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        element.dataset.inView = String(entry.isIntersecting);
      }
      setAmbientState();
    }, { threshold: 0.25 });
  }

  routeArtwork = document.querySelector<HTMLElement>('.route-visual');
  registerAmbientScenes(document);
  document.addEventListener('click', event => {
    if ((event.target as Element | null)?.closest('[data-motion-toggle]')) {
      ambientPaused = !ambientPaused;
      setAmbientState();
    }
  });

  document.addEventListener('pointermove', event => {
    if (ambientPaused || reducedMotion.matches || event.pointerType === 'touch') return;
    const x = (event.clientX / window.innerWidth - .5) * 2;
    const y = (event.clientY / window.innerHeight - .5) * 2;
    document.documentElement.style.setProperty('--world-pointer-x', x.toFixed(3));
    document.documentElement.style.setProperty('--world-pointer-y', y.toFixed(3));
  }, { passive: true });

  prepareReveals(document);
  mutationObserver = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof HTMLElement) {
        prepareReveals(node);
        registerAmbientScenes(node);
      }
    }
  });
  mutationObserver.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', setAmbientState);
  reducedMotion.addEventListener('change', () => {
    document.querySelectorAll<HTMLElement>('.motion-reveal').forEach(element => {
      if (reducedMotion.matches) reveal(element);
      else if (!element.classList.contains('is-revealed')) revealObserver?.observe(element);
    });
    setAmbientState();
  });
  setAmbientState();
}
