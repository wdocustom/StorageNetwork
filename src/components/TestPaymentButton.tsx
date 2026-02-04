'use client';

import { useState } from 'react';

export default function TestPaymentButton() {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      // 1. Ask our backend to create a session
      const response = await fetch('/api/checkout/deposit', {
        method: 'POST',
      });

      const data = await response.json();

      // 2. Redirect to the Stripe Checkout page
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Payment setup failed');
      }
    } catch (error) {
      console.error(error);
      alert('Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white max-w-sm">
      <h3 className="font-bold text-lg mb-2">Test Platform Payment</h3>
      <p className="text-sm text-gray-500 mb-4">
        This will charge $150 to "Storage Network" directly.
      </p>

      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded transition-colors"
      >
        {loading ? 'Processing...' : 'Pay $150 Deposit'}
      </button>
    </div>
  );
}
