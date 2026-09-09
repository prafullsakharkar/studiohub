// Platform Services Schemas (Zod validation)
import { z } from 'zod';
import {
    PlatformStatus,
    PlatformPriority,
    PlatformChannel,
    PlatformEventType,
    PlatformReportFormat,
    PlatformBillingInterval,
    PlatformThemeMode,
} from '@/modules/platform/types';

// Common schemas
export const paginationSchema = z.object({
    page: z.number().int().positive().optional(),
    page_size: z.number().int().positive().optional(),
    search: z.string().optional(),
    ordering: z.string().optional(),
});

export const dateRangeSchema = z.object({
    date_from: z.string().optional(),
    date_to: z.string().optional(),
});

export const idSchema = z.string().uuid();

// Notification schemas
export const notificationSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    message: z.string(),
    channel: z.enum(['EMAIL', 'IN_APP', 'WEBHOOK', 'SMS', 'PUSH']),
    status: z.enum(['SENT', 'DELIVERED', 'FAILED', 'PENDING']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    event_type: z.enum(['SYSTEM', 'SECURITY', 'COMPETITION', 'MATCH', 'PLAYER', 'TEAM', 'TRAINING', 'FINANCE', 'ADMINISTRATION', 'WORKFLOW', 'CUSTOM']),
    read: z.boolean(),
    archived: z.boolean(),
    metadata: z.record(z.string(), z.any()).optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const notificationTemplateSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    event_type: z.enum(['SYSTEM', 'SECURITY', 'COMPETITION', 'MATCH', 'PLAYER', 'TEAM', 'TRAINING', 'FINANCE', 'ADMINISTRATION', 'WORKFLOW', 'CUSTOM']),
    channel: z.enum(['EMAIL', 'IN_APP', 'WEBHOOK', 'SMS', 'PUSH']),
    subject: z.string(),
    body: z.string(),
    is_active: z.boolean(),
    variables: z.record(z.string(), z.string()).optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const webhookSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    url: z.string().url(),
    event: z.string(),
    status: z.enum(['ACTIVE', 'DISABLED']),
    secret: z.string().optional(),
    retry_policy: z.object({
        max_retries: z.number().int().positive(),
        retry_delay: z.number().int().positive(),
        backoff_multiplier: z.number().positive(),
    }),
    created_at: z.string(),
    updated_at: z.string(),
});

export const deliveryLogSchema = z.object({
    id: z.string().uuid(),
    webhook_id: z.string().uuid(),
    event_id: z.string().uuid(),
    status_code: z.number().int(),
    response_body: z.string().optional(),
    success: z.boolean(),
    retry_count: z.number().int().min(0),
    last_retry_at: z.string().optional(),
    created_at: z.string(),
});

// Notification schemas for forms
export const createNotificationTemplateSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    event_type: z.enum(['SYSTEM', 'SECURITY', 'COMPETITION', 'MATCH', 'PLAYER', 'TEAM', 'TRAINING', 'FINANCE', 'ADMINISTRATION', 'WORKFLOW', 'CUSTOM']),
    channel: z.enum(['EMAIL', 'IN_APP', 'WEBHOOK', 'SMS', 'PUSH']),
    subject: z.string().min(1, 'Subject is required'),
    body: z.string().min(1, 'Body is required'),
    is_active: z.boolean().optional(),
});

export const updateNotificationTemplateSchema = createNotificationTemplateSchema.partial();

export const createWebhookSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    url: z.string().url('Invalid URL'),
    event: z.string().min(1, 'Event is required'),
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
    retry_policy: z.object({
        max_retries: z.number().int().positive().optional(),
        retry_delay: z.number().int().positive().optional(),
        backoff_multiplier: z.number().positive().optional(),
    }).optional(),
});

export const updateWebhookSchema = createWebhookSchema.partial();

