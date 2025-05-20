export default {
  routes: [
    {
      method: "POST",
      path: "/orders/thrivecart-webhook",
      handler: "order.handleThriveCartWebhook",
      config: {
        auth: false, // Disable authentication for webhook
        policies: [],
      },
    },
  ],
};
