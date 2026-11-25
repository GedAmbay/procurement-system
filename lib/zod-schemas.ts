import { z } from "zod";
import { validatePasswordStrength } from "./password";

export const prLineItemSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  unit: z.string().nullable().optional().or(z.literal("")),
  quantity: z.number().nonnegative("Quantity must not be negative"),
  unitCost: z.number().nonnegative("Unit cost must not be negative"),
});

export const purchaseRequestSchema = z.object({
  prNumber: z.string().trim().optional().nullable().transform(v => v || null),
  fiscalYear: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || Number.isNaN(val) ? undefined : Number(val)),
    z.number().int().min(1900).max(2100).optional()
  ),
  officeId: z.string().min(1, "Requesting office is required"),
  purpose: z.string().min(1, "Purpose is required"),
  requestedBySignatoryId: z.string().nullable().optional().transform(v => v || null),
  fundSourceId: z.string().nullable().optional().transform(v => v || null),
  chargeToAccount: z.string().nullable().optional().transform(v => v || null),
  isDirectAcquisition: z.boolean().optional().default(false),
  requestType: z.string().optional().default("PURCHASE"),
  lineItems: z.array(prLineItemSchema).min(1, "At least one line item is required"),
});


export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  username: z
    .string()
    .trim()
    .min(3, "Employee ID / Username must be at least 3 characters")
    .max(40, "Employee ID / Username must be at most 40 characters")
    .regex(/^[A-Za-z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed"),
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid notification email"),
  password: z
    .string()
    .superRefine((val, ctx) => {
      const check = validatePasswordStrength(val);
      if (!check.valid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.error || "Weak password" });
      }
    }),
  role: z.enum(["ADMIN", "BAC_SECRETARIAT", "END_USER"]),
  officeId: z.string().nullable().optional(),
});
