import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::order.order" as any,
  ({ strapi }) => ({
    async findOne(ctx) {
      const { orderId } = ctx.params;
      const entity = await strapi
        .service("api::order.order")
        .findOrderByOrderId(orderId);
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    },

    async customCreateOrder(ctx) {
      const { data: formData } = ctx.request.body;
      const files = ctx.request.files;

      try {
        const { session } = await strapi
          .service("api::order.order")
          .createStripeSessionAndOrder(formData, files);
        return {
          data: {
            checkoutUrl: session.url,
          },
          success: true,
        };
      } catch (error) {
        ctx.response.status = 500;
        return { error };
      }
    },

    async findByStripePaymentId(ctx) {
      const { stripePaymentId } = ctx.params;
      const order = await strapi
        .service("api::order.order")
        .findByStripePaymentId(stripePaymentId);
      return order || { error: "Order not found" };
    },

    async handleThriveCartWebhook(ctx) {
      return await strapi
        .service("api::order.order")
        .handleThriveCartWebhook(ctx);
    },

    async updateOrderDetails(ctx) {
      return await strapi.service("api::order.order").updateOrderDetails(ctx);
    },
  })
);
