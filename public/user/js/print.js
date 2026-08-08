/**
 * Printa — Print Hub Multi-Step Wizard Logic (with state persistence)
 */
let currentStep = 1;
let selectedDocs = [];
let selectedDoc = null;
let currentPricing = null;
let currentBreakdown = null;

function selectBindingCard(el, val) {
  document.querySelectorAll('.binding-card').forEach(card => card.classList.remove('selected'));
  if (el) el.classList.add('selected');
  const input = document.getElementById('opt-binding');
  if (input) input.value = val;
  recalculatePrice();
  saveWizardState();
}

document.addEventListener('DOMContentLoaded', async () => {
  setupWizardNav();
  setupUploadArea();
  setupOptionListeners();
  setupPaymentModal();
  setupDocSearch();

  await fetchPricingRules();
  await restoreWizardState();
});

function setupDocSearch() {
  const searchInput = document.getElementById('doc-search-input');
  if (!searchInput) return;
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    const items = document.querySelectorAll('#recent-docs-list > div');
    items.forEach(item => {
      const name = item.querySelector('div[style*="font-weight: 600"]');
      if (name && name.textContent.toLowerCase().includes(query)) {
        item.style.display = '';
      } else if (!query) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  });
}

async function fetchPricingRules() {
  try {
    const data = await api.get('/settings/pricing');
    currentPricing = data.pricing;
  } catch (err) {
    console.error('Failed to fetch pricing rules:', err);
  }
}

function saveWizardState() {
  if (!selectedDoc && selectedDocs.length === 0) {
    localStorage.removeItem('printa_print_draft');
    return;
  }
  const state = {
    currentStep,
    selectedDoc,
    selectedDocs,
    options: getSelectedOptions(),
  };
  localStorage.setItem('printa_print_draft', JSON.stringify(state));

  try {
    const url = new URL(window.location.href);
    if (selectedDoc) url.searchParams.set('docId', selectedDoc.id);
    url.searchParams.set('step', currentStep);
    window.history.replaceState({}, '', url.toString());
  } catch (err) {
    console.error('Failed to sync URL state:', err);
  }
}

function clearWizardState() {
  localStorage.removeItem('printa_print_draft');
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('docId');
    url.searchParams.delete('step');
    window.history.replaceState({}, '', url.pathname);
  } catch {}
}

async function restoreWizardState() {
  const params = new URLSearchParams(window.location.search);
  const docIdParam = params.get('docId');
  const stepParam = parseInt(params.get('step'));

  let savedState = null;
  try {
    const raw = localStorage.getItem('printa_print_draft');
    if (raw) savedState = JSON.parse(raw);
  } catch {}

  let docToLoad = null;

  if (docIdParam) {
    try {
      const data = await api.get(`/documents/${docIdParam}`);
      if (data.document) docToLoad = data.document;
    } catch {}
  }

  if (!docToLoad && savedState && savedState.selectedDoc) {
    docToLoad = savedState.selectedDoc;
  }

  if (savedState && Array.isArray(savedState.selectedDocs) && savedState.selectedDocs.length > 0) {
    selectedDocs = [savedState.selectedDocs[savedState.selectedDocs.length - 1]]; // Enforce single document
  } else if (docToLoad) {
    selectedDocs = [docToLoad];
  }

  if (docToLoad) {
    if (docToLoad.filePath && docToLoad.filePath.startsWith('[AUTO_DELETED]')) {
      clearWizardState();
      selectedDoc = null;
      selectedDocs = [];
      loadRecentUserDocs();
      return;
    }

    selectedDoc = docToLoad;

    const opts = (savedState && savedState.options) ? savedState.options : null;
    if (opts) {
      if (opts.colorMode) {
        const radio = document.querySelector(`input[name="colorMode"][value="${opts.colorMode}"]`);
        if (radio) radio.checked = true;
      }
      if (opts.sides) {
        const radio = document.querySelector(`input[name="sides"][value="${opts.sides}"]`);
        if (radio) radio.checked = true;
      }
      if (opts.paperSize && document.getElementById('opt-paperSize')) document.getElementById('opt-paperSize').value = opts.paperSize;
      if (opts.copies && document.getElementById('opt-copies')) document.getElementById('opt-copies').value = opts.copies;
      if (opts.pageRange && document.getElementById('opt-pageRange')) document.getElementById('opt-pageRange').value = opts.pageRange;
      if (opts.instructions && document.getElementById('opt-instructions')) document.getElementById('opt-instructions').value = opts.instructions;
      if (opts.binding) {
        const bindingVal = opts.binding;
        const input = document.getElementById('opt-binding');
        if (input) input.value = bindingVal;
        document.querySelectorAll('.binding-card').forEach(card => {
          if (card.getAttribute('onclick')?.includes(`'${bindingVal}'`)) {
            card.classList.add('selected');
          } else {
            card.classList.remove('selected');
          }
        });
      }
    }

    const targetStep = stepParam || (savedState ? savedState.currentStep : 2);
    goToStep(Math.min(3, Math.max(1, targetStep)), true);
  } else {
    loadRecentUserDocs();
  }
}

