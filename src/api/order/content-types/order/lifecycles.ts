import { addDays } from "date-fns";

export default {
  async afterCreate(event) {
    try {
      const { result } = event;

      if (!result?.orderId) {
        console.error("Order creation event missing orderId");
        return;
      }

      // send email notification to the user
      await strapi
        .service("api::email.email")
        .sendOrderCreatedEmail(result.orderId);

      console.log(`Order creation email sent for orderId: ${result.orderId}`);
    } catch (error) {
      console.error("Failed to send order creation email:", error);
    }
  },

  async beforeCreate(event) {
    const {
      params: { data },
    } = event;

    if (!data.publishingDate) {
      const createdDate = data.createdAt;
      data.publishingDate = addDays(createdDate, 3);
    }
  },

  async afterUpdate(event) {
    try {
      const { result, params } = event;
      if (params.data.orderStatus && result) {
        await strapi
          .service("api::email.email")
          .sendOrderStatusUpdateEmail(result.id, params.data.orderStatus);
      }
      console.log(`Order status update email sent for orderId: ${result.id}`);
    } catch (error) {
      console.error("Failed to send order status update email:", error);
    }
  },
};
