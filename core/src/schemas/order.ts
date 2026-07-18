import { z } from "zod";

// Mirrors the `FulfillmentType` enum in server/prisma/schema.prisma. Shared here
// so the client (which has no access to the Prisma-generated enum) and server
// both reference the same values instead of "DELIVERY"/"PICKUP" string literals.
export const FulfillmentType = {
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
} as const;

export type FulfillmentType = (typeof FulfillmentType)[keyof typeof FulfillmentType];

export const FULFILLMENT_TYPES = [FulfillmentType.DELIVERY, FulfillmentType.PICKUP] as const;

const CUSTOMER_NAME_ERROR = "Name must be at least 2 characters";
const PHONE_ERROR = "A valid phone number is required";
const ADDRESS_ERROR = "Address is required for delivery";
const FULFILLMENT_ERROR = "Choose delivery or pickup";
const ITEMS_ERROR = "Order must contain at least one item";
const QUANTITY_ERROR = "Quantity must be a positive whole number";

const checkoutFieldsSchema = z.object({
  customerName: z.string(CUSTOMER_NAME_ERROR).trim().min(2, CUSTOMER_NAME_ERROR),
  customerPhone: z
    .string(PHONE_ERROR)
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{6,17}$/, PHONE_ERROR),
  fulfillmentType: z.enum(FULFILLMENT_TYPES, FULFILLMENT_ERROR),
  address: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1, ADDRESS_ERROR).optional(),
  ),
});

function requireAddressForDelivery(
  value: { fulfillmentType: FulfillmentType; address?: string },
  ctx: z.RefinementCtx,
) {
  if (value.fulfillmentType === FulfillmentType.DELIVERY && !value.address) {
    ctx.addIssue({ code: "custom", path: ["address"], message: ADDRESS_ERROR });
  }
}

// Client checkout form: the customer fields only — items come from the cart.
export const checkoutFormSchema = checkoutFieldsSchema.superRefine(requireAddressForDelivery);

// Pre-transform shape (what the form fields hold), same convention as CreateProductFormInput.
export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;

export const placeOrderSchema = checkoutFieldsSchema
  .extend({
    items: z
      .array(
        z.object({
          productId: z.string().trim().min(1),
          quantity: z.number(QUANTITY_ERROR).int(QUANTITY_ERROR).min(1, QUANTITY_ERROR),
        }),
      )
      .min(1, ITEMS_ERROR),
  })
  .superRefine(requireAddressForDelivery);

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