function setupWizardNav() {
  document.querySelectorAll('.wizard-step').forEach(stepEl => {
    stepEl.addEventListener('click', () => {
      const targetStep = parseInt(stepEl.dataset.step);
      if (targetStep < currentStep) {
        goToStep(targetStep);
      }
    });
  });
}

async function goToStep(stepNumber, isRestoring = false) {
  if (stepNumber === 2 && !selectedDoc && selectedDocs.length === 0) {
    if (!isRestoring) showToast('Please upload or select a document first', 'warning');
    return;
  }

  currentStep = stepNumber;

  document.querySelectorAll('.wizard-step').forEach(stepEl => {
    const s = parseInt(stepEl.dataset.step);
    stepEl.classList.remove('active', 'completed');
    if (s === currentStep) stepEl.classList.add('active');
    else if (s < currentStep) stepEl.classList.add('completed');
  });

  document.querySelectorAll('.wizard-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  const activePanel = document.getElementById(`step-panel-${stepNumber}`);
  if (activePanel) activePanel.classList.remove('hidden');

  const hero = document.querySelector('.inks-hero');
  const step2Header = document.getElementById('step2-top-header');
  if (hero) hero.style.display = (stepNumber === 1) ? 'block' : 'none';
  if (step2Header) step2Header.style.display = (stepNumber === 2) ? 'flex' : 'none';

  if (stepNumber === 2) {
    if (selectedDoc) {
      const nameEl = document.getElementById('summary-doc-name');
      const metaEl = document.getElementById('summary-doc-meta');
      const iconEl = document.getElementById('summary-doc-icon');
      if (nameEl) nameEl.textContent = selectedDoc.originalName;
      if (metaEl) {
         const sizeStr = typeof formatFileSize === 'function' ? formatFileSize(selectedDoc.fileSize) : (selectedDoc.fileSize / 1024).toFixed(1) + ' KB';
         metaEl.textContent = selectedDoc.pageCount ? `${selectedDoc.pageCount} pages • ${sizeStr}` : sizeStr;
      }
      if (iconEl && typeof getFileIcon === 'function') {
         iconEl.innerHTML = getFileIcon(selectedDoc.mimeType);
      }
    }
    renderBatchQueue();
    renderLivePreview();
    updateLivePreviewFilter();
    recalculatePrice();
  } else if (stepNumber === 3) {
    await renderFinalSummary();
  }

  if (stepNumber < 4) {
    saveWizardState();
  }
}

function setupUploadArea() {
  const dropZone = document.getElementById('wizard-upload-zone');
  const fileInput = document.getElementById('wizard-file-input');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) processWizardUpload(files);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) processWizardUpload(fileInput.files);
  });

  loadRecentUserDocs();
}

