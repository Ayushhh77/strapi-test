import { factories } from "@strapi/strapi";
import crypto from "crypto";

interface OrderAttributes {
  orderId: string;
  fullName: string;
  emailAddress: string;
  brandName: string;
  country: string;
  websiteLinks: { url: string }[];
  representativeName: string;
  representativeEmail: string;
  totalAmount: number;
  orderStatus: "placed" | "in_review" | "scheduled" | "cancelled" | "published";
  paymentStatus: "unpaid" | "paid";
  publishingDate: Date;
  stripePaymentId?: string;
}

export default factories.createCoreService(
  "api::order.order" as any,
  ({ strapi }) => ({
    async findOrderByOrderId(orderId: string): Promise<OrderAttributes | null> {
      const order = await strapi.db.query("api::order.order").findOne({
        where: { orderId },
        populate: true,
      });
      return order as OrderAttributes | null;
    },

    async findOrderById(id: string) {
      if (!id) return null;
      return await strapi.db.query("api::order.order").findOne({
        where: { id },
        populate: true,
      });
    },

    async findByStripePaymentId(stripePaymentId: string) {
      if (!stripePaymentId) return null;

      const session = await strapi
        .service("api::stripe-session.stripe-session")
        .retrieveStripeSession(stripePaymentId);
      const orderDetail = await strapi.db.query("api::order.order").findOne({
        where: { stripePaymentId },
        populate: true,
      });

      const transactionDate = session?.created
        ? new Date(session.created * 1000)
        : null;

      return {
        ...orderDetail,
        transactionDate,
      };
    },

    async handleThriveCartWebhook(ctx) {
      try {
        const { thrivecart, thrivecart_hash } = ctx.request.body;
        const myThriveCartSecret =
          process.env.THRIVECART_SECRET || "jdjsfsajfdjkaksdakja";
        if (!myThriveCartSecret) {
          ctx.response.status = 500;
          return { error: { message: "ThriveCart secret not configured" } };
        }

        // Verify webhook authenticity
        const sortedData = Object.keys(thrivecart)
          .sort()
          .reduce(
            (obj, key) => {
              obj[key] = thrivecart[key];
              return obj;
            },
            {} as Record<string, any>
          );
        const localHash = crypto
          .createHash("md5")
          .update(
            `${myThriveCartSecret}__${JSON.stringify(sortedData).toUpperCase()}`
          )
          .digest("hex");

        if (localHash !== thrivecart_hash) {
          ctx.response.status = 403;
          return { error: { message: "Invalid webhook hash" } };
        }

        // Map ThriveCart data to order data structure
        const orderData = {
          orderId: thrivecart.order_id,
          fullName:
            thrivecart.customer?.custom_fields?.["representative-name"] ||
            thrivecart.customer?.name ||
            "Unknown",
          emailAddress: thrivecart.customer?.email || "",
          totalAmount: parseFloat(thrivecart.total) / 100,
          paymentStatus: "paid",
          orderStatus: "placed",
          country: thrivecart.customer?.address?.country || "",
          websiteLinks: thrivecart.customer?.custom_fields?.website
            ? [{ url: thrivecart.customer.custom_fields.website }]
            : [],
          representativeName:
            thrivecart.customer?.custom_fields?.["representative-name"] || "",
          representativeEmail: thrivecart.customer?.email || "",
          stripePaymentId:
            thrivecart.transactions?.[`product-${thrivecart.base_product}`] ||
            thrivecart.order_id,
          publishingDate: new Date(
            new Date(thrivecart.order_date).getTime() + 3 * 24 * 60 * 60 * 1000
          ), // order_date + 3 days
          paymentMethod: {
            connect: [
              await strapi
                .service("api::order.order")
                .getThriveCartPaymentMethodId(),
            ],
          },
        };

        let existingOrder = await strapi.db.query("api::order.order").findOne({
          where: { orderId: thrivecart.order_id },
        });

        if (!existingOrder) {
          existingOrder = await strapi.service("api::order.order").create({
            data: orderData,
          });
          await strapi
            .service("api::email.email")
            .sendOrderCreatedEmail(existingOrder.id);
        }

        return {
          message: "Order processed successfully",
          order: existingOrder,
        };
      } catch (err) {
        ctx.response.status = 500;
        return {
          error: {
            message: "Error processing webhook",
            details: (err as Error).message,
          },
        };
      }
    },

    async updateOrderDetails(ctx) {
      const { orderId } = ctx.params;
      const { data: formData } = ctx.request.body;
      const files = ctx.request.files;

      try {
        const data =
          typeof formData === "string" ? JSON.parse(formData) : formData;

        const existingOrder = await strapi
          .service("api::order.order")
          .findOrderByOrderId(orderId);

        if (!existingOrder) {
          ctx.response.status = 404;
          return { error: { message: "Order not found" } };
        }

        const updatedOrder = await strapi
          .service("api::order.order")
          .update(existingOrder.id, {
            data,
            files,
          });

        await strapi
          .service("api::email.email")
          .sendOrderStatusUpdateEmail(
            updatedOrder.id,
            updatedOrder.orderStatus
          );

        return { message: "Order updated successfully", order: updatedOrder };
      } catch (err) {
        ctx.response.status = 500;
        return {
          error: {
            message: "Error updating order",
            details: (err as Error).message,
          },
        };
      }
    },
  })
);
