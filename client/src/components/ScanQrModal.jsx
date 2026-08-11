import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api, previewUrl } from '../lib/api';
import { formatMoney, formatDate } from '../lib/format';
import Modal from './Modal';
import {
  QrCode,
  Camera,
  CheckCircle,
  Truck,
  AlertCircle,
  RefreshCw,
  Search,
  Package,
  Layers,
  FileText,
  User,
  Clock,
  Printer,
  Copy,
  Check,
  ExternalLink,
  DollarSign,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export default function ScanQrModal({ open, onClose, onDelivered }) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [manualToken, setManualToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Order Details State
  const [token, setToken] = useState(null);
  const [orderInfo, setOrderInfo] = useState(null);
  const [tokenUsed, setTokenUsed] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);

  // Action state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const html5QrCodeRef = useRef(null);
  const scannerContainerId = 'qr-reader-viewport';

  // Handle camera start/stop
  useEffect(() => {
    if (!open) {
      stopCamera();
      resetState();
      return;
    }

    if (activeTab === 'camera' && !orderInfo && !loadingOrder && !deliverySuccess) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open, activeTab, orderInfo, loadingOrder, deliverySuccess]);

  function resetState() {
    setToken(null);
    setOrderInfo(null);
    setTokenUsed(false);
    setOrderError(null);
    setManualToken('');
    setDeliverySuccess(false);
    setCameraError(null);
    setCopied(false);
  }

  async function startCamera() {
    setCameraError(null);
    setTimeout(async () => {
      try {
        if (!document.getElementById(scannerContainerId)) return;

        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
        }

        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }

        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleQrCodeDetected(decodedText);
          },
          () => {}
        );
        setScanning(true);
      } catch (err) {
        console.warn('Camera start error:', err);
        setScanning(false);
        setCameraError(
          'Unable to access camera. Please check browser permissions or use manual token entry.'
        );
      }
    }, 150);
  }

  async function stopCamera() {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (err) {
      // Ignore stop errors
    } finally {
      setScanning(false);
    }
  }

  function extractToken(rawText) {
    if (!rawText) return '';
    const trimmed = rawText.trim();
    if (trimmed.includes('/scan/')) {
      const parts = trimmed.split('/scan/');
      return parts[1]?.split('?')[0]?.split('#')[0]?.trim() || trimmed;
    }
    return trimmed;
  }

  async function handleQrCodeDetected(decodedText) {
    const extracted = extractToken(decodedText);
    if (!extracted) return;
    await stopCamera();
    await loadOrder(extracted);
  }

  async function loadOrder(rawToken) {
    const cleanToken = extractToken(rawToken);
    if (!cleanToken) return;

    setToken(cleanToken);
    setLoadingOrder(true);
    setOrderError(null);

    try {
      const res = await api.get(`/scan/${encodeURIComponent(cleanToken)}`);
      setOrderInfo(res.order);
      setTokenUsed(res.tokenUsed);
    } catch (err) {
      setOrderError(err.message || 'QR code not found or expired');
    } finally {
      setLoadingOrder(false);
    }
  }

  async function handleStatusUpdate(newStatus) {
    if (!token) return;
    setUpdatingStatus(true);
    try {
      await api.post(`/scan/${encodeURIComponent(token)}/status`, { status: newStatus });
      setOrderInfo((prev) => (prev ? { ...prev, orderStatus: newStatus } : prev));
      if (newStatus === 'DELIVERED') {
        setDeliverySuccess(true);
      }
      if (onDelivered) onDelivered({ ...orderInfo, orderStatus: newStatus });
    } catch (err) {
      alert(err.message || `Failed to update status to ${newStatus}`);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function handleScanAnother() {
    resetState();
    if (activeTab === 'camera') {
      startCamera();
    }
  }

  function copyOrderNumber() {
    if (!orderInfo?.orderNumber) return;
    navigator.clipboard.writeText(orderInfo.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Order Verification &amp; Fulfillment Scanner"
      size="md"
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Scanner Navigation Tabs */}
        {!orderInfo && !loadingOrder && !deliverySuccess && (
          <div className="flex border-b border-line pb-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'camera'
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-paper-hover text-ink-muted hover:text-ink'
              }`}
            >
              <Camera size={14} /> Camera Scanner
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setActiveTab('manual');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'manual'
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-paper-hover text-ink-muted hover:text-ink'
              }`}
            >
              <Search size={14} /> Enter Token / Link
            </button>
          </div>
        )}

        {/* Loading order state */}
        {loadingOrder && (
          <div className="py-12 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-ink">Retrieving Order Details...</p>
            <p className="text-[11px] text-ink-muted">Verifying secure QR token</p>
          </div>
        )}

        {/* Delivery Success State */}
        {deliverySuccess && (
          <div className="py-6 text-center space-y-4 animate-scale-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Truck size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-900">Order Delivered Successfully!</h3>
              <p className="text-xs text-ink-muted mt-1">
                Order <strong className="text-ink font-mono">{orderInfo?.orderNumber}</strong> has been completed. Customer notification sent.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleScanAnother}
                className="btn btn-primary text-xs flex items-center gap-2"
              >
                <QrCode size={14} /> Scan Next Document
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary text-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Order Details & Status Operations View (After scanning) */}
        {!loadingOrder && !deliverySuccess && orderInfo && (
          <div className="space-y-4 animate-fade-in">
            {/* Header: Order badge & Status */}
            <div className="p-4 rounded-2xl bg-paper-sunken border border-line flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider bg-accent-soft px-2.5 py-0.5 rounded-full">
                  Order Details
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-base font-bold font-mono text-ink">{orderInfo.orderNumber || 'Order'}</p>
                  <button
                    type="button"
                    onClick={copyOrderNumber}
                    className="text-ink-muted hover:text-accent p-0.5"
                    title="Copy Order #"
                  >
                    {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                  <User size={12} /> {orderInfo.customer || 'Customer'}
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    orderInfo.orderStatus === 'DELIVERED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-accent-soft text-accent border border-accent/20'
                  }`}
                >
                  {orderInfo.orderStatus === 'DELIVERED' ? <CheckCircle size={13} /> : <Clock size={13} />}
                  {orderInfo.orderStatus || 'RECEIVED'}
                </span>
                {orderInfo.totalAmount !== undefined && (
                  <p className="text-xs font-bold text-ink mt-1">
                    {formatMoney(orderInfo.totalAmount)}
                  </p>
                )}
              </div>
            </div>

            {/* Document Specifications Card */}
            <div className="bg-paper-sunken rounded-2xl p-4 space-y-2.5 text-xs border border-line">
              <div className="flex justify-between items-center">
                <span className="text-ink-muted flex items-center gap-1">
                  <FileText size={13} className="text-accent" /> Document Name:
                </span>
                <span className="font-semibold text-ink truncate max-w-[200px]" title={orderInfo.documentName}>
                  {orderInfo.documentName || 'Document'}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-line/60 pt-2">
                <span className="text-ink-muted">Print Setup:</span>
                <span className="font-medium text-ink">
                  {orderInfo.colorMode === 'COLOR' ? 'Colour' : 'B&W'} · {orderInfo.paperSize || 'A4'} ·{' '}
                  {orderInfo.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'} ·{' '}
                  {orderInfo.sides === 'DOUBLE' ? 'Double sided' : 'Single sided'}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-line/60 pt-2">
                <span className="text-ink-muted">Quantity &amp; Pages:</span>
                <span className="font-medium text-ink">
                  {orderInfo.copies || 1} {orderInfo.copies === 1 ? 'copy' : 'copies'} · {orderInfo.totalPages || 1} pages
                </span>
              </div>

              {orderInfo.binding && orderInfo.binding !== 'none' && (
                <div className="flex justify-between items-center border-t border-line/60 pt-2">
                  <span className="text-ink-muted">Binding Option:</span>
                  <span className="font-medium text-ink capitalize">{orderInfo.binding}</span>
                </div>
              )}

              {orderInfo.instructions && (
                <div className="border-t border-line/60 pt-2">
                  <span className="text-ink-muted block mb-0.5">Special Instructions:</span>
                  <p className="text-ink italic bg-white/70 p-2 rounded-lg border border-line/60">
                    "{orderInfo.instructions}"
                  </p>
                </div>
              )}
            </div>

            {/* Quick Status Update Stepper */}
            <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Printer size={14} className="text-accent" /> Update Order Status:
                </span>
                <span className="text-[10px] text-ink-muted">1-Click Transition</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusUpdate('PROCESSING')}
                  disabled={updatingStatus || orderInfo.orderStatus === 'PROCESSING'}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    orderInfo.orderStatus === 'PROCESSING'
                      ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs'
                      : 'bg-paper-hover border-line hover:border-amber-400 text-ink hover:bg-amber-50/50'
                  }`}
                >
                  <Clock size={15} className={orderInfo.orderStatus === 'PROCESSING' ? 'text-amber-600' : 'text-ink-muted'} />
                  <span>Processing</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusUpdate('PRINTED')}
                  disabled={updatingStatus || orderInfo.orderStatus === 'PRINTED'}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    orderInfo.orderStatus === 'PRINTED'
                      ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-xs'
                      : 'bg-paper-hover border-line hover:border-purple-400 text-ink hover:bg-purple-50/50'
                  }`}
                >
                  <Printer size={15} className={orderInfo.orderStatus === 'PRINTED' ? 'text-purple-600' : 'text-ink-muted'} />
                  <span>Printed</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusUpdate('DELIVERED')}
                  disabled={updatingStatus || orderInfo.orderStatus === 'DELIVERED'}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    orderInfo.orderStatus === 'DELIVERED'
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-xs'
                      : 'bg-paper-hover border-line hover:border-emerald-400 text-ink hover:bg-emerald-50/50'
                  }`}
                >
                  <Truck size={15} className={orderInfo.orderStatus === 'DELIVERED' ? 'text-emerald-600' : 'text-ink-muted'} />
                  <span>Delivered</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleScanAnother}
                className="flex-1 btn btn-secondary py-2.5 text-xs flex items-center justify-center gap-2"
              >
                <RefreshCw size={13} /> Scan Another QR
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary py-2.5 text-xs px-4"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {!loadingOrder && orderError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
            <AlertCircle size={24} className="text-rose-500 mx-auto" />
            <div>
              <p className="text-sm font-bold text-rose-800">Scan Lookup Failed</p>
              <p className="text-xs text-rose-600 mt-0.5">{orderError}</p>
            </div>
            <button
              type="button"
              onClick={handleScanAnother}
              className="btn btn-secondary text-xs"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Camera Viewport */}
        {!orderInfo && !loadingOrder && !orderError && activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-line bg-black/5 min-h-[260px] flex items-center justify-center">
              <div id={scannerContainerId} className="w-full h-full" />
              {cameraError && (
                <div className="p-4 text-center text-xs text-rose-600 space-y-2">
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className="btn btn-secondary text-xs"
                  >
                    Switch to Manual Token Entry
                  </button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-ink-muted text-center">
              Point your camera at the QR code on the printed cover slip to verify and update status.
            </p>
          </div>
        )}

        {/* Manual Token Entry Tab */}
        {!orderInfo && !loadingOrder && !orderError && activeTab === 'manual' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadOrder(manualToken);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Enter QR Token or Scan Link:
              </label>
              <input
                type="text"
                placeholder="e.g. https://.../scan/UUID or UUID token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-line rounded-xl text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!manualToken.trim()}
              className="btn btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-1.5"
            >
              <Search size={14} /> Lookup Order Details
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