async function loadRecentUserDocs() {
  const recentList = document.getElementById('recent-docs-list');
  const recentCard = document.getElementById('recent-docs-card');
  if (!recentList) return;

  try {
    const data = await api.get('/documents?limit=5');
    if (!data.documents || data.documents.length === 0) {
      if (recentCard) recentCard.classList.add('hidden');
      return;
    }

    recentList.innerHTML = data.documents.map(doc => {
      const ext = getFileTypeLabel(doc.mimeType).toLowerCase();
      const iconColor = ext === 'pdf' ? '#DC2626' :
                        (ext === 'doc' || ext === 'docx') ? '#2563EB' :
                        (ext === 'ppt' || ext === 'pptx') ? '#EA580C' :
                        (ext === 'xls' || ext === 'xlsx') ? '#059669' :
                        (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'gif' || ext === 'svg') ? '#16A34A' :
                        ext === 'txt' ? '#0284C7' :
                        '#7C7599';
      const iconBg = ext === 'pdf' ? '#FEF2F2' :
                     (ext === 'doc' || ext === 'docx') ? '#EBF3FE' :
                     (ext === 'ppt' || ext === 'pptx') ? '#FFF6ED' :
                     (ext === 'xls' || ext === 'xlsx') ? '#ECFDF3' :
                     (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'gif' || ext === 'svg') ? '#ECFDF3' :
                     ext === 'txt' ? '#F0F9FF' :
                     '#F0EDFE';
      return `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 8px; background: var(--bg-subtle); border-radius: var(--radius-md); transition: all 200ms ease; cursor: pointer; border: 1px solid transparent;" onmouseover="this.style.borderColor='var(--border)'" onmouseout="this.style.borderColor='transparent'">
          <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${getFileIcon(doc.mimeType)}</div>
          <div style="min-width: 0; flex: 1; overflow: hidden;">
            <div style="font-weight: 600; font-size: 0.8125rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(doc.originalName)}</div>
            <div style="font-size: 0.6875rem; color: var(--text-muted); display: flex; gap: 8px; align-items: center; margin-top: 2px; flex-wrap: wrap;">
              <span>${formatFileSize(doc.fileSize)}</span>
              <span style="opacity: 0.3;">•</span>
              <span>${doc.pageCount ? doc.pageCount + ' pages' : '—'}</span>
              <span style="opacity: 0.3;">•</span>
              <span>${new Date(doc.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button class="btn btn-sm" style="border: 1.5px solid var(--accent); color: var(--accent); background: transparent; border-radius: 999px; font-weight: 600; padding: 0 16px; flex-shrink: 0; font-size: 0.75rem; height: 30px;" onclick='event.stopPropagation(); selectDocument(${JSON.stringify(doc)})'>Select</button>
          <button class="btn btn-ghost btn-sm" style="width: 28px; height: 28px; padding: 0; flex-shrink: 0; color: var(--text-muted); border-radius: 50%; display: flex; align-items: center; justify-content: center;" onclick="event.stopPropagation()">${icons.moreVertical}</button>
        </div>
      `;
    }).join('');

    if (recentCard) recentCard.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load recent documents:', err);
  }
}

function uploadFileWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    const token = api.getToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent, e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch {
          resolve({});
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          reject(new Error(res.message || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network upload error'));
    xhr.send(formData);
  });
}