// Analytics schemas
export const dashboardSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    widgets: z.array(z.object({
        id: z.string().uuid(),
        type: z.string(),
        position: z.object({
            x: z.number().int(),
            y: z.number().int(),
            w: z.number().int(),
            h: z.number().int(),
        }),
        config: z.record(z.string(), z.any()),
    })),
    layout: z.object({
        rows: z.number().int().positive(),
        cols: z.number().int().positive(),
        grid: z.array(z.object({
            widget_id: z.string().uuid(),
            x: z.number().int(),
            y: z.number().int(),
            w: z.number().int(),
            h: z.number().int(),
        })),
    }),
    filters: z.array(z.object({
        id: z.string().uuid(),
        type: z.string(),
        label: z.string(),
        field: z.string(),
        value: z.unknown(),
        operator: z.string().optional(),
    })),
    is_favorited: z.boolean(),
    is_shared: z.boolean(),
    shared_with: z.array(z.string().uuid()),
    created_by: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const kpiSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    metric: z.string(),
    data_source: z.string(),
    aggregation: z.string(),
    formula: z.string().optional(),
    target: z.number().optional(),
    thresholds: z.array(z.object({
        id: z.string().uuid(),
        label: z.string(),
        min: z.number().optional(),
        max: z.number().optional(),
        color: z.string(),
    })).optional(),
    time_period: z.string(),
    dimensions: z.array(z.string()).optional(),
    filters: z.array(z.object({
        id: z.string().uuid(),
        type: z.string(),
        label: z.string(),
        field: z.string(),
        value: z.unknown(),
        operator: z.string().optional(),
    })).optional(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const reportSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    data_source: z.string(),
    fields: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        label: z.string(),
        type: z.string(),
        visible: z.boolean(),
    })).optional(),
    filters: z.array(z.object({
        id: z.string().uuid(),
        type: z.string(),
        label: z.string(),
        field: z.string(),
        value: z.unknown(),
        operator: z.string().optional(),
    })).optional(),
    sorting: z.array(z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
    })).optional(),
    grouping: z.array(z.string()).optional(),
    aggregation: z.string().optional(),
    calculated_fields: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        formula: z.string(),
        type: z.string(),
    })).optional(),
    parameters: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        label: z.string(),
        type: z.string(),
        required: z.boolean(),
        default_value: z.unknown().optional(),
    })).optional(),
    date_ranges: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        start_field: z.string(),
        end_field: z.string(),
    })).optional(),
    template: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const reportScheduleSchema = z.object({
    id: z.string().uuid(),
    report_id: z.string().uuid(),
    schedule_type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
    cron_expression: z.string().optional(),
    timezone: z.string(),
    recipients: z.array(z.string()),
    delivery_channel: z.enum(['EMAIL', 'WEBHOOK', 'STORAGE']),
    parameters: z.record(z.string(), z.any()).optional(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});

// Analytics schemas for forms
export const createDashboardSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    widgets: z.array(z.object({
        type: z.string().min(1, 'Type is required'),
        position: z.object({
            x: z.number().int(),
            y: z.number().int(),
            w: z.number().int(),
            h: z.number().int(),
        }),
        config: z.record(z.string(), z.any()).optional(),
    })).optional(),
    layout: z.object({
        rows: z.number().int().positive(),
        cols: z.number().int().positive(),
        grid: z.array(z.object({
            widget_id: z.string().uuid(),
            x: z.number().int(),
            y: z.number().int(),
            w: z.number().int(),
            h: z.number().int(),
        })),
    }).optional(),
    filters: z.array(z.object({
        type: z.string().min(1, 'Type is required'),
        label: z.string().min(1, 'Label is required'),
        field: z.string().min(1, 'Field is required'),
        value: z.unknown(),
        operator: z.string().optional(),
    })).optional(),
    is_favorited: z.boolean().optional(),
    is_shared: z.boolean().optional(),
    shared_with: z.array(z.string().uuid()).optional(),
});

export const updateDashboardSchema = createDashboardSchema.partial();

export const createKPISchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    metric: z.string().min(1, 'Metric is required'),
    data_source: z.string().min(1, 'Data source is required'),
    aggregation: z.string().min(1, 'Aggregation is required'),
    formula: z.string().optional(),
    target: z.number().optional(),
    thresholds: z.array(z.object({
        label: z.string().min(1, 'Label is required'),
        color: z.string().min(1, 'Color is required'),
    })).optional(),
    time_period: z.string().min(1, 'Time period is required'),
    dimensions: z.array(z.string()).optional(),
    filters: z.array(z.object({
        type: z.string().min(1, 'Type is required'),
        label: z.string().min(1, 'Label is required'),
        field: z.string().min(1, 'Field is required'),
        value: z.unknown(),
        operator: z.string().optional(),
    })).optional(),
    is_active: z.boolean().optional(),
});

