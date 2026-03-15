class OnvifPtzPresetCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._presets = [];
    this._editMode = false;
    this._loading = false;
    this._error = null;
    this._renameStatus = {}; // token -> status string
    this._presetsLoaded = false;
  }

  static getConfigElement() {
    return document.createElement('onvif-ptz-preset-card-editor');
  }

  static getStubConfig() {
    return { entity: '', title: 'PTZ Presets' };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this._config = { title: 'PTZ Presets', ...config };
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._presetsLoaded) {
      this._presetsLoaded = true;
      this._loadPresets();
    } else {
      this._render();
    }
  }

  getCardSize() {
    if (this._editMode) {
      return 2 + this._presets.length;
    }
    return 2 + Math.ceil(this._presets.length / 3);
  }

  async _loadPresets() {
    if (!this._hass || !this._config.entity) return;
    this._loading = true;
    this._error = null;
    this._render();

    try {
      const result = await this._hass.callService(
        'onvif_ptz', 'ptz_get_presets', {},
        { entity_id: [this._config.entity] },
        false, true
      );
      const entityResp = result.response || result;
      // Response structure: keyed by entity_id, or direct
      if (entityResp[this._config.entity]) {
        this._presets = entityResp[this._config.entity].presets || [];
      } else if (entityResp.presets) {
        this._presets = entityResp.presets;
      } else {
        this._presets = [];
      }
    } catch (err) {
      this._error = `Failed to load presets: ${err.message || err}`;
      this._presets = [];
    }
    this._loading = false;
    this._render();
  }

  async _gotoPreset(token) {
    this._loading = true;
    this._render();
    try {
      await this._hass.callService(
        'onvif_ptz', 'ptz_goto_preset',
        { preset: token },
        { entity_id: [this._config.entity] }
      );
    } catch (err) {
      this._error = `Go to preset failed: ${err.message || err}`;
    }
    this._loading = false;
    this._render();
  }

  async _savePosition(token, name) {
    this._loading = true;
    this._render();
    try {
      const data = { preset: token };
      if (name) data.name = name;
      await this._hass.callService(
        'onvif_ptz', 'ptz_set_preset', data,
        { entity_id: [this._config.entity] }
      );
      await this._loadPresets();
    } catch (err) {
      this._error = `Save position failed: ${err.message || err}`;
      this._loading = false;
      this._render();
    }
  }

  async _renamePreset(token, newName) {
    this._renameStatus[token] = 'Moving to preset...';
    this._render();
    try {
      // Step 1: Go to preset position
      await this._hass.callService(
        'onvif_ptz', 'ptz_goto_preset',
        { preset: token },
        { entity_id: [this._config.entity] }
      );
      // Step 2: Wait for camera to arrive
      await new Promise(r => setTimeout(r, 2000));
      this._renameStatus[token] = 'Saving...';
      this._render();
      // Step 3: Set preset with new name at current (recalled) position
      await this._hass.callService(
        'onvif_ptz', 'ptz_set_preset',
        { preset: token, name: newName },
        { entity_id: [this._config.entity] }
      );
      delete this._renameStatus[token];
      await this._loadPresets();
    } catch (err) {
      delete this._renameStatus[token];
      this._error = `Rename failed: ${err.message || err}`;
      this._render();
    }
  }

  async _deletePreset(token) {
    if (!confirm(`Delete preset "${token}"?`)) return;
    this._loading = true;
    this._render();
    try {
      await this._hass.callService(
        'onvif_ptz', 'ptz_remove_preset',
        { preset: token },
        { entity_id: [this._config.entity] }
      );
      await this._loadPresets();
    } catch (err) {
      this._error = `Delete failed: ${err.message || err}`;
      this._loading = false;
      this._render();
    }
  }

  async _addNewPreset(name) {
    this._loading = true;
    this._render();
    try {
      const data = {};
      if (name) data.name = name;
      await this._hass.callService(
        'onvif_ptz', 'ptz_set_preset', data,
        { entity_id: [this._config.entity] }
      );
      await this._loadPresets();
    } catch (err) {
      this._error = `Add preset failed: ${err.message || err}`;
      this._loading = false;
      this._render();
    }
  }

  _toggleEditMode() {
    this._editMode = !this._editMode;
    this._renameStatus = {};
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;

    const stateObj = this._hass.states[this._config.entity];
    const unavailable = !stateObj || stateObj.state === 'unavailable';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          padding: 16px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .title {
          font-size: 18px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .header-actions {
          display: flex;
          gap: 4px;
        }
        .icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--primary-text-color);
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          transition: opacity 0.2s, background 0.2s;
        }
        .icon-btn:hover {
          opacity: 1;
          background: var(--secondary-background-color, rgba(0,0,0,0.05));
        }
        .icon-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }
        .icon-btn svg {
          width: 20px;
          height: 20px;
          fill: currentColor;
        }
        .error {
          background: var(--error-color, #db4437);
          color: #fff;
          padding: 8px 12px;
          border-radius: 8px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }
        .error button {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          font-size: 16px;
          padding: 0 0 0 8px;
          opacity: 0.8;
        }
        .error button:hover {
          opacity: 1;
        }
        .unavailable {
          text-align: center;
          color: var(--secondary-text-color);
          padding: 16px;
          font-size: 14px;
        }
        .preset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 8px;
        }
        .preset-btn {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border: none;
          border-radius: 8px;
          padding: 12px 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          text-align: center;
          word-break: break-word;
          transition: opacity 0.2s, transform 0.1s;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .preset-btn:hover {
          opacity: 0.85;
        }
        .preset-btn:active {
          transform: scale(0.96);
        }
        .preset-btn:disabled {
          opacity: 0.5;
          cursor: default;
          transform: none;
        }
        .edit-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .edit-row {
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          padding: 12px;
        }
        .edit-row-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .edit-row-label {
          font-weight: 500;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .edit-row-token {
          font-size: 11px;
          color: var(--secondary-text-color);
          margin-left: 8px;
        }
        .edit-row-actions {
          display: flex;
          gap: 4px;
        }
        .action-btn {
          background: var(--secondary-background-color, #f5f5f5);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 6px;
          padding: 4px 10px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        }
        .action-btn:hover {
          background: var(--divider-color, #e0e0e0);
        }
        .action-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .action-btn.danger {
          color: var(--error-color, #db4437);
        }
        .action-btn.danger:hover {
          background: var(--error-color, #db4437);
          color: #fff;
        }
        .rename-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .rename-row input {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 6px;
          font-size: 13px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          outline: none;
        }
        .rename-row input:focus {
          border-color: var(--primary-color);
        }
        .rename-status {
          font-size: 12px;
          color: var(--primary-color);
          font-style: italic;
          margin-top: 4px;
        }
        .add-row {
          border: 2px dashed var(--divider-color, #e0e0e0);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .add-row input {
          flex: 1;
          padding: 8px 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 6px;
          font-size: 13px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          outline: none;
        }
        .add-row input:focus {
          border-color: var(--primary-color);
        }
        .add-btn {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          transition: opacity 0.2s;
        }
        .add-btn:hover {
          opacity: 0.85;
        }
        .add-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .empty {
          text-align: center;
          color: var(--secondary-text-color);
          padding: 24px 16px;
          font-size: 14px;
        }
        .loading-bar {
          height: 2px;
          background: var(--primary-color);
          border-radius: 1px;
          margin-bottom: 8px;
          animation: loading 1.2s ease-in-out infinite;
        }
        @keyframes loading {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      </style>
      <ha-card>
        ${this._loading ? '<div class="loading-bar"></div>' : ''}
        <div class="header">
          <span class="title">${this._config.title || 'PTZ Presets'}</span>
          <div class="header-actions">
            <button class="icon-btn" id="refresh-btn" title="Refresh" ${this._loading ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button class="icon-btn" id="edit-btn" title="${this._editMode ? 'Done' : 'Edit'}" ${this._loading && !this._editMode ? 'disabled' : ''}>
              ${this._editMode
                ? '<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>'
                : '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.001 1.001 0 0 0 0-1.41l-2.34-2.34a1.001 1.001 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'
              }
            </button>
          </div>
        </div>
        ${this._error ? `
          <div class="error">
            <span>${this._error}</span>
            <button id="dismiss-error">&times;</button>
          </div>
        ` : ''}
        ${unavailable ? '<div class="unavailable">Entity unavailable</div>' : this._renderContent()}
      </ha-card>
    `;

    // Attach event listeners
    this.shadowRoot.getElementById('refresh-btn')?.addEventListener('click', () => this._loadPresets());
    this.shadowRoot.getElementById('edit-btn')?.addEventListener('click', () => this._toggleEditMode());
    this.shadowRoot.getElementById('dismiss-error')?.addEventListener('click', () => {
      this._error = null;
      this._render();
    });

    if (!unavailable) {
      this._attachContentListeners();
    }
  }

  _renderContent() {
    if (this._editMode) {
      return this._renderEditMode();
    }
    return this._renderNormalMode();
  }

  _renderNormalMode() {
    if (this._presets.length === 0 && !this._loading) {
      return '<div class="empty">No presets found</div>';
    }
    const buttons = this._presets.map((p, i) => {
      const label = p.name || p.token;
      return `<button class="preset-btn" data-goto-idx="${i}" ${this._loading ? 'disabled' : ''}>${this._escapeHtml(label)}</button>`;
    }).join('');
    return `<div class="preset-grid">${buttons}</div>`;
  }

  _renderEditMode() {
    const rows = this._presets.map((p, i) => {
      const label = p.name || p.token;
      const status = this._renameStatus[p.token];
      const hasStatus = !!status;
      return `
        <div class="edit-row">
          <div class="edit-row-header">
            <span>
              <span class="edit-row-label">${this._escapeHtml(label)}</span>
              <span class="edit-row-token">${this._escapeHtml(p.token)}</span>
            </span>
            <div class="edit-row-actions">
              <button class="action-btn" data-rename-idx="${i}" ${hasStatus ? 'disabled' : ''}>Rename</button>
              <button class="action-btn" data-savepos-idx="${i}" ${this._loading || hasStatus ? 'disabled' : ''}>Save Pos</button>
              <button class="action-btn danger" data-delete-idx="${i}" ${this._loading || hasStatus ? 'disabled' : ''}>Delete</button>
            </div>
          </div>
          <div class="rename-row">
            <input type="text" data-rename-input="${i}" value="${this._escapeAttr(p.name || '')}" placeholder="Preset name" />
          </div>
          ${status ? `<div class="rename-status">${this._escapeHtml(status)}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="edit-list">
        ${rows}
        <div class="add-row">
          <input type="text" id="new-preset-name" placeholder="New preset name (optional)" />
          <button class="add-btn" id="add-preset-btn" ${this._loading ? 'disabled' : ''}>+ Add</button>
        </div>
      </div>
    `;
  }

  _attachContentListeners() {
    // Normal mode: goto preset buttons
    this.shadowRoot.querySelectorAll('[data-goto-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.gotoIdx);
        this._gotoPreset(this._presets[idx].token);
      });
    });

    // Edit mode: rename buttons
    this.shadowRoot.querySelectorAll('[data-rename-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.renameIdx);
        const input = this.shadowRoot.querySelector(`[data-rename-input="${idx}"]`);
        const newName = input?.value?.trim();
        if (!newName) return;
        const preset = this._presets[idx];
        if (newName === preset.name) return;
        this._renamePreset(preset.token, newName);
      });
    });

    // Edit mode: save position buttons
    this.shadowRoot.querySelectorAll('[data-savepos-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.saveposIdx);
        const preset = this._presets[idx];
        this._savePosition(preset.token, preset.name);
      });
    });

    // Edit mode: delete buttons
    this.shadowRoot.querySelectorAll('[data-delete-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.deleteIdx);
        this._deletePreset(this._presets[idx].token);
      });
    });

    // Edit mode: add new preset
    this.shadowRoot.getElementById('add-preset-btn')?.addEventListener('click', () => {
      const input = this.shadowRoot.getElementById('new-preset-name');
      this._addNewPreset(input?.value?.trim() || '');
    });
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

class OnvifPtzPresetCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        .editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px 0;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        label {
          font-size: 13px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        input {
          padding: 8px 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          font-size: 14px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          outline: none;
        }
        input:focus {
          border-color: var(--primary-color);
        }
      </style>
      <div class="editor">
        <div class="field">
          <label>Entity (button domain)</label>
          <input type="text" id="entity" value="${this._config.entity || ''}" placeholder="button.camera_ptz_controls" />
        </div>
        <div class="field">
          <label>Title (optional)</label>
          <input type="text" id="title" value="${this._config.title || ''}" placeholder="PTZ Presets" />
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('entity')?.addEventListener('input', (e) => {
      this._config = { ...this._config, entity: e.target.value };
      this._dispatch();
    });
    this.shadowRoot.getElementById('title')?.addEventListener('input', (e) => {
      this._config = { ...this._config, title: e.target.value };
      this._dispatch();
    });
  }

  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('onvif-ptz-preset-card', OnvifPtzPresetCard);
customElements.define('onvif-ptz-preset-card-editor', OnvifPtzPresetCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'onvif-ptz-preset-card',
  name: 'ONVIF PTZ Presets',
  description: 'Manage and recall PTZ presets for ONVIF cameras',
});