async function processWizardUpload(fileInputOrList) {
  const files = Array.from(fileInputOrList);
  if (files.length === 0) return;

  const statusEl = document.getElementById('wizard-upload-status');
  if (statusEl) {
    statusEl.classList.remove('hidden');
  }

  let uploadedCount = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await uploadFileWithProgress('/api/documents/upload', formData, (percent, loaded, total) => {
        if (statusEl) {
          const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
          const mbTotal = (total / (1024 * 1024)).toFixed(1);
          statusEl.innerHTML = `
            <div style="background: var(--bg-hover); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-top: 12px; text-align: left;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8125rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                <span>Uploading ${files.length > 1 ? `(${i + 1}/${files.length}) ` : ''}${escapeHtml(file.name)}</span>
                <span style="color: var(--accent); font-weight: 700;">${percent}%</span>
              </div>
              <div style="width: 100%; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 6px;">
                <div style="width: ${percent}%; height: 100%; background: var(--accent-gradient); border-radius: 3px; transition: width 150ms ease;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
                <span>${mbLoaded} MB / ${mbTotal} MB</span>
                <span>Transferring...</span>
              </div>
            </div>
          `;
        }
      });

      uploadedCount++;
      selectedDocs = [res.document]; // Enforce single document
      selectedDoc = res.document;
    } catch (err) {
      showToast(`Failed uploading ${file.name}: ${err.message}`, 'error');
    }
  }

  if (statusEl) {
    statusEl.innerHTML = `
      <div style="padding: 10px; color: var(--success); font-weight: 600; font-size: 0.875rem; display: flex; align-items: center; justify-content: center; gap: 6px;">
        ${icons.checkCircle} ${uploadedCount} File(s) Uploaded Successfully!
      </div>
    `;
    setTimeout(() => statusEl.classList.add('hidden'), 1200);
  }

  if (uploadedCount > 0) {
    showToast(`Successfully added ${uploadedCount} file(s) to batch queue!`, 'success');
    goToStep(2);
  }
}

function selectDocument(doc) {
  selectedDocs = [doc]; // Enforce single document
  selectedDoc = doc;
  showToast(`Selected: ${doc.originalName}`, 'info');
  goToStep(2);
}

function switchPreviewDoc(docId) {
  const target = selectedDocs.find(d => d.id === docId);
  if (target) {
    selectedDoc = target;
    renderBatchQueue();
    renderLivePreview();
    updateLivePreviewFilter();
    saveWizardState();
  }
}

function removeDocFromBatch(docId) {
  selectedDocs = selectedDocs.filter(d => d.id !== docId);
  if (selectedDoc && selectedDoc.id === docId) {
    selectedDoc = selectedDocs.length > 0 ? selectedDocs[selectedDocs.length - 1] : null;
  }
  if (!selectedDoc && selectedDocs.length === 0) {
    goToStep(1);
  } else {
    renderBatchQueue();
    renderLivePreview();
    updateLivePreviewFilter();
    recalculatePrice();
    saveWizardState();
  }
}

function renderBatchQueue() {
  const container = document.getElementById('batch-queue-container');
  if (!container) return;

  if (!selectedDocs || selectedDocs.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="card card-flat" style="padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
          ${icons.folder} Batch Print Queue (${selectedDocs.length} ${selectedDocs.length > 1 ? 'Files' : 'File'})
        </div>
        <button type="button" class="btn btn-ghost btn-sm" style="font-size: 0.75rem; padding: 0 8px; color: var(--accent);" onclick="goToStep(1)">+ Add More Files</button>
      </div>

      <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
        ${selectedDocs.map(doc => `
          <div onclick="switchPreviewDoc(${doc.id})" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: var(--radius-md); border: 1px solid ${doc.id === selectedDoc.id ? 'var(--accent)' : 'var(--border)'}; background: ${doc.id === selectedDoc.id ? 'var(--accent-light)' : 'var(--bg-hover)'}; cursor: pointer; white-space: nowrap; transition: all var(--transition); flex-shrink: 0;">
            <span class="doc-icon ${getFileTypeLabel(doc.mimeType).toLowerCase()}" style="width: 22px; height: 22px; font-size: 0.625rem;">${getFileIcon(doc.mimeType)}</span>
            <span style="font-size: 0.8125rem; font-weight: 600; color: ${doc.id === selectedDoc.id ? 'var(--accent-text)' : 'var(--text-primary)'}; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(doc.originalName)}</span>
            ${selectedDocs.length > 1 ? `<span onclick="event.stopPropagation(); removeDocFromBatch(${doc.id})" style="color: var(--text-muted); font-size: 0.875rem; cursor: pointer; padding: 0 2px;" title="Remove file">&times;</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function setupOptionListeners() {
  const optionIds = ['colorMode', 'paperSize', 'sides', 'copies', 'pageRange', 'binding', 'instructions'];

  optionIds.forEach(id => {
    const el = document.getElementById(`opt-${id}`);
    if (el) {
      el.addEventListener('change', () => { recalculatePrice(); saveWizardState(); });
      el.addEventListener('input', () => { recalculatePrice(); saveWizardState(); });
    }
  });

  document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateLivePreviewFilter();
      recalculatePrice();
      saveWizardState();
    });
  });

  document.querySelectorAll('input[name="sides"]').forEach(radio => {
    radio.addEventListener('change', () => { recalculatePrice(); saveWizardState(); });
  });
}

