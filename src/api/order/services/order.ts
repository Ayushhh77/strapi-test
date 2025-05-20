/**
 * order service
 */

import { factories } from "@strapi/strapi";
import { addDays, format } from "date-fns";
import crypto from "crypto"; // Add this import at the top

const dateFormat = "yyyy-MM-dd";
const todaysDate = format(new Date(), dateFormat);
// const tomorrowsDate = format(addDays(todaysDate, 1), dateFormat);

const populateOrderDetails = [
  "writingPackage.image.media",
  "writingUpgrades.image.media",
  "publishingNetwork.image.media",
  "publishingNetwork.sampleReportUrl",
  "publishingNetwork.topFeatures.feature",
  "publishingNetwork.overview.features.feature",
  "publishingNetwork.overview.featureLinks",
  "publishingNetwork.acceptedTopics.newsTopic",
  "publishingNetwork.majorOutlets.newsOutlet",
  "publishingNetwork.storyLimitation",
  "publishingNetwork.overviewTopics.overviewTopic",
  "extraNewsOutlets.image.media",
  "extraNewsOutlets.url",
  "websiteLinks",
  "newsStoryDoc",
  "newsStoryImages",
  "orderReview",
  "pressReleaseContent.publishableDocument",
  "pressReleaseContent.seo.metaImage.media",
  "pressReleaseContent.publishedReports",
  "pressReleaseContent.publishedLinks",
  "paymentMethod.image.media",
  "paymentMethod.extraImages.media",
];

