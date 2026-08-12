import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '../components/Toaster.jsx';

const CART_KEY = 'inks_print_cart';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const toast = useToast();
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved ? JSON.parse(saved) : [];
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

  function addToCart(doc, options, breakdown) {
    if (!doc || !doc.id) return;
    const newItem = {
      id: `${doc.id}-${Date.now()}`,
      doc,
      options: { ...options },
      breakdown,
      addedAt: new Date().toISOString(),
    };

    setCartItems((prev) => [...prev, newItem]);
    toast(`Added "${doc.originalName}" to print cart!`, 'success');
  }

  function removeFromCart(id) {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    toast('Item removed from cart', 'info');
  }

  function clearCart() {
    setCartItems([]);
    localStorage.removeItem(CART_KEY);
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
