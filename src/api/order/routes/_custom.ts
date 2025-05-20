export default {
  routes: [
    {
      method: "GET",
      path: "/order/:orderId",
      handler: "order.findOne",
    },
    {
      method: "POST",
      path: "/orders/create",
      handler: "order.customCreateOrder",
    },
    {
      method: "GET",
      path: "/orders/byStripeId/:stripePaymentId",
      handler: "order.findByStripePaymentId",
    },
    {
      method: "POST",
      path: "/orders/thrivecart-webhook",
      handler: "order.handleThriveCartWebhook",
      config: {
        policies: [], // Add authentication if needed
      },
    },
    {
      method: "PUT",
      path: "/orders/update/:orderId",
      handler: "order.updateOrderDetails",
      config: {
        policies: [], // Add authentication if needed
      },
    },
  ],
};
