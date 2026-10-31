import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, Layers, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { DEPARTMENT_TYPES, departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import type { DepartmentInput } from '@/api/masterdata/departments';
import { useServerForm } from '@/shared/forms/useServerForm';
import { fetchAllRows, listFetcher } from '@/shared/data/listing';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
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

const inputClass = (invalid: boolean) =>
  `w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 ${
    invalid ? 'border-rose-500' : 'border-slate-800'
  }`;

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

  const field = (name: keyof FormValues) => ({ ...register(name, { onChange: clearServerError }), 'aria-invalid': Boolean(errors[name]) });
  const error = (name: keyof FormValues) =>
    errors[name]?.message ? (
      <p role="alert" className="mt-1 text-[11px] text-rose-400">
        {errors[name]?.message}
      </p>
    ) : null;

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Link to={department ? `/departments/${department.id}` : '/departments'}>
          <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            Departments
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            {department ? `Edit ${department.name}` : 'New department'}
          </h1>
          <p className="text-xs text-slate-400">A functional division of the studio, its manager and its toolchain.</p>
        </div>
      </div>

      <Card>
        <CardBody>
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            {(serverError?.banner || serverError?.details.length) && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-800/70 bg-rose-950/60 p-3 text-xs text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div className="space-y-1">
                  {serverError?.banner && <p>{serverError.banner}</p>}
                  {serverError?.details.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  {serverError?.requestId && <p className="font-mono text-[10px] text-rose-300/70">Ref: {serverError.requestId}</p>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dept-name" className="block text-xs font-mono text-slate-400 mb-1">Name *</label>
                <input id="dept-name" type="text" placeholder="e.g. Lighting & LookDev" className={inputClass(Boolean(errors.name))} {...field('name')} />
                {error('name')}
              </div>
              <div>
                <label htmlFor="dept-code" className="block text-xs font-mono text-slate-400 mb-1">Code *</label>
                <input id="dept-code" type="text" placeholder="e.g. DEPT-LGT" className={`${inputClass(Boolean(errors.code))} font-mono`} {...field('code')} />
                {error('code')}
              </div>
              <div>
                <label htmlFor="dept-type" className="block text-xs font-mono text-slate-400 mb-1">Type *</label>
                <select id="dept-type" className={inputClass(Boolean(errors.department_type))} {...field('department_type')}>
                  {DEPARTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {error('department_type')}
              </div>
              <div>
                <label htmlFor="dept-parent" className="block text-xs font-mono text-slate-400 mb-1">Parent department</label>
                <select id="dept-parent" className={inputClass(Boolean(errors.parent))} {...field('parent')}>
                  <option value="">None (top level)</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} [{d.code}]
                    </option>
                  ))}
                </select>
                {error('parent')}
              </div>
              <div>
                <label htmlFor="dept-manager" className="block text-xs font-mono text-slate-400 mb-1">Manager</label>
                <select id="dept-manager" className={inputClass(Boolean(errors.manager))} {...field('manager')}>
                  <option value="">No manager assigned</option>
                  {(people.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
                {error('manager')}
              </div>
              <div>
                <label htmlFor="dept-color" className="block text-xs font-mono text-slate-400 mb-1">Accent color</label>
                <input id="dept-color" type="text" className={`${inputClass(Boolean(errors.color))} font-mono`} {...field('color')} />
                {error('color')}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="dept-stack" className="block text-xs font-mono text-slate-400 mb-1">Software stack (comma-separated)</label>
                <input id="dept-stack" type="text" placeholder="Houdini, Katana, USD, RenderMan" className={inputClass(false)} {...field('software_stack')} />
              </div>
            </div>

            <div>
              <label htmlFor="dept-description" className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea id="dept-description" rows={3} className={inputClass(Boolean(errors.description))} {...field('description')} />
              {error('description')}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link to="/departments">
                <Button variant="outline" size="sm" type="button">
                  Cancel
                </Button>
              </Link>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting} leftIcon={<Save className="w-4 h-4" />}>
                {department ? 'Save changes' : 'Create department'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export const CreateDepartmentPage: React.FC = () => <DepartmentForm />;
