import { z } from "zod";
import { sanitizeText } from "../sanitize";

// Mirrors the `FulfillmentType` enum in server/prisma/schema.prisma. Shared here
// so the client (which has no access to the Prisma-generated enum) and server
// both reference the same values instead of "DELIVERY"/"PICKUP" string literals.
export const FulfillmentType = {
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
} as const;

export type FulfillmentType = (typeof FulfillmentType)[keyof typeof FulfillmentType];

export const FULFILLMENT_TYPES = [FulfillmentType.DELIVERY, FulfillmentType.PICKUP] as const;

// Mirrors the `OrderStatus` Prisma enum.
export const OrderStatus = {
  RECEIVED: "RECEIVED",
  CONFIRMED: "CONFIRMED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUSES = [
  OrderStatus.RECEIVED,
  OrderStatus.CONFIRMED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
] as const;

// Mirrors the `CancelReason` Prisma enum.
export const CancelReason = {
  CUSTOMER_UNREACHABLE: "CUSTOMER_UNREACHABLE",
  OUTSIDE_DELIVERY_AREA: "OUTSIDE_DELIVERY_AREA",
  CUSTOMER_REQUEST: "CUSTOMER_REQUEST",
  OTHER: "OTHER",
} as const;

export type CancelReason = (typeof CancelReason)[keyof typeof CancelReason];

export const CANCEL_REASONS = [
  CancelReason.CUSTOMER_UNREACHABLE,
  CancelReason.OUTSIDE_DELIVERY_AREA,
  CancelReason.CUSTOMER_REQUEST,
  CancelReason.OTHER,
] as const;

// Failed call attempts on a RECEIVED order before staff may cancel it as
// "customer unreachable" (Project-Scope resolved decision).
export const CALL_ATTEMPTS_BEFORE_CANCEL = 3;

// Staff order list filter: omit `status` for all orders.
export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

export const cancelOrderSchema = z.object({
  reason: z.enum(CANCEL_REASONS, "A cancel reason is required"),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

const LOOKUP_CODE_ERROR = "Order code is required";
const LOOKUP_PHONE_ERROR = "Phone number is required";

// Customer status lookup: order code + the phone the order was placed with
// (non-enumerable — both must match).
export const orderLookupSchema = z.object({
  code: z
    .string(LOOKUP_CODE_ERROR)
    .trim()
    .min(1, LOOKUP_CODE_ERROR)
    .transform((value) => value.toUpperCase()),
  phone: z.string(LOOKUP_PHONE_ERROR).trim().min(1, LOOKUP_PHONE_ERROR),
});

export type OrderLookupInput = z.infer<typeof orderLookupSchema>;

// Pre-transform shape (what the form fields hold).
export type OrderLookupFormInput = z.input<typeof orderLookupSchema>;

// Signed-in customer voluntarily claiming past guest orders placed with a
// phone number, matched against Order.customerPhone (normalized the same way
// as orderLookupSchema's lookup — see server/src/routes/orders.ts's
// normalizePhone). Same lenient "non-empty" validation as the lookup phone
// field, since this matches an already-placed order rather than validating a
// new phone's format.
export const linkGuestOrdersSchema = z.object({
  phone: z.string(LOOKUP_PHONE_ERROR).trim().min(1, LOOKUP_PHONE_ERROR),
});

export type LinkGuestOrdersInput = z.infer<typeof linkGuestOrdersSchema>;

const CUSTOMER_NAME_ERROR = "Name must be at least 2 characters";
const PHONE_ERROR = "A valid phone number is required";
const ADDRESS_ERROR = "Address is required for delivery";
const FULFILLMENT_ERROR = "Choose delivery or pickup";
const ITEMS_ERROR = "Order must contain at least one item";
const QUANTITY_ERROR = "Quantity must be a positive whole number";

const checkoutFieldsSchema = z.object({
  customerName: z
    .string(CUSTOMER_NAME_ERROR)
    .trim()
    .min(2, CUSTOMER_NAME_ERROR)
    .transform(sanitizeText)
    // Sanitizing markup-only input can empty the value after the min check.
    .refine((value) => value.length >= 2, CUSTOMER_NAME_ERROR),
  customerPhone: z
    .string(PHONE_ERROR)
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{6,17}$/, PHONE_ERROR),
  fulfillmentType: z.enum(FULFILLMENT_TYPES, FULFILLMENT_ERROR),
  address: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .trim()
      .min(1, ADDRESS_ERROR)
      .transform(sanitizeText)
      .refine((value) => value.length >= 1, ADDRESS_ERROR)
      .optional(),
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
