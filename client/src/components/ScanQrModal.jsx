import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../lib/api';
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
  ArrowRight,
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
  const [delivering, setDelivering] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);

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
  }

  async function startCamera() {
    setCameraError(null);
    // Allow DOM to render scanner div
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
          () => {
            // Ignore scan parse frame misses
          }
        );
        setScanning(true);
      } catch (err) {
        console.warn('Camera start error:', err);
        setScanning(false);
        setCameraError(
          'Unable to access camera. Please check camera permissions or use manual token entry.'
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
    // Check if it is a full scan URL like https://.../scan/UUID
    if (trimmed.includes('/scan/')) {
      const parts = trimmed.split('/scan/');
      return parts[1]?.split('?')[0]?.split('#')[0] || trimmed;
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
      const res = await api.get(`/scan/${cleanToken}`);
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
    setDelivering(true);
    try {
      await api.post(`/scan/${token}/status`, { status: newStatus });
      setOrderInfo((prev) => ({ ...prev, orderStatus: newStatus }));
      if (newStatus === 'DELIVERED') {
        setDeliverySuccess(true);
      }
      if (onDelivered) onDelivered({ ...orderInfo, orderStatus: newStatus });
    } catch (err) {
      alert(err.message || `Failed to update status to ${newStatus}`);
    } finally {
      setDelivering(false);
    }
  }

  async function handleDeliver() {
    return handleStatusUpdate('DELIVERED');
  }

  function handleScanAnother() {
    resetState();
    if (activeTab === 'camera') {
      startCamera();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scan Order QR Code"
      size="md"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        {!orderInfo && !loadingOrder && !deliverySuccess && (
          <div className="flex border-b border-line pb-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'camera'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-paper-hover text-ink-muted hover:text-ink'
              }`}
            >
              <Camera size={15} /> Camera Scanner
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setActiveTab('manual');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'manual'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-paper-hover text-ink-muted hover:text-ink'
              }`}
            >
              <Search size={15} /> Enter Token / URL
            </button>
          </div>
        )}

        {/* Loading order state */}
        {loadingOrder && (
          <div className="py-12 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-ink">Loading order details...</p>
          </div>
        )}

        {/* Delivery Success State */}
        {deliverySuccess && (
          <div className="py-6 text-center space-y-4 animate-scale-in">
            <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto shadow-md shadow-teal-100">
              <Truck size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-teal-800">Order Marked as Delivered!</h3>
              <p className="text-xs text-ink-muted mt-1">
                Order <strong className="text-ink font-mono">{orderInfo?.orderNumber}</strong> status is now updated. Customer notified.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleScanAnother}
                className="btn btn-primary text-xs flex items-center gap-2"
              >
                <QrCode size={15} /> Scan Next Order
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

        {/* Order Details View (After scanning) */}
        {!loadingOrder && !deliverySuccess && orderInfo && (
          <div className="space-y-4 animate-fade-in">
            {/* Header info */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-indigo-50 border border-teal-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">Scanned Order</span>
                <p className="text-lg font-bold font-mono text-ink mt-0.5">{orderInfo.orderNumber}</p>
                <p className="text-xs text-ink-muted">{orderInfo.customer}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                orderInfo.orderStatus === 'DELIVERED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-teal-100 text-teal-800'
              }`}>
                {orderInfo.orderStatus}
              </span>
            </div>

            {/* Document specs */}
            <div className="bg-paper-sunken rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">Document:</span>
                <span className="font-semibold text-ink truncate max-w-[200px]">{orderInfo.documentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Configuration:</span>
                <span className="font-medium text-ink">
                  {orderInfo.colorMode} · {orderInfo.paperSize} · {orderInfo.sides}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Copies &amp; Pages:</span>
                <span className="font-medium text-ink">
                  {orderInfo.copies} x {orderInfo.totalPages} pages
                </span>
              </div>
            </div>

            {tokenUsed && orderInfo.orderStatus === 'DELIVERED' && (
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                <CheckCircle size={15} className="text-slate-600 shrink-0" />
                <span>This QR code has already been verified and delivered.</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 space-y-3">
              <div>
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-1.5">
                  Update Order Status:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('PROCESSING')}
                    disabled={delivering || orderInfo.orderStatus === 'PROCESSING'}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                      orderInfo.orderStatus === 'PROCESSING'
                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                        : 'bg-white border-line hover:border-amber-400 text-ink hover:bg-amber-50'
                    }`}
                  >
                    <Clock size={14} className={orderInfo.orderStatus === 'PROCESSING' ? 'text-amber-600' : 'text-ink-muted'} />
                    <span>Processing</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('PRINTED')}
                    disabled={delivering || orderInfo.orderStatus === 'PRINTED'}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                      orderInfo.orderStatus === 'PRINTED'
                        ? 'bg-purple-100 border-purple-300 text-purple-800'
                        : 'bg-white border-line hover:border-purple-400 text-ink hover:bg-purple-50'
                    }`}
                  >
                    <Package size={14} className={orderInfo.orderStatus === 'PRINTED' ? 'text-purple-600' : 'text-ink-muted'} />
                    <span>Printed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('DELIVERED')}
                    disabled={delivering || orderInfo.orderStatus === 'DELIVERED'}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                      orderInfo.orderStatus === 'DELIVERED'
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-white border-line hover:border-green-400 text-ink hover:bg-green-50'
                    }`}
                  >
                    <Truck size={14} className={orderInfo.orderStatus === 'DELIVERED' ? 'text-green-600' : 'text-ink-muted'} />
                    <span>Delivered</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleScanAnother}
                className="w-full btn btn-secondary py-2 text-xs flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Scan Another QR Code
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {!loadingOrder && orderError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
            <AlertCircle size={24} className="text-rose-500 mx-auto" />
            <div>
              <p className="text-sm font-bold text-rose-800">Scan Failed</p>
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
              Point your camera at the QR code on the printed cover slip.
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
              <Search size={14} /> Lookup Order
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
