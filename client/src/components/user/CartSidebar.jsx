import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, X, Trash2, ArrowRight, Layers, FileText, CheckCircle2, Wallet, Sparkles, Clock, ExternalLink } from 'lucide-react';
import { useCart } from '../../context/CartContext.jsx';
import { api } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import { useToast } from '../Toaster.jsx';
import FileTypeIcon from '../FileTypeIcon.jsx';
import Button from '../Button.jsx';

export default function CartSidebar() {
  const { cartItems, cartTotal, removeFromCart, clearCart, isOpen, setIsOpen } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [successBatch, setSuccessBatch] = useState(null);

  if (!isOpen) return null;

  async function handleCheckoutBatch() {
    if (!cartItems.length) return;
    setSubmitting(true);
    try {
      // 1. Create Batch Order
      const itemsPayload = cartItems.map((item) => ({
        documentId: item.doc.id,
        colorMode: item.options.colorMode,
        paperSize: item.options.paperSize,
        sides: item.options.sides,
        copies: item.options.copies,
        pageRange: item.options.pageRange,
        binding: item.options.binding,
        instructions: item.options.instructions,
        orientation: item.options.orientation || 'PORTRAIT',
        totalPages: item.breakdown?.totalPages || 1,
      }));

      const res = await api.post('/batch-orders', {
        items: itemsPayload,
        paymentMethod: 'WALLET',
      });

      const createdBatch = res.batch;
      const createdOrders = res.orders || [];

      // 2. Attempt Ink Wallet payment for the batch
      try {
        const payRes = await api.post('/wallet/pay-batch', { batchId: createdBatch.id });
        clearCart();
        setSuccessBatch({
          batch: payRes.batch || createdBatch,
          orders: payRes.orders || createdOrders,
          paidWithWallet: true,
        });
        toast('Batch payment successful! All print jobs sent to queue.', 'success', 4000);
      } catch (payErr) {
        // If wallet balance insufficient or wallet payment fails, route user to pay or orders
        clearCart();
        toast('Batch order created! Redirecting to orders for payment verification...', 'info', 4000);
        setIsOpen(false);
        navigate('/user/orders');
      }
    } catch (err) {
      toast(err.message || 'Batch checkout failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseSuccess() {
    setSuccessBatch(null);
    setIsOpen(false);
  }

  function handleGoToOrders() {
    setSuccessBatch(null);
    setIsOpen(false);
    navigate('/user/orders');
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/40 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-slide-in-right">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-paper-sunken">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
              <ShoppingBag size={18} />
            </span>
            <div>
              <h3 className="font-display font-bold text-ink text-base">Print Cart</h3>
              <p className="text-xs text-ink-muted">
                {successBatch ? 'Order Confirmed' : `${cartItems.length} document${cartItems.length === 1 ? '' : 's'} staged`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={successBatch ? handleCloseSuccess : () => setIsOpen(false)}
            className="h-8 w-8 rounded-full hover:bg-line/50 flex items-center justify-center text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        {successBatch ? (
          /* Success Screen */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-5 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                Batch Order Confirmed
              </span>
              <h2 className="text-xl font-display font-bold text-ink mt-2">
                #{successBatch.batch?.batchNumber || 'BATCH-ORDER'}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                Total Paid: <strong className="text-ink">₹{(successBatch.batch?.totalAmount || 0).toFixed(2)}</strong> via Ink Wallet
              </p>
            </div>

            <div className="w-full card p-4 space-y-2 text-left bg-paper-sunken border border-line text-xs">
              <div className="flex items-center justify-between text-ink font-semibold border-b border-line/60 pb-2">
                <span>Print Queue Items ({successBatch.orders?.length || 0})</span>
                <span className="text-emerald-700 font-bold">PROCESSING</span>
              </div>
              <ul className="space-y-1.5 pt-1 text-ink-muted">
                {successBatch.orders?.map((o, idx) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <span className="truncate max-w-[200px] text-ink font-medium">
                      {idx + 1}. {o.document?.originalName || o.orderNumber}
                    </span>
                    <span className="font-mono text-[11px]">₹{o.totalAmount?.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full space-y-2.5 pt-2">
              <Button type="button" block size="lg" onClick={handleGoToOrders}>
                Track All Orders <ArrowRight size={16} />
              </Button>
              <Button type="button" block variant="secondary" onClick={handleCloseSuccess}>
                Print More Documents
              </Button>
            </div>
          </div>
        ) : (
          /* Cart Item List */
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {cartItems.length === 0 ? (
              <div className="py-16 text-center text-ink-muted space-y-3">
                <ShoppingBag size={36} className="mx-auto text-line" />
                <p className="font-display font-semibold text-ink text-sm">Your print cart is empty</p>
                <p className="text-xs max-w-xs mx-auto">
                  Configure your documents in the Print Hub and click "Add to Cart" to batch print multiple documents together.
                </p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="card p-3.5 space-y-2 border border-line hover:border-line-strong transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileTypeIcon mimeType={item.doc.mimeType} size={16} boxed />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink text-xs truncate">{item.doc.originalName}</p>
                        <p className="text-[11px] text-ink-muted">
                          {item.options.colorMode === 'COLOR' ? 'Color' : 'B&W'} · {item.options.copies} cop{item.options.copies === 1 ? 'y' : 'ies'} · {item.options.paperSize}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="text-danger-faint hover:text-danger p-1 rounded transition-colors shrink-0"
                      title="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-line/60">
                    <span className="text-ink-muted">Binding: <strong className="text-ink capitalize">{item.options.binding || 'none'}</strong></span>
                    <span className="font-bold text-accent">₹{(item.breakdown?.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer Checkout */}
        {!successBatch && cartItems.length > 0 && (
          <div className="p-5 border-t border-line bg-paper-sunken space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>Items Subtotal:</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-ink text-sm pt-1 border-t border-line/60">
                <span>Total Batch Amount:</span>
                <span className="text-accent">₹{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <Button
              type="button"
              block
              size="lg"
              loading={submitting}
              loadingText="Processing Batch Payment..."
              onClick={handleCheckoutBatch}
            >
              Checkout All ({cartItems.length} Docs) <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
