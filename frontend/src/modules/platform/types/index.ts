// Platform Services Types

// Common types for all Platform Services
export type PlatformStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'DRAFT' | 'PENDING' | 'FAILED' | 'COMPLETED' | 'QUEUED' | 'GENERATING' | 'CANCELLED' | 'PAUSED' | 'VERIFIED' | 'VERIFYING' | 'DISABLED';

export type PlatformPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type PlatformChannel = 'EMAIL' | 'IN_APP' | 'WEBHOOK' | 'SMS' | 'PUSH';

export type PlatformEventType = 'SYSTEM' | 'SECURITY' | 'COMPETITION' | 'MATCH' | 'PLAYER' | 'TEAM' | 'TRAINING' | 'FINANCE' | 'ADMINISTRATION' | 'WORKFLOW' | 'CUSTOM';

export type PlatformReportFormat = 'PDF' | 'CSV' | 'XLSX' | 'JSON';

export type PlatformBillingInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type PlatformThemeMode = 'dark' | 'light' | 'system';

// Pagination types
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface PageRequest {
    page?: number;
    page_size?: number;
    search?: string;
    ordering?: string;
    [key: string]: string | number | boolean | null | undefined;
}

// Audit types
export interface AuditLog {
    id: string;
    timestamp: string;
    actor: string;
    actor_email: string;
    action: string;
    resource_type: string;
    resource_id: string;
    resource_name?: string;
    organization?: string;
    organization_id?: string;
    ip_address?: string;
    user_agent?: string;
    request_id?: string;
    status: 'SUCCESS' | 'FAILURE';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    previous_values?: Record<string, unknown>;
    new_values?: Record<string, unknown>;
    changed_fields?: string[];
}

// Activity types
export interface ActivityItem {
    id: string;
    timestamp: string;
    actor: string;
    actor_avatar?: string;
    action: string;
    target?: string;
    target_type?: string;
    target_id?: string;
    details?: string;
    metadata?: Record<string, unknown>;
}

// Permission types
export interface PermissionDefinition {
    code: string;
    name: string;
    description: string;
    module: string;
    resource: string;
    category: 'read' | 'create' | 'update' | 'delete' | 'manage' | 'special';
}

// Feature flag types
export interface FeatureFlag {
    key: string;
    enabled: boolean;
    scope: 'GLOBAL' | 'ORGANIZATION' | 'USER';
    description?: string;
}

// Subscription types
export interface Subscription {
    id: string;
    plan_id: string;
    plan_name: string;
    status: PlatformStatus;
    billing_cycle: PlatformBillingInterval;
    renewal_date: string;
    current_period_start: string;
    current_period_end: string;
    usage: Record<string, number>;
    limits: Record<string, number>;
    features: string[];
    payment_status: 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
    created_at: string;
    updated_at: string;
}

