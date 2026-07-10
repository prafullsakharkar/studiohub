# Forms

Forms use **React Hook Form** for state/performance and **Zod** for schema validation. Schemas are the single source of truth for both TypeScript types and validation rules.

## Pattern

```tsx
// src/modules/organization/components/DepartmentForm.tsx
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const departmentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  code: z.string().regex(/^[A-Z0-9_-]+$/, "Use uppercase letters, numbers, - or _"),
  officeId: z.string().uuid("Select an office"),
  managerId: z.string().uuid().optional(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export function DepartmentForm({ defaultValues, onSubmit }: DepartmentFormProps) {
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues,
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <TextField label="Name" {...form.register("name")} error={form.formState.errors.name} />
      <TextField label="Code" {...form.register("code")} error={form.formState.errors.code} />
      <OfficeSelect control={form.control} name="officeId" error={form.formState.errors.officeId} />
      <Button type="submit" isLoading={form.formState.isSubmitting}>
        Save
      </Button>
    </form>
  );
}
```

## Connecting to Mutations

Forms don't call the API directly — submit handlers call a mutation hook and translate server-side field errors back into the form:

```tsx
const createDepartment = useCreateDepartment();

async function handleSubmit(values: DepartmentFormValues) {
  try {
    await createDepartment.mutateAsync(values);
    toast.success("Department created");
    navigate("/organization/departments");
  } catch (error) {
    applyServerErrors(form, error as ApiError); // maps fieldErrors -> form.setError
  }
}
```

`applyServerErrors` is a shared utility that walks `ApiError.fieldErrors` (see `api-client.md`) and calls `form.setError(field, { message })` for each, so backend validation (`03-backend/validators.md`) and frontend validation surface through the same UI.

## Shared Form Fields

Generic, styled inputs live in `shared/components/form/` (`TextField`, `SelectField`, `DateField`, `CheckboxField`, etc.) and all accept a `react-hook-form`-compatible `error` prop plus standard HTML input props via `forwardRef`, so they compose with `register()` directly.

## Async/Dependent Fields

Fields that depend on server data (e.g. an office selector populated from the API) use a combination of `useController` (for RHF integration) and a React Query-backed options hook (`useOfficeOptions()`), keeping the async loading state separate from form validation state.

## Multi-Step Forms

Multi-step flows (e.g. user onboarding) split the Zod schema per step and merge with `.merge()`/`.and()`, validating each step independently while accumulating values in a parent `useForm` instance or a small `useReducer`-backed wizard state, depending on complexity.

## Validation Philosophy

Client-side validation exists for UX (immediate feedback), not as the authority. The API is always the final validator (`03-backend/validators.md`), and `applyServerErrors` ensures any mismatch between client and server rules is visible to the user rather than silently swallowed.
