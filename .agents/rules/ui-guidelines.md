---
description: UI and Design Guidelines for the LGU Procurement System
---

# Neumorphic Design System

Always use the established Neumorphic Design System when creating or updating UI components in this project.

1. **Buttons**: Use `btn btn-primary` and `btn btn-secondary` classes for action buttons. Do not use plain tailwind classes for buttons unless necessary.
2. **Form Inputs**: Use `form-input` and `form-select` classes for all data entry fields to hook into the global neumorphic shadows.
3. **Backgrounds (Split-View Layouts)**: 
   - **Top Header Nav**: Use `bg-white border-b border-slate-200 shadow-sm`.
   - **Left Pane (Print Preview Wrapper)**: Use `bg-slate-200`.
   - **Right Pane (Form Area)**: Use `var(--color-page-bg)` (or the tailwind `bg-[var(--color-page-bg)]` equivalent). Do not use this globally on the header/wrapper, only for the data entry form and main dashboard backgrounds to ensure the soft UI effect works properly.
4. **Shadows**: Use `var(--shadow-neu-drop)` and `var(--shadow-neu-inner)` for panels and cards that need to pop out or sink into the page.
5. **Split-View Editors**: When building document editors, always include the floating Zoom and Target Rows control panel at the bottom left of the preview pane. 
6. **Uniformity**: Ensure all new modules (like AOQ, RIS, etc.) perfectly match the layout and interaction patterns established in the PR, RFQ, and PO pages.