function updateLivePreviewFilter() {
  const colorRadio = document.querySelector('input[name="colorMode"]:checked');
  const colorVal = colorRadio ? colorRadio.value : 'BW';

  const previewBox = document.getElementById('wizard-live-preview');
  const badge = document.getElementById('preview-color-mode-badge');

  if (previewBox) {
    if (colorVal === 'BW') {
      previewBox.style.filter = 'grayscale(100%) contrast(115%)';
    } else {
      previewBox.style.filter = 'none';
    }
  }

  if (badge) {
    if (colorVal === 'BW') {
      badge.className = 'badge badge-neutral';
      badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> B&W Filter Live';
    } else {
      badge.className = 'badge badge-accent';
      badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg> Full Color Live';
    }
  }
}

function getSelectedOptions() {
  const colorRadio = document.querySelector('input[name="colorMode"]:checked');
  const sidesRadio = document.querySelector('input[name="sides"]:checked');
  const orientationRadio = document.querySelector('input[name="orientation"]:checked');

  return {
    documentId: selectedDoc ? selectedDoc.id : null,
    documentIds: selectedDocs.map(d => d.id),
    colorMode: colorRadio ? colorRadio.value : 'BW',
    paperSize: document.getElementById('opt-paperSize')?.value || 'A4',
    sides: sidesRadio ? sidesRadio.value : 'SINGLE',
    orientation: orientationRadio ? orientationRadio.value : 'PORTRAIT',
    copies: parseInt(document.getElementById('opt-copies')?.value || 1),
    pageRange: document.getElementById('opt-pageRange')?.value.trim() || 'all',
    binding: document.getElementById('opt-binding')?.value || 'none',
    instructions: document.getElementById('opt-instructions')?.value.trim() || '',
    totalPages: estimateTotalPages(),
  };
}

function estimateTotalPages() {
  const range = document.getElementById('opt-pageRange')?.value.trim();
  let countPerDoc = selectedDoc && selectedDoc.pageCount ? selectedDoc.pageCount : 1;

  if (range && range.toLowerCase() !== 'all') {
    try {
      let count = 0;
      const parts = range.split(',');
      parts.forEach(p => {
        if (p.includes('-')) {
          const [start, end] = p.split('-').map(n => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            count += (end - start + 1);
          }
        } else {
          const n = parseInt(p.trim());
          if (!isNaN(n)) count += 1;
        }
      });
      countPerDoc = Math.max(1, count);
    } catch {
      // Keep existing countPerDoc
    }
  }

  return countPerDoc;
}

