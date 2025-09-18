// server.js
const express = require('express');
const bodyParser = require('body-parser');
require("dotenv").config()
const app = express();
// config/stripe.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SK_KEY);
app.use(
    bodyParser.json({
        verify: function(req, res, buf) {
            req.rawBody = buf;
        }
    })
);
app.use(express.static('public'));
app.use(express.json())
// Routes pour le frontend
app.get('/', (req, res) => {
  console.log(__dirname)
  res.sendFile(__dirname + '/public/index.html');
});

// Créer un SetupIntent pour SEPA
app.post('/create-setup-intent', async (req, res) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['sepa_debit'],
      customer: req.body.customerId, // Optionnel
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Confirmer le mandat SEPA
app.post('/confirm-sepa-mandate', async (req, res) => {
  try {
    const { setupIntentId, paymentMethodId } = req.body;

    const setupIntent = await stripe.setupIntents.confirm(
      setupIntentId,
      { payment_method: paymentMethodId 
      
      }
    );

   res.json({ 
      status: setupIntent.status, 
      mandate: setupIntent.mandate 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Effectuer un prélèvement
app.post('/create-sepa-payment', async (req, res) => {
  try {
    const { amount, currency, customerId, paymentMethodId } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency || 'eur',
      customer: customerId,
      payment_method: paymentMethodId,
      payment_method_types: ['sepa_debit'],
// Confirmer immédiatement
      
       confirmation_method: 'manual',
      mandate_data: {
      
        customer_acceptance: {
          type: 'online',
          online: {
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
          },
        },
      },
        confirm:true,
    });
    
  
  const retrieve=await stripe.paymentIntents.retrieve(paymentIntent.id);
  console.log(retrieve)
  
  if (retrieve.status === 'requires_action' && 
        retrieve.next_action.type === 'redirect_to_url') {
      // Redirection nécessaire pour 3D Secure
    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id);
      console.log('PaymentIntent confirmed:', confirmedPaymentIntent.id);
      res.json({
        requiresAction: true,
        redirectUrl: confirmedPaymentIntent.next_action.redirect_to_url.url,
        clientSecret: confirmedPaymentIntent.client_secret,
        paymentIntentId: confirmedPaymentIntent.id
      });
    } 
else if (retrieve.status === 'processing') {
      console.log('PaymentIntent is currently processing. Awaiting result.');
      // Implement a mechanism to check for status changes (e.g., webhooks)
    }



    else if (retrieve.status === 'succeeded') {
      // Paiement réussi immédiatement
      res.json({
        success: true,
        paymentIntentId: confirmedPaymentIntent.id,
        status: confirmedPaymentIntent.status
      });
    } else {
      // Autre statut
      res.json({
        success: false,
        status: confirmedIntent.status,
        error: 'Le paiement n\'a pas abouti'
      });
    }

    
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Créer un client Stripe
app.post('/create-customer', async (req, res) => {
  try {
    const { name, email } = req.body;

    const customer = await stripe.customers.create({
      name: name,
      email: email,
    });

    res.json({ customerId: customer.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route pour créer une session de paiement
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { products, success_url, cancel_url } = req.body;

    // Validation des données
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Les produits sont requis' });
    }

    // Transformation des produits en format Stripe
    const lineItems = products.map(product => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: product.name,
        
          images: product.images || [],
        },
        unit_amount: Math.round(product.price * 100), // Stripe utilise des centimes
      },
      quantity: product.quantity || 1,
    }));

    // Création de la session de paiement
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: success_url || `${process.env.CLIENT_URL}/success`,
      cancel_url: cancel_url || `${process.env.CLIENT_URL}/cancel`,
    });
console.log(session.url)
    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Erreur lors de la création de la session:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route pour récupérer les détails d'une session
app.get('/api/session-status', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'ID de session requis' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    res.json({
      status: session.status,
      customer_email: session.customer_details?.email,
      payment_status: session.payment_status,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la session:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});
// Webhook pour les événements Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody, 
      sig, 
      process.env.WEBHOOKS_SECRET_KEY
    );
  } catch (err) {
    console.error('Erreur de webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer les événements Stripe
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Paiement réussi:', paymentIntent.id);
      // Mettre à jour votre base de données ici
      break;
      
    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object;
      console.log('Paiement échoué:', failedPaymentIntent.id);
      // Gérer l'échec du paiement
      break;
      
    case 'payment_intent.requires_action':
      const requiresActionIntent = event.data.object;
      console.log('Action requise pour le paiement:', requiresActionIntent.id);
      // Gérer l'action requise (3D Secure)
      break;
      
    case 'setup_intent.succeeded':
      const setupIntent = event.data.object;
      console.log('Mandat créé avec succès:', setupIntent.id);
      // Enregistrer le mandat dans votre base de données
      break;

    default:
      console.log(`Événement non géré: ${event.type}`);
  }

  res.json({ received: true });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
