let cardNumber=document.getElementById("payment-element")
let ibanNumber=document.getElementById("ibanshow")
let payForm=document.getElementById("payment-form")
choicecard(2)
function choicecard(index) {
    if(Number(index)==1){
      cardNumber.style.display="block" 
      ibanNumber.style.display="none"
      payForm.style.display="block"
      // Exemple de requête vers /api/create-checkout-session

document.getElementById("button-text").addEventListener("click",async function(){
 const response = await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: new Headers({
    'Content-Type': 'application/json',
  }),
  body: JSON.stringify({
    products: [
      {
        name: 'Produit 1',
        description: 'Description du produit 1',
        price: 29.99,
        quantity: 2,
        images: ['https://example.com/image1.jpg']
      },
      {
        name: 'Produit 2',
        price: 19.99,
        quantity: 1
      }
    ],
    success_url: 'https://votresite.com/success',
    cancel_url: 'https://votresite.com/cancel'
  })
});

const { id, url } = await response.json();
// Redirigez l'utilisateur vers l'URL de paiement 
window.location.href=""+url
})

    }
    if(Number(index)==2){
     payForm.style.display="none"
       // public/app.js
       ibanNumber.style.display="block"
       cardNumber.style.display="none" 
      
const stripe = Stripe('pk_test_51ItgZAJaNSZJSn5neSka3qXkJTYn595yGwBvSvSJxAiTbYygWEOFW0y9C5As3gO96REN0LZGjFN9UaIf7XIvgMsv00G0LEwi2Y');
let elements;
let ibanElement;
let customerId = null;
let paymentMethodId = null;
let setupIntentClientSecret = null;

// Créer un client
document.getElementById('customer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
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
  document.getElementById('payment-section').style.display = 'block';
});

function initializeStripe() {
  elements = stripe.elements();
  ibanElement = elements.create('iban', {
    supportedCountries: ['SEPA'],
    placeholderCountry: 'IT',
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
    alert('Mandat SEPA enregistré avec succès!');
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
  } else {
    alert('Erreur lors du paiement: ' + result.error);
  }
}

    }
}