async function recalculatePrice() {
  const options = getSelectedOptions();

  try {
    const data = await api.post('/orders/calculate', options);
    currentBreakdown = data.breakdown;

    const maxPages = (currentPricing && currentPricing.maxPagesPerOrder) ? currentPricing.maxPagesPerOrder : 500;
    if (options.totalPages > maxPages) {
      showToast(`Warning: Total pages (${options.totalPages}) exceeds admin limit of ${maxPages} pages.`, 'warning');
    }

    const fileCount = selectedDocs.length > 0 ? selectedDocs.length : 1;
    const pageLabel = fileCount > 1 
      ? `${fileCount} files (${options.totalPages} total pg) × ${options.copies} ${options.copies > 1 ? 'copies' : 'copy'}`
      : `${options.totalPages} pg × ${options.copies} ${options.copies > 1 ? 'copies' : 'copy'}`;

    setText('calc-pages', pageLabel);
    setText('calc-rate', `₹${currentBreakdown.effectivePageRate.toFixed(2)}/pg`);
    setText('calc-print-cost', `₹${currentBreakdown.printCost.toFixed(2)}`);
    setText('calc-binding-cost', `₹${currentBreakdown.bindingCost.toFixed(2)}`);
    setText('calc-subtotal', `₹${currentBreakdown.subtotal.toFixed(2)}`);
    setText('calc-tax', `₹${currentBreakdown.tax.toFixed(2)}`);
    setText('calc-total', `₹${currentBreakdown.totalAmount.toFixed(2)}`);
    setText('step2-live-price', `₹${currentBreakdown.totalAmount.toFixed(2)}`);
  } catch (err) {
    console.error('Price calculation failed:', err);
  }
}

