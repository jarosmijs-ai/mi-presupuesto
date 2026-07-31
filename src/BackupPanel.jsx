import React, {
  useRef,
  useState
} from 'react';

import {
  exportAppBackup,
  importAppBackup
} from './dataBackup';

export default function BackupPanel() {
  const fileInputRef = useRef(null);

  const [message, setMessage] =
    useState('');

  const [status, setStatus] =
    useState('');

  function handleExport() {
    try {
      exportAppBackup();

      setStatus('success');

      setMessage(
        'Respaldo descargado correctamente.'
      );
    } catch (error) {
      console.error(error);

      setStatus('error');

      setMessage(
        'No se pudo crear el respaldo.'
      );
    }
  }

  function openImportPicker() {
    setMessage('');
    setStatus('');

    fileInputRef.current?.click();
  }

  async function handleImport(event) {
    const file =
      event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    const shouldRestore =
      window.confirm(
        'Este respaldo reemplazará los datos actuales. ¿Deseas continuar?'
      );

    if (!shouldRestore) {
      return;
    }

    try {
      const result =
        await importAppBackup(file);

      setStatus('success');

      setMessage(
        `${result.restoredKeys} elementos restaurados. Reiniciando la app...`
      );

      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error) {
      console.error(error);

      setStatus('error');

      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo restaurar el respaldo.'
      );
    }
  }

  return (
    <section className="panel backup-panel">
      <div className="panel-heading backup-heading">
        <div>
          <span className="eyebrow">
            SEGURIDAD DE DATOS
          </span>

          <h2>
            Respaldo y restauración
          </h2>

          <p>
            Guarda una copia de todos los
            datos registrados en este
            dispositivo.
          </p>
        </div>

        <div
          className="backup-status-icon"
          aria-hidden="true"
        >
          ⇩
        </div>
      </div>

      <div className="backup-actions">
        <button
          type="button"
          className="backup-button primary-backup-button"
          onClick={handleExport}
        >
          <span aria-hidden="true">
            ↓
          </span>

          <span>
            <strong>
              Crear respaldo
            </strong>

            <small>
              Descarga un archivo JSON
            </small>
          </span>
        </button>

        <button
          type="button"
          className="backup-button restore-backup-button"
          onClick={openImportPicker}
        >
          <span aria-hidden="true">
            ↑
          </span>

          <span>
            <strong>
              Restaurar respaldo
            </strong>

            <small>
              Selecciona un archivo anterior
            </small>
          </span>
        </button>

        <input
          ref={fileInputRef}
          className="backup-file-input"
          type="file"
          accept=".json,application/json"
          onChange={handleImport}
        />
      </div>

      <div className="backup-note">
        <strong>Importante:</strong>{' '}
        el respaldo incluye ingresos,
        gastos, presupuestos y
        configuraciones guardadas por la
        app.
      </div>

      {message && (
        <p
          className={`backup-message ${status}`}
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  );
}