import { z } from "zod";

export const prLineItemSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  unit: z.string().nullable().optional().or(z.literal("")),
  quantity: z.number().nonnegative("Quantity must not be negative"),
  unitCost: z.number().nonnegative("Unit cost must not be negative"),
});

export const purchaseRequestSchema = z.object({
  officeId: z.string().min(1, "Office ID is required"),
  purpose: z.string().min(1, "Purpose is required"),
  requestedBySignatoryId: z.string().nullable().optional(),
  fundSourceId: z.string().nullable().optional(),
  chargeToAccount: z.string().nullable().optional(),
  lineItems: z.array(prLineItemSchema).min(1, "At least one line item is required"),
});

export const purchaseRequestStatusUpdateSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "FOR_RFQ", "CLOSED", "REJECTED"]),
});

export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "BAC_SECRETARIAT", "END_USER"]),
  officeId: z.string().nullable().optional(),
});
