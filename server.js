// server.js
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
// config/stripe.js
const Stripe = require('stripe');
const stripe = Stripe("sk_test_51ItgZAJaNSZJSn5nTnJ2XzcPZ8voUbMavVMw4bMrySSfxeBqYduQbCb1gidQ7msD2928HXfAMUkvncgw23gCk02800kVUs3zef");
app.use(bodyParser.json());
app.use(express.static('public'));

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
    
  
  const retrieves= await stripe.paymentIntents.retrieve(paymentIntent.id);
  
  switch (retrieves.status) {
    case 'requires_confirmation':
      // Confirmer le paiement
    const confirmedIntent=await stripe.paymentIntents.confirm(paymentIntent.id);

    console.log(confirmedIntent)
    res.json({ 
      paymentIntentId: confirmedIntent.id,
      status: confirmedIntent.status,
      mandate: confirmedIntent.mandate
    });
      break;
    case 'requires_action':
      // L'utilisateur doit compléter une action (3DS)
      // Afficher l'interface nécessaire
      break;
    case 'processing':
      // Paiement déjà en cours - attendre le webhook
      console.log('Paiement en cours de traitement');
      break;
    case 'succeeded':
      // Paiement déjà réussi
      console.log('Paiement déjà complété');
      break;
    default:
      console.log('Statut non géré:', retrieves.status);
  }


    // Confirmer immédiatement le paiement


    /*res.json({ 
      paymentIntentId: confirmedIntent.id,
      status: confirmedIntent.status,
      mandate: confirmedIntent.mandate
    });
    */
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
app.post('/webhook', bodyParser.raw({type: 'application/json'}), 
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body, 
        sig, 
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer les événements
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Paiement réussi:', paymentIntent.id);
        // Mettre à jour votre base de données
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Paiement échoué:', failedPayment.id);
        break;

      case 'mandate.updated':
        const mandate = event.data.object;
        console.log('Mandat mis à jour:', mandate.id);
        break;

      default:
        console.log(`Événement non géré: ${event.type}`);
    }

    res.json({received: true});
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