export default factories.createCoreService(
  "api::order.order",
  ({ strapi }) => ({
    async findOrderByOrderId(orderId) {
      const order = await strapi.db.query("api::order.order").findOne({
        where: { id: orderId },
        populate: populateOrderDetails,
      });

      return order;
    },
    async findOrderById(id: string) {
      if (!id) return;

      return await strapi.db.query("api::order.order").findOne({
        where: { id },
        populate: true,
      });
    },
    async findOrderReviewByOrderId(orderId) {
      return await strapi.db.query("api::order-review.order-review").findOne({
        where: {
          order: {
            id: orderId,
          },
        },
      });
    },
    async findPressReleaseByOrderId(orderId) {
      return await strapi.db
        .query("api::press-release-content.press-release-content")
        .findOne({
          where: {
            order: {
              id: orderId,
            },
          },
          populate: [
            "publishableDocument",
            "seo.metaImage.media",
            "publishedReports",
            "publishedLinks",
          ],
        });
    },
    async findByStripePaymentId(stripePaymentId) {
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
        // Log the raw payload for debugging
        console.log(
          "Webhook Payload:",
          JSON.stringify(ctx.request.body, null, 2)
        );

        // Assume flat payload from ThriveCart
        const thrivecart = { ...ctx.request.body }; // Clone to avoid modifying original
        const thrivecart_hash = thrivecart.thrivecart_hash || "";
        delete thrivecart.thrivecart_hash; // Exclude hash from calculation

        // Check if thrivecart is an object
        if (!thrivecart || typeof thrivecart !== "object") {
          ctx.response.status = 400;
          return {
            error: {
              message: "Invalid or missing thrivecart object in payload",
            },
          };
        }

        // Verify webhook authenticity
        const myThriveCartSecret = "SG8YZDLGIGKG";
        const sortedData = Object.keys(thrivecart)
          .sort()
          .reduce((obj, key) => {
            obj[key] = thrivecart[key];
            return obj;
          }, {});
        const hashInput = `${myThriveCartSecret}__${JSON.stringify(
          sortedData
        ).toUpperCase()}`;
        const localHash = crypto
          .createHash("md5")
          .update(hashInput)
          .digest("hex");

        // Log hash details for debugging
        console.log("Calculated localHash:", localHash);
        console.log("Received thrivecart_hash:", thrivecart_hash);
        console.log("Hash Input:", hashInput);
        console.log("Sorted Data:", JSON.stringify(sortedData, null, 2));

        if (localHash !== thrivecart_hash) {
          ctx.response.status = 403;
          return { error: { message: "Invalid webhook hash" } };
        }

        // Map ThriveCart data to Strapi order schema
        const orderData = {
          orderId: thrivecart.order_id || "",
          fullName:
            thrivecart.customer?.custom_fields?.["representative-name"] ||
            thrivecart.customer?.name ||
            "Unknown",
          emailAddress: thrivecart.customer?.email || "",
          totalAmount: thrivecart.total
            ? parseFloat(thrivecart.total) / 100
            : 0,
          paymentStatus: "paid",
          orderStatus: "placed",
          country: thrivecart.customer?.address?.country || "",
          websiteLinks: thrivecart.customer?.custom_fields?.website
            ? { url: thrivecart.customer.custom_fields.website }
            : null,
          representativeName:
            thrivecart.customer?.custom_fields?.["representative-name"] || "",
          representativeEmail: thrivecart.customer?.email || "",
          stripePaymentId:
            thrivecart.transactions?.[`product-${thrivecart.base_product}`] ||
            thrivecart.order_id ||
            "",
          publishingDate: thrivecart.order_date
            ? new Date(thrivecart.order_date)
            : new Date(),
          paymentMethod: {
            // connect: [await this.getThriveCartPaymentMethodId()],
          },
          // Add default values for potentially required fields
          writingPackage: { connect: [] }, // Adjust based on schema
          publishingNetwork: { connect: [] }, // Adjust based on schema
          extraNewsOutlets: { connect: [] },
          brandName: "",
          address: "",
          phoneNumber: "",
        };

        // Log orderData for debugging
        console.log("Order Data:", JSON.stringify(orderData, null, 2));

        // Check for existing order
        const existingOrder = await strapi.db
          .query("api::order.order")
          .findOne({
            where: { orderId: thrivecart.order_id },
          });

        let newOrder;
        if (!existingOrder) {
          try {
            newOrder = await strapi.service("api::order.order").create({
              data: orderData,
            });
            await strapi
              .service("api::email.email")
              .sendOrderCreatedEmail(newOrder.id);
          } catch (err) {
            console.error("Order Creation Error:", err);
            console.error("Validation Errors:", err.details?.errors || err);
            throw err; // Re-throw to catch in outer try-catch
          }
        } else {
          newOrder = existingOrder;
        }

        return { message: "Order processed successfully", order: newOrder };
      } catch (err) {
        console.error("Webhook Error:", err);
        ctx.response.status = 500;
        return {
          error: { message: "Error processing webhook", details: err.message },
        };
      }
    },

    async updateOrderDetails(ctx) {
      const { orderId } = ctx.params;
      const {
        body: { data: formData },
        files,
      } = ctx.request;

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
          error: { message: "Error updating order", details: err.message },
        };
      }
    },
    async generateLineItems(data) {
      let items = [];

      const writingPackage = await strapi.entityService.findOne(
        "api::writing-package.writing-package",
        data.writingPackage.connect[0]
      );

      if (writingPackage.stripePriceId) {
        items.push({
          price: writingPackage.stripePriceId,
          quantity: 1,
          unitPrice: writingPackage.price,
        });
      }

      const publishingNetwork = await strapi.entityService.findOne(
        "api::publishing-network.publishing-network",
        data.publishingNetwork.connect[0]
      );

      items.push({
        price: publishingNetwork.stripePriceId,
        quantity: 1,
        unitPrice: publishingNetwork.price,
      });

      const upgradeItems = await Promise.all(
        data.writingUpgrades.connect.map(async (connectId) => {
          const upgrade = await strapi.entityService.findOne(
            "api::writing-upgrade.writing-upgrade",
            connectId
          );

          return {
            price: upgrade.stripePriceId,
            quantity: 1,
            unitPrice: upgrade.price,
          };
        })
      );

      const outletItems = await Promise.all(
        data.extraNewsOutlets.connect.map(async (connectId) => {
          const newsOutlet = await strapi.entityService.findOne(
            "api::news-outlet.news-outlet",
            connectId
          );

          return {
            price: newsOutlet.stripePriceId,
            quantity: 1,
            unitPrice: newsOutlet.price,
          };
        })
      );

      items = [...items, ...upgradeItems, ...outletItems];

      return items;
    },
    calculateTotalAmount(items) {
      const totalAmount = items.reduce(
        (totalAmount, lineItem) => lineItem.unitPrice + totalAmount,
        0
      );

      return totalAmount;
    },
    generateStripeLineItems(lineItems) {
      const stripeLineItems = lineItems.map((lineItem) => ({
        price: lineItem.price,
        quantity: lineItem.quantity,
      }));

      return stripeLineItems;
    },
    async createStripeSessionAndOrder(formData, files) {
      const data = JSON.parse(formData);

      const paymentMethodId = data.paymentMethod?.connect[0];

      const paymentMethod = await strapi
        .service("api::payment-method.payment-method")
        .findOne(paymentMethodId);

      let session;
      let transactions;

      const lineItems = await strapi
        .service("api::order.order")
        .generateLineItems(data);

      const totalAmount = strapi
        .service("api::order.order")
        .calculateTotalAmount(lineItems);

      const stripeLineItems = strapi
        .service("api::order.order")
        .generateStripeLineItems(lineItems);

      if (paymentMethod) {
        switch (paymentMethod.uid) {
          case "stripe":
            session = await strapi
              .service("api::stripe-session.stripe-session")
              .createStripeSession(stripeLineItems, {
                customerEmail: data.emailAddress,
              });

            try {
              transactions = await Promise.all(
                lineItems.map(async (item) => {
                  return await strapi
                    .service("api::transaction.transaction")
                    .createStripeProductTransaction({
                      session,
                      priceId: item.price,
                      customerName: data.fullName,
                      customerEmail: data.emailAddress,
                    });
                })
              );
            } catch (error) {
              console.error(`Transaction creation failed: ${error.message}`);
            }
            break;

          default:
            break;
        }
      }

      const newOrder = await strapi.service("api::order.order").create({
        data: {
          ...data,
          stripePaymentId: session.id,
          paymentStatus: "unpaid",
          orderStatus: "placed",
          totalAmount,
        },
        files,
      });

      await strapi
        .service("api::email.email")
        .sendOrderCreatedEmail(newOrder.id);

      // Wait for Stripe Webhook to confirm the payment status
      return {
        newOrder,
        session,
        transactions,
      };
    },

    async updateOrderStatus(orderId, orderStatus) {
      if (!orderId || !orderStatus) return;

      const updatedOrder = await strapi
        .service("api::order.order")
        .update(orderId, {
          data: {
            orderStatus,
          },
        });

      // Send email notification for status change
      await strapi
        .service("api::email.email")
        .sendOrderStatusUpdateEmail(orderId, orderStatus);

      return updatedOrder;
    },
    // async findManyByPublishingDate(publishingDate, conditions = {}) {
    //   return await strapi.db.query("api::order.order").findMany({
    //     where: {
    //       publishingDate,
    //       ...conditions,
    //     },
    //     populate: true,
    //   });
    // },
    // async notifyPublishToAdmin() {
    //   try {
    //     const ordersToBePublishedTomorrow =
    //       await this.findManyByPublishingDate(tomorrowsDate);

    //     ordersToBePublishedTomorrow.forEach(async (order) => {
    //       // send email to notify admin such that order needs to be published tomorrow

    //       await strapi
    //         .service("api::email.email")
    //         .sendToBePublishedEmail(order.id);
    //     });
    //   } catch (error) {}
    // },
    // async publishAndNotify() {
    //   try {
    //     const ordersToBePublishedToday = await this.findManyByPublishingDate(
    //       todaysDate,
    //       {
    //         orderStatus: {
    //           $ne: "published",
    //         },
    //         paymentStatus: "paid",
    //       }
    //     );

    //     ordersToBePublishedToday.forEach(async (order) => {
    //       // publish order send email to notify user that their order is published today

    //       // set press release status to published (order status will be automatically published from lifecycle)
    //       await strapi
    //         .service("api::press-release-content.press-release-content")
    //         .update(order.pressReleaseContent?.id, {
    //           data: {
    //             releaseStatus: "published",
    //           },
    //         });
    //     });
    //   } catch (error) {}
    // },
  })
);
