Employees — EmployeeRecord guidance (non-payroll)

Purpose

Describe the Employee record used for production and capacity planning without becoming a payroll system.

Recommended fields

- employee_id UUID
- person_id UUID
- organization_id UUID
- employee_number
- employment_type (permanent|contract|temp)
- department_id
- manager_id
- location
- cost_classification
- start_date
- end_date
- work_arrangement (office|remote|hybrid)
- metadata JSONB

Notes

- Do not store payroll salary or bank account information in StudioHub unless explicitly required by integration.
- Prefer HR/HRIS as system-of-record for employment changes; implement adapter flows.

Next steps

- Inventory existing models for employment data and map to this spec.