// Plan types
export interface Plan {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    billing_interval: PlatformBillingInterval;
    features: string[];
    usage_limits: Record<string, number>;
    user_limits: number;
    storage_limits: number;
    module_availability: string[];
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

// Invoice types
export interface Invoice {
    id: string;
    invoice_number: string;
    customer_id: string;
    customer_name: string;
    billing_period_start: string;
    billing_period_end: string;
    line_items: InvoiceLineItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    status: PlatformStatus;
    payment_status: 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
    payment_history: Payment[];
    created_at: string;
    updated_at: string;
}

export interface InvoiceLineItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

// Payment types
export interface Payment {
    id: string;
    amount: number;
    currency: string;
    method: string;
    transaction_id: string;
    date: string;
    status: PlatformStatus;
    failure_reason?: string;
}

// Usage types
export interface Usage {
    resource: string;
    current: number;
    limit: number;
    percentage: number;
    history: UsageHistory[];
    forecast?: number;
}

export interface UsageHistory {
    date: string;
    value: number;
}

// Branding types
export interface BrandingConfig {
    id: string;
    organization_id: string;
    logo_url?: string;
    favicon_url?: string;
    login_logo_url?: string;
    brand_name: string;
    company_name: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    email_branding?: EmailBranding;
    theme_config?: ThemeConfig;
    login_page_config?: LoginPageConfig;
    is_published: boolean;
    published_at?: string;
    created_at: string;
    updated_at: string;
}

export interface EmailBranding {
    sender_name: string;
    sender_address: string;
    logo_url?: string;
    header_html?: string;
    footer_html?: string;
    primary_color: string;
    secondary_color: string;
}

export interface ThemeConfig {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    text_color: string;
    border_radius: number;
    density: 'compact' | 'comfortable' | 'spacious';
    light_mode: ThemePalette;
    dark_mode: ThemePalette;
}

export interface ThemePalette {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    success: string;
    warning: string;
    info: string;
}

export interface LoginPageConfig {
    logo_url?: string;
    background_url?: string;
    brand_name: string;
    welcome_message: string;
    support_links: SupportLink[];
    terms_link?: string;
    privacy_link?: string;
}

export interface SupportLink {
    label: string;
    url: string;
    icon?: string;
}

// Domain types
export interface Domain {
    id: string;
    domain_name: string;
    organization_id: string;
    status: PlatformStatus;
    dns_verification: DomainVerification;
    ssl_status: 'VALID' | 'EXPIRED' | 'INVALID' | 'PENDING';
    ssl_certificate?: SslCertificate;
    verification_instructions?: string;
    last_verified_at?: string;
    created_at: string;
    updated_at: string;
}

export interface DomainVerification {
    type: 'CNAME' | 'TXT' | 'A';
    record_name: string;
    record_value: string;
    verified: boolean;
    verified_at?: string;
}

export interface SslCertificate {
    issuer: string;
    valid_from: string;
    valid_to: string;
    subject: string;
    fingerprint: string;
}

// Notification types
export interface Notification {
    id: string;
    title: string;
    message: string;
    channel: PlatformChannel;
    status: 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING';
    priority: PlatformPriority;
    type: PlatformEventType;
    related_entity?: string;
    related_entity_id?: string;
    deep_link?: string;
    read: boolean;
    archived: boolean;
    created_at: string;
    updated_at: string;
    metadata?: Record<string, unknown>;
}

export interface NotificationTemplate {
    id: string;
    name: string;
    description: string;
    event_type: PlatformEventType;
    channel: PlatformChannel;
    subject: string;
    body: string;
    variables: string[];
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface Webhook {
    id: string;
    name: string;
    endpoint_url: string;
    events: string[];
    secret: string;
    headers: Record<string, string>;
    retry_policy: WebhookRetryPolicy;
    timeout: number;
    status: 'ACTIVE' | 'DISABLED';
    last_delivery?: string;
    failure_count: number;
    created_at: string;
    updated_at: string;
}

export interface WebhookRetryPolicy {
    max_retries: number;
    initial_delay: number;
    max_delay: number;
    backoff_multiplier: number;
}

export interface DeliveryLog {
    id: string;
    webhook_id: string;
    webhook_name: string;
    event_id: string;
    payload: Record<string, unknown>;
    response: Record<string, unknown>;
    status_code: number;
    error?: string;
    attempt_history: DeliveryAttempt[];
    timestamp: string;
    duration_ms: number;
}

export interface DeliveryAttempt {
    attempt_number: number;
    timestamp: string;
    status_code: number;
    error?: string;
    duration_ms: number;
}

// Analytics types
export interface Dashboard {
    id: string;
    name: string;
    description: string;
    widgets: DashboardWidget[];
    layout: DashboardLayout;
    filters: AnalyticsFilter[];
    is_favorited: boolean;
    is_shared: boolean;
    shared_with: string[];
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface DashboardLayout {
    rows: number;
    cols: number;
    grid: DashboardGridItem[];
}

export interface DashboardGridItem {
    widget_id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface DashboardWidget {
    id: string;
    type: WidgetType;
    title: string;
    position: WidgetPosition;
    size: WidgetSize;
    config: WidgetConfig;
}

export interface WidgetPosition {
    x: number;
    y: number;
}

export interface WidgetSize {
    w: number;
    h: number;
}

export interface WidgetConfig {
    [key: string]: unknown;
}

export type WidgetType =
    | 'kpi_card'
    | 'line_chart'
    | 'area_chart'
    | 'bar_chart'
    | 'stacked_chart'
    | 'pie_chart'
    | 'donut_chart'
    | 'table'
    | 'heatmap'
    | 'progress_indicator'
    | 'comparison_widget'
    | 'trend_indicator';

export interface AnalyticsFilter {
    id: string;
    type: FilterType;
    label: string;
    field: string;
    value: unknown;
    operator?: string;
}

export type FilterType =
    | 'organization'
    | 'competition'
    | 'tournament'
    | 'team'
    | 'player'
    | 'match'
    | 'venue'
    | 'date_range'
    | 'season'
    | 'module';

export interface KPI {
    id: string;
    name: string;
    description: string;
    metric: string;
    data_source: string;
    aggregation: string;
    formula?: string;
    target?: number;
    thresholds: KPIThreshold[];
    time_period: string;
    dimensions: string[];
    filters: AnalyticsFilter[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface KPIThreshold {
    id: string;
    label: string;
    min?: number;
    max?: number;
    color: string;
}

// Report types
export interface Report {
    id: string;
    name: string;
    description: string;
    data_source: string;
    fields: ReportField[];
    filters: AnalyticsFilter[];
    sorting: ReportSorting[];
    grouping: string[];
    aggregation: string;
    calculated_fields: ReportCalculatedField[];
    parameters: ReportParameter[];
    date_ranges: ReportDateRange[];
    template?: string;
    status: PlatformStatus;
    generated_by?: string;
    generated_at?: string;
    created_at: string;
    updated_at: string;
}

export interface ReportField {
    id: string;
    name: string;
    label: string;
    type: string;
    visible: boolean;
}

export interface ReportSorting {
    field: string;
    direction: 'asc' | 'desc';
}

export interface ReportCalculatedField {
    id: string;
    name: string;
    formula: string;
    type: string;
}

export interface ReportParameter {
    id: string;
    name: string;
    label: string;
    type: string;
    required: boolean;
    default_value?: unknown;
}

export interface ReportDateRange {
    id: string;
    name: string;
    start_field: string;
    end_field: string;
}

export interface ReportSchedule {
    id: string;
    report_id: string;
    report_name: string;
    schedule_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    cron_expression?: string;
    timezone: string;
    recipients: string[];
    delivery_channel: 'EMAIL' | 'WEBHOOK' | 'STORAGE';
    parameters?: Record<string, unknown>;
    is_active: boolean;
    last_run_at?: string;
    next_run_at?: string;
    created_at: string;
    updated_at: string;
}

export interface ReportGeneration {
    id: string;
    report_id: string;
    report_name: string;
    status: PlatformStatus;
    generated_by: string;
    timestamp: string;
    duration_ms: number;
    file_size?: number;
    format: PlatformReportFormat;
    failure_reason?: string;
    file_url?: string;
    created_at: string;
}

// Common response types
export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface ErrorResponse {
    detail?: string;
    non_field_errors?: string[];
    [field: string]: string | string[] | undefined;
}

// Form types
export interface FormState {
    isDirty: boolean;
    isValid: boolean;
    isSubmitting: boolean;
    isValidating: boolean;
}

// Toast notification types
export interface ToastNotification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

// Export types
export interface ExportRequest {
    format: PlatformReportFormat;
    filters?: AnalyticsFilter[];
    fields?: string[];
}

export interface ExportResponse {
    file_url: string;
    file_name: string;
    file_size: number;
    format: PlatformReportFormat;
}

// Import types
export interface ImportRequest {
    file_url: string;
    mapping?: Record<string, string>;
    on_conflict: 'SKIP' | 'UPDATE' | 'ERROR';
}

export interface ImportResponse {
    total: number;
    success: number;
    failed: number;
    errors: ImportError[];
}

export interface ImportError {
    row: number;
    field: string;
    error: string;
    value: string;
}

// Bulk action types
export interface BulkActionRequest {
    ids: string[];
    action: string;
    data?: Record<string, unknown>;
}

export interface BulkActionResponse {
    success: number;
    failed: number;
    errors: Record<string, string>;
}

// Date range types
export interface DateRange {
    start: string;
    end: string;
}

// Search types
export interface SearchQuery {
    query: string;
    filters?: AnalyticsFilter[];
    page?: number;
    page_size?: number;
}

// Sort types
export interface SortConfig {
    field: string;
    direction: 'asc' | 'desc';
}

// Column visibility types
export interface ColumnVisibility {
    [key: string]: boolean;
}

// Row selection types
export interface RowSelection {
    selectedIds: string[];
    isAllSelected: boolean;
}

// Permission check types
export interface PermissionCheck {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canManage: boolean;
}

// Feature flag check types
export interface FeatureFlagCheck {
    isFeatureEnabled: boolean;
    isEntitled: boolean;
    subscriptionRequired?: boolean;
}

// Theme types
export interface ThemeColors {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    text: string;
    textSecondary: string;
    border: string;
}

// Common API response types
export interface ListResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface DetailResponse<T> {
    data: T;
}

export interface CreateResponse<T> {
    data: T;
    message: string;
}

export interface UpdateResponse<T> {
    data: T;
    message: string;
}

export interface DeleteResponse {
    message: string;
}

export interface ActionResponse {
    success: boolean;
    message: string;
    data?: unknown;
}
