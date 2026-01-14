type Profile = {
  whatIDo: string;
  profession: string;
  howIOperate: string;
};

const PROFILE_KEY = 'user_profile_v1';

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

function setStatus(message: string): void {
  const status = el<HTMLDivElement>('status');
  status.textContent = message;
}

async function loadProfile(): Promise<Profile> {
  const result = await chrome.storage.local.get([PROFILE_KEY]);
  const raw = result[PROFILE_KEY] as unknown;

  if (!raw || typeof raw !== 'object') {
    return { whatIDo: '', profession: '', howIOperate: '' };
  }

  const profile = raw as Partial<Record<keyof Profile, unknown>>;
  return {
    whatIDo: typeof profile.whatIDo === 'string' ? profile.whatIDo : '',
    profession: typeof profile.profession === 'string' ? profile.profession : '',
    howIOperate: typeof profile.howIOperate === 'string' ? profile.howIOperate : '',
  };
}

async function saveProfile(profile: Profile): Promise<void> {
  await chrome.storage.local.set({
    [PROFILE_KEY]: {
      whatIDo: profile.whatIDo,
      profession: profile.profession,
      howIOperate: profile.howIOperate,
    },
  });
}

async function clearProfile(): Promise<void> {
  await chrome.storage.local.remove([PROFILE_KEY]);
}

function getFormProfile(): Profile {
  return {
    whatIDo: el<HTMLInputElement>('whatIDo').value.trim(),
    profession: el<HTMLInputElement>('profession').value.trim(),
    howIOperate: el<HTMLTextAreaElement>('howIOperate').value.trim(),
  };
}

function setFormProfile(profile: Profile): void {
  el<HTMLInputElement>('whatIDo').value = profile.whatIDo;
  el<HTMLInputElement>('profession').value = profile.profession;
  el<HTMLTextAreaElement>('howIOperate').value = profile.howIOperate;
}

async function init(): Promise<void> {
  try {
    const profile = await loadProfile();
    setFormProfile(profile);
    setStatus(profile.whatIDo || profile.profession || profile.howIOperate ? 'Loaded saved profile.' : 'No profile saved yet.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load profile.';
    setStatus(message);
  }

  const form = el<HTMLFormElement>('profileForm');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void (async () => {
      try {
        const profile = getFormProfile();
        await saveProfile(profile);
        setStatus('Saved.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Save failed.';
        setStatus(message);
      }
    })();
  });

  el<HTMLButtonElement>('clearBtn').addEventListener('click', () => {
    void (async () => {
      try {
        await clearProfile();
        setFormProfile({ whatIDo: '', profession: '', howIOperate: '' });
        setStatus('Cleared.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Clear failed.';
        setStatus(message);
      }
    })();
  });
}

void init();