export const updateKPISchema = createKPISchema.partial();

export const createReportSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    data_source: z.string().min(1, 'Data source is required'),
    fields: z.array(z.object({
        name: z.string().min(1, 'Name is required'),
        label: z.string().min(1, 'Label is required'),
        type: z.string().min(1, 'Type is required'),
        visible: z.boolean().optional(),
    })).optional(),
    filters: z.array(z.object({
        type: z.string().min(1, 'Type is required'),
        label: z.string().min(1, 'Label is required'),
        field: z.string().min(1, 'Field is required'),
        value: z.unknown(),
        operator: z.string().optional(),
    })).optional(),
    sorting: z.array(z.object({
        field: z.string().min(1, 'Field is required'),
        direction: z.enum(['asc', 'desc']),
    })).optional(),
    grouping: z.array(z.string()).optional(),
    aggregation: z.string().optional(),
    calculated_fields: z.array(z.object({
        name: z.string().min(1, 'Name is required'),
        formula: z.string().min(1, 'Formula is required'),
        type: z.string().min(1, 'Type is required'),
    })).optional(),
    parameters: z.array(z.object({
        name: z.string().min(1, 'Name is required'),
        label: z.string().min(1, 'Label is required'),
        type: z.string().min(1, 'Type is required'),
        required: z.boolean().optional(),
        default_value: z.unknown().optional(),
    })).optional(),
    date_ranges: z.array(z.object({
        name: z.string().min(1, 'Name is required'),
        start_field: z.string().min(1, 'Start field is required'),
        end_field: z.string().min(1, 'End field is required'),
    })).optional(),
    template: z.string().optional(),
});

export const updateReportSchema = createReportSchema.partial();

export const createReportScheduleSchema = z.object({
    report_id: z.string().uuid('Invalid report ID'),
    schedule_type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
    cron_expression: z.string().optional(),
    timezone: z.string().min(1, 'Timezone is required'),
    recipients: z.array(z.string().min(1, 'Recipient is required')).min(1, 'At least one recipient is required'),
    delivery_channel: z.enum(['EMAIL', 'WEBHOOK', 'STORAGE']),
    parameters: z.record(z.string(), z.any()).optional(),
    is_active: z.boolean().optional(),
});

export const updateReportScheduleSchema = createReportScheduleSchema.partial();

