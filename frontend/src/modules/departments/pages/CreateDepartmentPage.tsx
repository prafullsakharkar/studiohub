import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { DEPARTMENT_TYPES, departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import type { DepartmentInput } from '@/api/masterdata/departments';
import { useServerForm } from '@/shared/forms/useServerForm';
import { fetchAllRows, listFetcher } from '@/shared/data/listing';
import { Field, inputClass } from '@/shared/forms/FormParts';
import { FormPage } from '@/shared/forms/FormPage';
import type { Department } from '@/api/masterdata/departments';
import { useCreateDepartment, useUpdateDepartment } from '../hooks/useDepartmentList';

// Limits mirror the model: code max_length=30, color max_length=20 (apps/masterdata/models/department.py).
const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  code: z.string().trim().min(1, 'Code is required').max(30, 'Code can be at most 30 characters'),
  department_type: z.enum(['production', 'creative', 'technical', 'support', 'administration']),
  description: z.string(),
  parent: z.string(),
  manager: z.string(),
  color: z.string().max(20),
  software_stack: z.string(),
});
type FormValues = z.infer<typeof schema>;

const peopleFetcher = listFetcher<{ id: string; full_name: string }>('/api/v1/people/');

/** The department form: empty to create, or filled from `department` to edit it. */
export const DepartmentForm: React.FC<{ department?: Department }> = ({ department }) => {
  const navigate = useNavigate();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment(department?.id ?? '');

  // Pickers need every row, not the first page of 25.
  const departments = useQuery({
    queryKey: [...departmentKeys.all, 'options'],
    queryFn: ({ signal }) => fetchAllRows(departmentsApi.list, { ordering: 'name' }, { signal }),
    staleTime: 60_000,
  });
  const people = useQuery({
    queryKey: ['people', 'options'],
    queryFn: ({ signal }) => fetchAllRows(peopleFetcher, { ordering: 'name' }, { signal }),
    staleTime: 60_000,
  });

  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: department
      ? { name: department.name, code: department.code, department_type: department.department_type, description: department.description ?? '', parent: department.parent ?? '', manager: department.manager ?? '', color: department.color ?? '', software_stack: (department.software_stack ?? []).join(', ') }
      : { name: '', code: '', department_type: 'creative', description: '', parent: '', manager: '', color: '#6366f1', software_stack: '' },
  });

  const onSubmit = submit(async (values) => {
    const input: DepartmentInput = {
      name: values.name,
      code: values.code,
      department_type: values.department_type,
      description: values.description,
      color: values.color,
      parent: values.parent || null,
      manager: values.manager || null,
      software_stack: values.software_stack.split(',').map((s) => s.trim()).filter(Boolean),
    };
    const saved = department ? await updateDepartment.mutateAsync(input) : await createDepartment.mutateAsync(input);
    navigate(`/departments/${saved.id}`);
  });

  const text = (name: keyof FormValues) => register(name, { onChange: clearServerError });

  return (
    <FormPage
      title={department ? `Edit ${department.name}` : 'New department'}
      description="A functional division of the studio, its manager and its toolchain."
      icon={<Layers />}
      editing={Boolean(department)}
      backTo={department ? `/departments/${department.id}` : '/departments'}
      backLabel="Departments"
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      serverError={serverError}
      submitLabel={department ? 'Save changes' : 'Create department'}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="dept-name" label="Name *" error={errors.name?.message}>
          <input id="dept-name" type="text" placeholder="e.g. Lighting & LookDev" className={inputClass(Boolean(errors.name))} {...text('name')} />
        </Field>
        <Field id="dept-code" label="Code *" error={errors.code?.message}>
          <input id="dept-code" type="text" placeholder="e.g. DEPT-LGT" className={`${inputClass(Boolean(errors.code))} font-mono`} {...text('code')} />
        </Field>
        <Field id="dept-type" label="Type *" error={errors.department_type?.message}>
          <select id="dept-type" className={inputClass(Boolean(errors.department_type))} {...text('department_type')}>
            {DEPARTMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dept-parent" label="Parent department" error={errors.parent?.message}>
          <select id="dept-parent" className={inputClass(Boolean(errors.parent))} {...text('parent')}>
            <option value="">None (top level)</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} [{d.code}]
              </option>
            ))}
          </select>
        </Field>
        <Field id="dept-manager" label="Manager" error={errors.manager?.message}>
          <select id="dept-manager" className={inputClass(Boolean(errors.manager))} {...text('manager')}>
            <option value="">No manager assigned</option>
            {(people.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dept-color" label="Accent color" error={errors.color?.message}>
          <input id="dept-color" type="text" className={`${inputClass(Boolean(errors.color))} font-mono`} {...text('color')} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="dept-stack" label="Software stack (comma-separated)">
            <input id="dept-stack" type="text" placeholder="Houdini, Katana, USD, RenderMan" className={inputClass(false)} {...text('software_stack')} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="dept-description" label="Description" error={errors.description?.message}>
            <textarea id="dept-description" rows={3} className={inputClass(Boolean(errors.description))} {...text('description')} />
          </Field>
        </div>
      </div>
    </FormPage>
  );
};

export const CreateDepartmentPage: React.FC = () => <DepartmentForm />;