function renderLivePreview() {
  const previewBox = document.getElementById('wizard-live-preview');
  const titleEl = document.getElementById('preview-doc-name');

  if (!previewBox || !selectedDoc) return;

  if (titleEl) titleEl.textContent = `Live Document: ${selectedDoc.originalName}`;

  const isAutoDeleted = selectedDoc.filePath && selectedDoc.filePath.startsWith('[AUTO_DELETED]');
  if (isAutoDeleted) {
    previewBox.innerHTML = `
      <div class="preview-container-box">
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 2.25rem; margin-bottom: 12px; display: flex; justify-content: center; color: var(--warning);">${icons.shield}</div>
          <h4 style="color: var(--text-primary); margin-bottom: 4px;">File Purged for Privacy (30m Rule)</h4>
          <p style="font-size: 0.8125rem; max-width: 380px; margin: 0 auto 16px;">
            This document file was automatically deleted 30 minutes after printing for your privacy.
          </p>
          <button class="btn btn-secondary btn-sm" onclick="goToStep(1)">Upload Fresh Copy</button>
        </div>
      </div>
    `;
    return;
  }

  const token = api.getToken();
  const previewUrl = `${API_BASE}/documents/${selectedDoc.id}/preview?token=${encodeURIComponent(token)}`;

  const navControls = document.getElementById('preview-nav-controls');
  const pageIndicator = document.getElementById('preview-page-indicator');
  
  if (selectedDoc.mimeType === 'application/pdf') {
    previewBox.innerHTML = `
      <div class="preview-container-box" style="padding: 0; overflow: hidden; width: 100%;">
        <iframe src="${previewUrl}" style="width: 100%; height: 460px; border: none; border-radius: var(--radius-lg);"></iframe>
      </div>
    `;
    if (navControls) navControls.style.display = 'flex';
    if (pageIndicator) pageIndicator.textContent = selectedDoc.pageCount ? `1 / ${selectedDoc.pageCount}` : 'Preview';
  } else if (selectedDoc.mimeType.startsWith('image/')) {
    previewBox.innerHTML = `
      <div class="preview-container-box" style="padding: 16px; background: #000; display: flex; align-items: center; justify-content: center; width: 100%;">
        <img src="${previewUrl}" alt="${escapeHtml(selectedDoc.originalName)}" style="max-width: 100%; max-height: 440px; object-fit: contain; border-radius: var(--radius-md);">
      </div>
    `;
    if (navControls) navControls.style.display = 'none';
  } else if (selectedDoc.mimeType.includes('presentation') || selectedDoc.mimeType.includes('wordprocessingml') || selectedDoc.mimeType.includes('msword') || selectedDoc.mimeType.includes('vnd.ms-powerpoint')) {
    // Office Docs Viewer
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      previewBox.innerHTML = `
        <div class="preview-container-box" style="width: 100%; background: #F0EDFE; border: 1px dashed #6C47FF; border-radius: var(--radius-lg);">
          <div style="text-align: center; padding: 60px 20px; color: var(--text-primary);">
            <div style="font-size: 2.5rem; margin-bottom: 16px; display: flex; justify-content: center;">${getFileIcon(selectedDoc.mimeType)}</div>
            <h4 style="margin-bottom: 8px;">Office Document Preview</h4>
            <p style="font-size: 0.875rem; color: var(--text-muted); max-width: 400px; margin: 0 auto 16px;">
              Live visual preview for Word and PowerPoint files requires the app to be deployed to a public URL (to use Google/Microsoft viewers). 
            </p>
            <span class="badge badge-accent">Works in Production</span>
          </div>
        </div>
      `;
    } else {
      // In production, use Microsoft Office Online Viewer
      const publicUrl = window.location.origin + `/api/documents/${selectedDoc.id}/preview?token=${encodeURIComponent(token)}`;
      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`;
      
      previewBox.innerHTML = `
        <div class="preview-container-box" style="padding: 0; overflow: hidden; width: 100%;">
          <iframe src="${officeViewerUrl}" style="width: 100%; height: 460px; border: none; border-radius: var(--radius-lg);"></iframe>
        </div>
      `;
    }
    if (navControls) navControls.style.display = 'none';
  } else {
    previewBox.innerHTML = `
      <div class="preview-container-box" style="width: 100%;">
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 12px; display: flex; justify-content: center;">${getFileIcon(selectedDoc.mimeType)}</div>
          <h4 style="color: var(--text-primary); margin-bottom: 4px;">${escapeHtml(selectedDoc.originalName)}</h4>
          <p style="font-size: 0.8125rem; max-width: 360px; margin: 0 auto 12px;">Universal Document Preview Ready (${formatFileSize(selectedDoc.fileSize)}). Selected print variations will apply.</p>
          <span class="badge badge-accent">Ready for Printing</span>
        </div>
      </div>
    `;
    if (navControls) navControls.style.display = 'none';
  }
}

async function renderFinalSummary() {
  const summaryBox = document.getElementById('order-summary-details');
  if (!summaryBox || (!selectedDoc && selectedDocs.length === 0)) return;

  const options = getSelectedOptions();

  if (!currentBreakdown) {
    await recalculatePrice();
  }

  const effectivePageRate = currentBreakdown ? currentBreakdown.effectivePageRate : 2.0;
  const printCost = currentBreakdown ? currentBreakdown.printCost : 0;
  const bindingCost = currentBreakdown ? currentBreakdown.bindingCost : 0;
  const subtotal = currentBreakdown ? currentBreakdown.subtotal : 0;
  const tax = currentBreakdown ? currentBreakdown.tax : 0;
  const totalAmount = currentBreakdown ? currentBreakdown.totalAmount : 0;

  const docsToDisplay = selectedDocs.length > 0 ? selectedDocs : [selectedDoc];

  summaryBox.innerHTML = `
    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
      <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Document Overview</div>
      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
        ${docsToDisplay.map(d => `
          <div style="font-weight: 600; font-size: 0.9375rem; color: var(--text-primary); display: flex; align-items: center; gap: 8px; word-break: break-word;">
            <span class="doc-icon ${getFileTypeLabel(d.mimeType).toLowerCase()}" style="width: 24px; height: 24px; font-size: 0.625rem;">${getFileIcon(d.mimeType)}</span>
            <span>${escapeHtml(d.originalName)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.875rem; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);"><span class="text-muted">Color Mode:</span> <strong>${options.colorMode === 'COLOR' ? 'Full Color' : 'Black & White'}</strong></div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);"><span class="text-muted">Print Sides:</span> <strong>${options.sides === 'DOUBLE' ? 'Double-Sided (Duplex)' : 'Single-Sided'}</strong></div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);"><span class="text-muted">Copies:</span> <strong>${options.copies}</strong></div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);"><span class="text-muted">Page Range:</span> <strong>${options.pageRange}</strong></div>
      ${options.instructions ? `<div style="display: flex; justify-content: space-between; padding: 4px 0;"><span class="text-muted">Instructions:</span> <span>${escapeHtml(options.instructions)}</span></div>` : ''}
    </div>

    <div style="background: var(--bg-hover); padding: 18px; border-radius: var(--radius-md); font-size: 0.875rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Print Charge (${options.totalPages} pg × ${options.copies} copy @ ₹${effectivePageRate.toFixed(2)})</span>
        <strong style="color: var(--text-primary);">₹${printCost.toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Subtotal</span>
        <strong style="color: var(--text-primary);">₹${subtotal.toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed var(--border);">
        <span class="text-muted">GST (18%)</span>
        <strong style="color: var(--text-muted);">₹${tax.toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.25rem; color: var(--accent);">
        <span>Total Payable</span>
        <span>₹${totalAmount.toFixed(2)}</span>
      </div>
    </div>
  `;
}

function setupPaymentModal() {
  const modal = document.getElementById('payment-modal');
  const payBtn = document.getElementById('pay-now-btn');
  const confirmBtn = document.getElementById('confirm-simulated-pay');

  if (payBtn) payBtn.addEventListener('click', () => openPaymentModal());
  if (confirmBtn) confirmBtn.addEventListener('click', () => processSimulatedPayment());
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePaymentModal();
    });
  }
}

function openPaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.add('open');
}

function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.remove('open');
}

async function processSimulatedPayment() {
  const methodRadio = document.querySelector('input[name="payMethod"]:checked');
  const paymentMethod = methodRadio ? methodRadio.value : 'SIMULATED_UPI';
  const options = getSelectedOptions();

  const confirmBtn = document.getElementById('confirm-simulated-pay');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner"></span> Processing Payment...`;
  }

  setTimeout(async () => {
    try {
      const orderPayload = {
        documentId: options.documentId,
        colorMode: options.colorMode,
        paperSize: options.paperSize,
        sides: options.sides,
        copies: options.copies,
        pageRange: options.pageRange,
        binding: options.binding,
        instructions: options.instructions,
        paymentMethod,
      };

      const res = await api.post('/orders', orderPayload);
      clearWizardState();
      closePaymentModal();
      showToast('Payment successful! Order placed.', 'success');

      renderReceipt(res.order);
      goToStep(4);
    } catch (err) {
      showToast(err.message || 'Payment simulation failed', 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `Complete Payment`;
      }
    }
  }, 1500);
}

function renderReceipt(order) {
  const receiptBox = document.getElementById('order-receipt-content');
  if (!receiptBox) return;

  receiptBox.innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 56px; height: 56px; background: var(--success-bg); color: var(--success); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 12px;">
        ${icons.checkCircle}
      </div>
      <h2 style="font-size: 1.375rem; color: var(--text-primary);">Order Placed Successfully!</h2>
      <p class="text-muted" style="margin-top: 4px;">Order Code: <strong>${order.orderNumber}</strong></p>
    </div>

    <div class="card card-flat" style="background: var(--bg-hover); padding: 20px; border-radius: var(--radius-lg); margin-bottom: 24px; font-size: 0.875rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Document:</span>
        <strong>${escapeHtml(order.document ? order.document.originalName : 'Uploaded Document')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Status:</span>
        <span class="badge badge-accent">${order.orderStatus}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Payment Method:</span>
        <span>${order.paymentMethod.replace('SIMULATED_', '')} (PAID)</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Total Amount Paid:</span>
        <strong style="color: var(--accent); font-size: 1rem;">₹${order.totalAmount.toFixed(2)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span class="text-muted">Date & Time:</span>
        <span>${new Date(order.createdAt).toLocaleString('en-IN')}</span>
      </div>
    </div>

    <div style="display: flex; gap: 12px; justify-content: center;">
      <a href="/user/orders" class="btn btn-primary">Track My Orders</a>
      <a href="/user/print" class="btn btn-secondary">Print Another Document</a>
    </div>
  `;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

window.triggerCalculation = recalculatePrice;
