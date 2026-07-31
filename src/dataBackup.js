const BACKUP_VERSION = 1;

function createBackupName() {
  const now = new Date();

  const date = now
    .toISOString()
    .slice(0, 10);

  const time = now
    .toTimeString()
    .slice(0, 8)
    .replaceAll(':', '-');

  return `mi-presupuesto-${date}-${time}.json`;
}

function readAllLocalStorage() {
  const data = {};

  for (
    let index = 0;
    index < localStorage.length;
    index += 1
  ) {
    const key = localStorage.key(index);

    if (!key) {
      continue;
    }

    data[key] = localStorage.getItem(key);
  }

  return data;
}

export function exportAppBackup() {
  const backup = {
    app: 'mi-presupuesto',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: readAllLocalStorage()
  };

  const fileContent = JSON.stringify(
    backup,
    null,
    2
  );

  const blob = new Blob(
    [fileContent],
    {
      type: 'application/json'
    }
  );

  const url = URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;
  link.download = createBackupName();

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

function validateBackup(backup) {
  if (
    !backup ||
    typeof backup !== 'object'
  ) {
    throw new Error(
      'El archivo no contiene un respaldo válido.'
    );
  }

  if (
    backup.app !== 'mi-presupuesto'
  ) {
    throw new Error(
      'Este archivo no pertenece a Mi Presupuesto.'
    );
  }

  if (
    !backup.data ||
    typeof backup.data !== 'object' ||
    Array.isArray(backup.data)
  ) {
    throw new Error(
      'El respaldo no contiene datos válidos.'
    );
  }

  return backup;
}

export async function importAppBackup(
  file
) {
  if (!file) {
    throw new Error(
      'No se seleccionó ningún archivo.'
    );
  }

  const text = await file.text();

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      'El archivo seleccionado no es un JSON válido.'
    );
  }

  const backup = validateBackup(parsed);

  const entries = Object.entries(
    backup.data
  );

  localStorage.clear();

  entries.forEach(
    ([key, value]) => {
      if (
        typeof key !== 'string' ||
        typeof value !== 'string'
      ) {
        return;
      }

      localStorage.setItem(
        key,
        value
      );
    }
  );

  return {
    restoredKeys: entries.length,
    createdAt:
      backup.createdAt || null
  };
}