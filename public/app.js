        // public/app.js
const stripe = Stripe('pk_test_51ItgZAJaNSZJSn5neSka3qXkJTYn595yGwBvSvSJxAiTbYygWEOFW0y9C5As3gO96REN0LZGjFN9UaIf7XIvgMsv00G0LEwi2Y');
let elements;
let ibanElement;
let customerId = null;
let paymentMethodId = null;
let setupIntentClientSecret = null;
const paymentButton = document.getElementById('payment-button');
// Créer un client
document.getElementById('customer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  paymentButton.disabled = true;
                paymentButton.classList.add('loading');
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;

  const response = await fetch('/create-customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email })
  });

  const customer = await response.json();
  customerId = customer.customerId;
  
  // Initialiser Stripe Elements
  initializeStripe();
  paymentButton.disabled = false;
                paymentButton.classList.remove('loading'); document.getElementById('payment-section').style.display = 'block';
});

function initializeStripe() {
  elements = stripe.elements();
  ibanElement = elements.create('iban', {
    supportedCountries: ['SEPA'],
    placeholderCountry: 'DE',
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': { color: '#aab7c4' }
      }
    }
  });

  ibanElement.mount('#iban-element');
}

// Enregistrer le mandat SEPA
document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
paymentButton.disabled = true;
                paymentButton.classList.add('loading');
  // Créer le SetupIntent
  const setupResponse = await fetch('/create-setup-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId })
  });

  const setupData = await setupResponse.json();
  setupIntentClientSecret = setupData.clientSecret;

  // Confirmer le setup avec les détails bancaires
  const { setupIntent, error } = await stripe.confirmSepaDebitSetup(
    setupIntentClientSecret,
    {
      payment_method: {
        sepa_debit: ibanElement,
        billing_details: {
          name: document.getElementById('name').value,
          email: document.getElementById('email').value,
        },
      },
    }
  );

  if (error) {
    alert(`Erreur: ${error.message}`);
  } else {
    paymentMethodId = setupIntent.payment_method;
     paymentButton.disabled = false;
                paymentButton.classList.remove('loading');
    document.getElementById('payment-action').style.display = 'block';
  }
});

// Effectuer un paiement
async function createPayment() {
  const amount = document.getElementById('amount').value * 100; // Convertir en cents

  const response = await fetch('/create-sepa-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amount,
      currency: 'eur',
      customerId: customerId,
      paymentMethodId: paymentMethodId
    })
  });

  const result = await response.json();
  console.log(result)
  if (result.status === 'succeeded') {
    alert('Paiement effectué avec succès!');
    paymentButton.disabled = false;
                paymentButton.classList.remove('loading');
  } else {
    alert('Erreur lors du paiement: ' + result.error);
     paymentButton.disabled = false;
                paymentButton.classList.remove('loading');
  }
}