// Billing schemas
export const subscriptionSchema = z.object({
    id: z.string().uuid(),
    plan_id: z.string().uuid(),
    plan_name: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING']),
    billing_interval: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    current_period_start: z.string(),
    current_period_end: z.string(),
    cancel_at_period_end: z.boolean(),
    cancel_reason: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const planSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number().positive(),
    currency: z.string().length(3),
    billing_interval: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    features: z.array(z.string()).optional(),
    usage_limits: z.record(z.string(), z.number()).optional(),
    user_limits: z.number().int().positive().optional(),
    storage_limits: z.number().int().positive().optional(),
    module_availability: z.array(z.string()).optional(),
    is_active: z.boolean(),
    is_default: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const invoiceSchema = z.object({
    id: z.string().uuid(),
    subscription_id: z.string().uuid(),
    period_start: z.string(),
    period_end: z.string(),
    amount: z.number().positive(),
    currency: z.string().length(3),
    status: z.enum(['PAID', 'PENDING', 'OVERDUE', 'FAILED', 'CANCELLED', 'REFUNDED']),
    payment_status: z.enum(['PAID', 'PENDING', 'OVERDUE', 'FAILED', 'CANCELLED', 'REFUNDED']),
    line_items: z.array(z.object({
        description: z.string(),
        quantity: z.number().int().positive(),
        unit_price: z.number().positive(),
        total: z.number().positive(),
    })),
    tax: z.number().positive().optional(),
    discount: z.number().positive().optional(),
    total: z.number().positive(),
    invoice_url: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const paymentSchema = z.object({
    id: z.string().uuid(),
    subscription_id: z.string().uuid(),
    invoice_id: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().length(3),
    status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
    payment_method: z.string(),
    transaction_id: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const usageSchema = z.object({
    resource: z.string(),
    current_count: z.number().int().min(0),
    limit: z.number().int().positive().nullable(),
    period_start: z.string(),
    period_end: z.string(),
});

// Billing schemas for forms
export const createPlanSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    price: z.number().positive('Price must be positive'),
    currency: z.string().length(3, 'Currency must be a 3-letter code'),
    billing_interval: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    features: z.array(z.string()).optional(),
    usage_limits: z.record(z.string(), z.number()).optional(),
    user_limits: z.number().int().positive().optional(),
    storage_limits: z.number().int().positive().optional(),
    module_availability: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
    is_default: z.boolean().optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

// Whitelabel schemas
export const brandingConfigSchema = z.object({
    id: z.string().uuid(),
    organization_name: z.string(),
    organization_logo: z.string().optional(),
    favicon: z.string().optional(),
    primary_color: z.string(),
    secondary_color: z.string(),
    accent_color: z.string(),
    background_color: z.string(),
    text_color: z.string(),
    light_mode: z.object({
        primary: z.string(),
        secondary: z.string(),
        background: z.string(),
        text: z.string(),
    }),
    dark_mode: z.object({
        primary: z.string(),
        secondary: z.string(),
        background: z.string(),
        text: z.string(),
    }),
    created_at: z.string(),
    updated_at: z.string(),
});

export const themeConfigSchema = z.object({
    id: z.string().uuid(),
    mode: z.enum(['dark', 'light', 'system']),
    primary_color: z.string(),
    secondary_color: z.string(),
    accent_color: z.string(),
    background_color: z.string(),
    text_color: z.string(),
    border_radius: z.number().int().min(0).max(24),
    font_family: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const emailBrandingSchema = z.object({
    id: z.string().uuid(),
    from_name: z.string(),
    from_email: z.string().email(),
    reply_to: z.string().email(),
    logo: z.string().optional(),
    header_color: z.string(),
    footer_text: z.string(),
    unsubscribe_text: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const loginPageConfigSchema = z.object({
    id: z.string().uuid(),
    background_image: z.string().optional(),
    logo: z.string().optional(),
    title: z.string(),
    subtitle: z.string(),
    primary_color: z.string(),
    secondary_color: z.string(),
    show_branding: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const domainSchema = z.object({
    id: z.string().uuid(),
    domain_name: z.string(),
    status: z.enum(['PENDING', 'VERIFYING', 'VERIFIED', 'FAILED']),
    ssl_status: z.enum(['VALID', 'EXPIRED', 'INVALID', 'PENDING']),
    verification_instructions: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

// Whitelabel schemas for forms
export const updateBrandingConfigSchema = z.object({
    organization_name: z.string().min(1, 'Organization name is required'),
    organization_logo: z.string().optional(),
    favicon: z.string().optional(),
    primary_color: z.string().min(1, 'Primary color is required'),
    secondary_color: z.string().min(1, 'Secondary color is required'),
    accent_color: z.string().min(1, 'Accent color is required'),
    background_color: z.string().min(1, 'Background color is required'),
    text_color: z.string().min(1, 'Text color is required'),
    light_mode: z.object({
        primary: z.string().min(1, 'Primary color is required'),
        secondary: z.string().min(1, 'Secondary color is required'),
        background: z.string().min(1, 'Background color is required'),
        text: z.string().min(1, 'Text color is required'),
    }).optional(),
    dark_mode: z.object({
        primary: z.string().min(1, 'Primary color is required'),
        secondary: z.string().min(1, 'Secondary color is required'),
        background: z.string().min(1, 'Background color is required'),
        text: z.string().min(1, 'Text color is required'),
    }).optional(),
});

export const updateThemeConfigSchema = z.object({
    mode: z.enum(['dark', 'light', 'system']),
    primary_color: z.string().min(1, 'Primary color is required'),
    secondary_color: z.string().min(1, 'Secondary color is required'),
    accent_color: z.string().min(1, 'Accent color is required'),
    background_color: z.string().min(1, 'Background color is required'),
    text_color: z.string().min(1, 'Text color is required'),
    border_radius: z.number().int().min(0).max(24),
    font_family: z.string().min(1, 'Font family is required'),
});

export const updateEmailBrandingSchema = z.object({
    from_name: z.string().min(1, 'From name is required'),
    from_email: z.string().email('Invalid email address'),
    reply_to: z.string().email('Invalid email address'),
    logo: z.string().optional(),
    header_color: z.string().min(1, 'Header color is required'),
    footer_text: z.string().min(1, 'Footer text is required'),
    unsubscribe_text: z.string().min(1, 'Unsubscribe text is required'),
});

export const updateLoginPageConfigSchema = z.object({
    background_image: z.string().optional(),
    logo: z.string().optional(),
    title: z.string().min(1, 'Title is required'),
    subtitle: z.string().min(1, 'Subtitle is required'),
    primary_color: z.string().min(1, 'Primary color is required'),
    secondary_color: z.string().min(1, 'Secondary color is required'),
    show_branding: z.boolean().optional(),
});

export const addDomainSchema = z.object({
    domain_name: z.string().min(1, 'Domain name is required'),
    verification_instructions: z.string().optional(),
});

// Export types
export type NotificationSchema = z.infer<typeof notificationSchema>;
export type NotificationTemplateSchema = z.infer<typeof notificationTemplateSchema>;
export type WebhookSchema = z.infer<typeof webhookSchema>;
export type DeliveryLogSchema = z.infer<typeof deliveryLogSchema>;
export type CreateNotificationTemplateSchema = z.infer<typeof createNotificationTemplateSchema>;
export type UpdateNotificationTemplateSchema = z.infer<typeof updateNotificationTemplateSchema>;
export type CreateWebhookSchema = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookSchema = z.infer<typeof updateWebhookSchema>;

export type DashboardSchema = z.infer<typeof dashboardSchema>;
export type KPISchema = z.infer<typeof kpiSchema>;
export type ReportSchema = z.infer<typeof reportSchema>;
export type ReportScheduleSchema = z.infer<typeof reportScheduleSchema>;
export type CreateDashboardSchema = z.infer<typeof createDashboardSchema>;
export type UpdateDashboardSchema = z.infer<typeof updateDashboardSchema>;
export type CreateKPISchema = z.infer<typeof createKPISchema>;
export type UpdateKPISchema = z.infer<typeof updateKPISchema>;
export type CreateReportSchema = z.infer<typeof createReportSchema>;
export type UpdateReportSchema = z.infer<typeof updateReportSchema>;
export type CreateReportScheduleSchema = z.infer<typeof createReportScheduleSchema>;
export type UpdateReportScheduleSchema = z.infer<typeof updateReportScheduleSchema>;

export type SubscriptionSchema = z.infer<typeof subscriptionSchema>;
export type PlanSchema = z.infer<typeof planSchema>;
export type InvoiceSchema = z.infer<typeof invoiceSchema>;
export type PaymentSchema = z.infer<typeof paymentSchema>;
export type UsageSchema = z.infer<typeof usageSchema>;
export type CreatePlanSchema = z.infer<typeof createPlanSchema>;
export type UpdatePlanSchema = z.infer<typeof updatePlanSchema>;

export type BrandingConfigSchema = z.infer<typeof brandingConfigSchema>;
export type ThemeConfigSchema = z.infer<typeof themeConfigSchema>;
export type EmailBrandingSchema = z.infer<typeof emailBrandingSchema>;
export type LoginPageConfigSchema = z.infer<typeof loginPageConfigSchema>;
export type DomainSchema = z.infer<typeof domainSchema>;
export type UpdateBrandingConfigSchema = z.infer<typeof updateBrandingConfigSchema>;
export type UpdateThemeConfigSchema = z.infer<typeof updateThemeConfigSchema>;
export type UpdateEmailBrandingSchema = z.infer<typeof updateEmailBrandingSchema>;
export type UpdateLoginPageConfigSchema = z.infer<typeof updateLoginPageConfigSchema>;
export type AddDomainSchema = z.infer<typeof addDomainSchema>;
