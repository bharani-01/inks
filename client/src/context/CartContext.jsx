import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '../components/Toaster.jsx';

const CART_KEY = 'inks_print_cart';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const toast = useToast();
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => item && item.doc && item.doc.id);
    } catch {
      return [];
    }
  });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    } catch {
      /* ignore storage errors */
    }
  }, [cartItems]);

  function addToCart(doc, options = {}, breakdown = {}) {
    if (!doc || !doc.id) return;
    const safeDoc = {
      id: doc.id,
      originalName: doc.originalName || 'Document',
      fileName: doc.fileName || doc.originalName || 'doc',
      mimeType: doc.mimeType || 'application/pdf',
      fileSize: doc.fileSize || 0,
      pageCount: doc.pageCount || 1,
    };
    const safeOptions = {
      colorMode: options?.colorMode || 'BW',
      paperSize: options?.paperSize || 'A4',
      sides: options?.sides || 'SINGLE',
      copies: Math.max(1, parseInt(options?.copies) || 1),
      pageRange: options?.pageRange || 'all',
      binding: options?.binding || 'none',
      instructions: options?.instructions || '',
      orientation: options?.orientation || 'PORTRAIT',
    };
    const newItem = {
      id: `${doc.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      doc: safeDoc,
      options: safeOptions,
      breakdown: breakdown || { totalAmount: 0, totalPages: 1 },
      addedAt: new Date().toISOString(),
    };

    setCartItems((prev) => [...prev, newItem]);
    toast(`Added "${safeDoc.originalName}" to print cart!`, 'success');
  }

  function removeFromCart(id) {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    toast('Item removed from cart', 'info');
  }

  function clearCart() {
    setCartItems([]);
    try {
      localStorage.removeItem(CART_KEY);
    } catch {}
  }

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.breakdown?.totalAmount || 0), 0);
  const cartItemCount = cartItems.length;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartTotal,
        cartItemCount,
        addToCart,
        removeFromCart,
        clearCart,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
