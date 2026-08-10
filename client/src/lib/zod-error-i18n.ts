import type { TFunction } from "i18next";
import {
  ORDER_LOOKUP_CODE_ERROR,
  ORDER_LOOKUP_PHONE_ERROR,
  ORDER_LOOKUP_CODE_LENGTH_ERROR,
  ORDER_LOOKUP_PHONE_FORMAT_ERROR,
  ORDER_CUSTOMER_NAME_ERROR,
  ORDER_PHONE_ERROR,
  ORDER_AREA_ERROR,
  ORDER_LANDMARK_ERROR,
  ORDER_FULFILLMENT_ERROR,
  ORDER_ITEMS_ERROR,
  ORDER_QUANTITY_ERROR,
  INQUIRY_CUSTOMER_NAME_ERROR,
  INQUIRY_EMAIL_ERROR,
  INQUIRY_PHONE_ERROR,
  INQUIRY_MESSAGE_ERROR,
  INQUIRY_MESSAGE_MAX_ERROR,
  CONTACT_MESSAGE_MAX_ERROR,
  INQUIRY_TOPIC_ERROR,
  INQUIRY_LOOKUP_CODE_ERROR,
  INQUIRY_LOOKUP_PHONE_ERROR,
  INQUIRY_LOOKUP_CODE_LENGTH_ERROR,
  INQUIRY_LOOKUP_PHONE_FORMAT_ERROR,
  CUSTOMER_NAME_MIN_ERROR,
  CUSTOMER_EMAIL_ERROR,
  CUSTOMER_PASSWORD_ERROR,
  CUSTOMER_PASSWORD_MAX_ERROR,
  CUSTOMER_PASSWORD_REQUIRED_ERROR,
  MOBILE_ERROR,
  REGION_ERROR,
  REVIEW_AUTHOR_NAME_ERROR,
  REVIEW_AUTHOR_NAME_MAX_ERROR,
  REVIEW_RATING_ERROR,
  REVIEW_COMMENT_MAX_ERROR,
} from "@es-market/core";

// Maps the shared zod schemas' raw English validation messages (core/src/schemas/*)
// to i18n keys, so a non-English storefront user sees a translated field error
// instead of the raw English text zodResolver puts in formState.errors[x].message.
// Several distinct constants share identical English text by design (e.g. the
// order and inquiry "name" errors) — built via entries/fromEntries rather than
// an object literal, since TS flags an object literal with two computed keys
// it can prove are the same string literal as a duplicate-key error.
const ZOD_MESSAGE_TO_I18N_KEY: Record<string, string> = Object.fromEntries([
  [ORDER_LOOKUP_CODE_ERROR, "validation.orderLookupCode"],
  [ORDER_LOOKUP_PHONE_ERROR, "validation.orderLookupPhone"],
  [ORDER_LOOKUP_CODE_LENGTH_ERROR, "validation.orderLookupCodeLength"],
  // Shared by both order and inquiry lookup — the Track page's phone field
  // is common to both modes, so both schemas' phone-format text is
  // identical (see order.ts/inquiry.ts's own LOOKUP_PHONE_FORMAT_ERROR).
  [ORDER_LOOKUP_PHONE_FORMAT_ERROR, "validation.lookupPhoneFormat"],
  [INQUIRY_LOOKUP_PHONE_FORMAT_ERROR, "validation.lookupPhoneFormat"],
  [INQUIRY_LOOKUP_PHONE_ERROR, "validation.orderLookupPhone"],
  [INQUIRY_LOOKUP_CODE_LENGTH_ERROR, "validation.inquiryLookupCodeLength"],
  [ORDER_CUSTOMER_NAME_ERROR, "validation.customerName"],
  [ORDER_PHONE_ERROR, "validation.phone"],
  [ORDER_AREA_ERROR, "validation.area"],
  [ORDER_LANDMARK_ERROR, "validation.landmark"],
  [ORDER_FULFILLMENT_ERROR, "validation.fulfillment"],
  [ORDER_ITEMS_ERROR, "validation.items"],
  [ORDER_QUANTITY_ERROR, "validation.quantity"],
  [INQUIRY_CUSTOMER_NAME_ERROR, "validation.customerName"],
  [INQUIRY_EMAIL_ERROR, "validation.email"],
  [INQUIRY_PHONE_ERROR, "validation.phone"],
  [INQUIRY_MESSAGE_ERROR, "validation.message"],
  [INQUIRY_MESSAGE_MAX_ERROR, "validation.messageMax"],
  [CONTACT_MESSAGE_MAX_ERROR, "validation.contactMessageMax"],
  [INQUIRY_TOPIC_ERROR, "validation.topic"],
  [INQUIRY_LOOKUP_CODE_ERROR, "validation.inquiryLookupCode"],
  [CUSTOMER_NAME_MIN_ERROR, "validation.accountName"],
  [CUSTOMER_EMAIL_ERROR, "validation.email"],
  [CUSTOMER_PASSWORD_ERROR, "validation.password"],
  [CUSTOMER_PASSWORD_MAX_ERROR, "validation.passwordMax"],
  [CUSTOMER_PASSWORD_REQUIRED_ERROR, "validation.passwordRequired"],
  [MOBILE_ERROR, "validation.phone"],
  [REGION_ERROR, "validation.regionMax"],
  [REVIEW_AUTHOR_NAME_ERROR, "validation.customerName"],
  [REVIEW_AUTHOR_NAME_MAX_ERROR, "validation.nameMax"],
  [REVIEW_RATING_ERROR, "validation.reviewRating"],
  [REVIEW_COMMENT_MAX_ERROR, "validation.commentMax"],
]);

// Falls back to the raw message when it isn't a known schema constant (e.g. a
// future schema change this map hasn't caught up with yet) rather than throwing.
export function translateFieldError(
  message: string | undefined,
  t: TFunction,
): string | undefined {
  if (!message) return message;
  const key = ZOD_MESSAGE_TO_I18N_KEY[message];
  return key ? t(key) : message;
}
