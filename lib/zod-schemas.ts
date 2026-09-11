import { z } from "zod";

export const prLineItemSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.number().positive("Quantity must be positive"),
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
  role: z.enum(["ADMIN", "BAC_SECRETARIAT", "END_USER", "BUDGET_OFFICER", "SUPPLY_OFFICER", "APPROVING_OFFICIAL", "VIEWER"]),
  officeId: z.string().nullable().optional(),
});
