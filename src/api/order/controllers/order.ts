/**
 * order controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::order.order",
  ({ strapi }) => ({
    async findOne(ctx) {
      const { orderId } = ctx.params;
      const entity = await strapi
        .service("api::order.order")
        .findOrderByOrderId(orderId);

      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);

      return this.transformResponse(sanitizedEntity);
    },

    async handleThriveCartWebhook(ctx) {
      try {
        return await strapi
          .service("api::order.order")
          .handleThriveCartWebhook(ctx);
      } catch (error) {
        ctx.response.status = 500;
        return {
          error: {
            message: "Error processing ThriveCart webhook",
            details: error.message,
          },
        };
      }
    },

    async customCreateOrder(ctx) {
      const {
        body: { data: formData },
        files,
      } = ctx.request;

      try {
        const { session } = await strapi
          .service("api::order.order")
          .createStripeSessionAndOrder(formData, files);

        const checkoutUrl = session.url;

        return {
          data: {
            checkoutUrl,
          },
          success: true,
        };
      } catch (error) {
        ctx.response.status = 500;
        return { error };
      }
    },
    async updateOrderDetails(ctx) {
      try {
        return await strapi.service("api::order.order").updateOrderDetails(ctx);
      } catch (error) {
        ctx.response.status = 500;
        return {
          error: {
            message: "Error updating order details",
            details: error.message,
          },
        };
      }
    },

    async findByStripePaymentId(ctx) {
      const stripePaymentId = ctx.params.stripePaymentId;
      return await strapi
        .service("api::order.order")
        .findByStripePaymentId(stripePaymentId);
    },
  })
);
