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
  const [editingCartItemId, setEditingCartItemId] = useState(null);

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

  function editCartItem(item, navigate) {
    if (!item || !item.id) return;
    setEditingCartItemId(item.id);
    setIsOpen(false);
    if (typeof navigate === 'function') {
      navigate('/user/print', { state: { editCartItem: item } });
    }
  }

  function updateCartItem(id, options = {}, breakdown = {}) {
    if (!id) return;
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const safeOptions = {
          ...item.options,
          colorMode: options?.colorMode || item.options?.colorMode || 'BW',
          paperSize: options?.paperSize || item.options?.paperSize || 'A4',
          sides: options?.sides || item.options?.sides || 'SINGLE',
          copies: Math.max(1, parseInt(options?.copies) || item.options?.copies || 1),
          pageRange: options?.pageRange || item.options?.pageRange || 'all',
          binding: options?.binding || item.options?.binding || 'none',
          instructions: options?.instructions ?? item.options?.instructions ?? '',
          orientation: options?.orientation || item.options?.orientation || 'PORTRAIT',
        };
        return {
          ...item,
          options: safeOptions,
          breakdown: breakdown || item.breakdown || { totalAmount: 0, totalPages: 1 },
          updatedAt: new Date().toISOString(),
        };
      })
    );
    setEditingCartItemId(null);
    toast('Updated print options in cart!', 'success');
  }

  function cancelEditingCartItem() {
    setEditingCartItemId(null);
  }

  function removeFromCart(id) {
    if (editingCartItemId === id) {
      setEditingCartItemId(null);
    }
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    toast('Item removed from cart', 'info');
  }

  function clearCart() {
    setCartItems([]);
    setEditingCartItemId(null);
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
        editCartItem,
        updateCartItem,
        cancelEditingCartItem,
        editingCartItemId,
        setEditingCartItemId,
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
