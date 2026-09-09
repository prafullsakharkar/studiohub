"""
Core constants module.

Provides application-wide constants and configuration values.
"""

from __future__ import annotations

# Default pagination settings
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 500
MIN_PAGE_SIZE = 1

# Default pagination query parameters
PAGE_QUERY_PARAM = "page"
PAGE_SIZE_QUERY_PARAM = "page_size"

# Default ordering
DEFAULT_ORDERING = "-created_at"
ORDERING_QUERY_PARAM = "ordering"

# Search settings
SEARCH_QUERY_PARAM = "search"
SEARCH_FIELDS = []

# Filter settings
FILTER_QUERY_PARAM = "filter"

# API settings
API_VERSION = "v1"
API_VERSION_QUERY_PARAM = "version"
API_VERSION_HEADER = "X-API-Version"

# Date format settings
DATE_FORMAT = "%Y-%m-%d"
DATETIME_FORMAT = "%Y-%m-%dT%H:%M:%S"
ISO_8601_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"

# Pagination page sizes
SMALL_PAGE_SIZE = 10
MEDIUM_PAGE_SIZE = 25
LARGE_PAGE_SIZE = 100
EXPORT_PAGE_SIZE = 1000

# Cache settings
CACHE_TIMEOUT_SHORT = 60  # 1 minute
CACHE_TIMEOUT_MEDIUM = 300  # 5 minutes
CACHE_TIMEOUT_LONG = 3600  # 1 hour
CACHE_TIMEOUT_DAY = 86400  # 1 day

# Rate limiting settings
RATE_LIMIT_ANONYMOUS = "100/h"
RATE_LIMIT_AUTHENTICATED = "1000/h"
RATE_LIMIT_REQUESTS = "10/m"

# File upload settings
MAX_FILE_SIZE = 10485760  # 10 MB
MAX_IMAGE_SIZE = 5242880  # 5 MB
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_FILE_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
]

# Email settings
EMAIL_MAX_RECIPIENTS = 50
EMAIL_MAX_ATTACHMENT_SIZE = 26214400  # 25 MB

# Session settings
SESSION_TIMEOUT = 3600  # 1 hour
SESSION_TIMEOUT_EXTENDED = 86400  # 1 day

# Audit settings
AUDIT_LOG_RETENTION_DAYS = 365
AUDIT_LOG_MAX_ENTRIES = 10000

# Notification settings
NOTIFICATION_MAX_RETRIES = 3
NOTIFICATION_RETRY_DELAY = 60  # seconds

# Export settings
EXPORT_MAX_ROWS = 100000
EXPORT_TIMEOUT = 300  # 5 minutes

# Import settings
IMPORT_MAX_ROWS = 10000
IMPORT_TIMEOUT = 300  # 5 minutes

# Validation settings
MAX_STRING_LENGTH = 255
MAX_TEXT_LENGTH = 10000
MAX_JSON_LENGTH = 100000

# UUID settings
UUID_VERSION = 4

# Status choices
STATUS_ACTIVE = "active"
STATUS_INACTIVE = "inactive"
STATUS_PENDING = "pending"
STATUS_DRAFT = "draft"
STATUS_ARCHIVED = "archived"
STATUS_DELETED = "deleted"

# Lifecycle choices
LIFECYCLE_ACTIVE = "active"
LIFECYCLE_INACTIVE = "inactive"
LIFECYCLE_DRAFT = "draft"
LIFECYCLE_ARCHIVED = "archived"

# Record status choices
RECORD_STATUS_ACTIVE = "active"
RECORD_STATUS_INACTIVE = "inactive"
RECORD_STATUS_DRAFT = "draft"
RECORD_STATUS_ARCHIVED = "archived"
RECORD_STATUS_DELETED = "deleted"

# Visibility choices
VISIBILITY_PUBLIC = "public"
VISIBILITY_PRIVATE = "private"
VISIBILITY_ORGANIZATION = "organization"
VISIBILITY_TEAM = "team"

# Priority choices
PRIORITY_LOW = "low"
PRIORITY_MEDIUM = "medium"
PRIORITY_HIGH = "high"
PRIORITY_CRITICAL = "critical"

# Permission choices
PERMISSION_READ = "read"
PERMISSION_WRITE = "write"
PERMISSION_DELETE = "delete"
PERMISSION_ADMIN = "admin"

# Role choices
ROLE_USER = "user"
ROLE_ADMIN = "admin"
ROLE_OWNER = "owner"
ROLE_GUEST = "guest"
ROLE_VIEWER = "viewer"
ROLE_EDITOR = "editor"

# Organization type choices
ORGANIZATION_TYPE_COMPANY = "company"
ORGANIZATION_TYPE_TEAM = "team"
ORGANIZATION_TYPE_CLUB = "club"
ORGANIZATION_TYPE_ASSOCIATION = "association"

# Department type choices
DEPARTMENT_TYPE_SALES = "sales"
DEPARTMENT_TYPE_MARKETING = "marketing"
DEPARTMENT_TYPE_ENGINEERING = "engineering"
DEPARTMENT_TYPE_HR = "hr"
DEPARTMENT_TYPE_FINANCE = "finance"
DEPARTMENT_TYPE_SUPPORT = "support"

# Office type choices
OFFICE_TYPE_HEADQUARTERS = "headquarters"
OFFICE_TYPE_BRANCH = "branch"
OFFICE_TYPE_REMOTE = "remote"
OFFICE_TYPE_HYBRID = "hybrid"

__all__ = [
    # Pagination
    "DEFAULT_PAGE_SIZE",
    "MAX_PAGE_SIZE",
    "MIN_PAGE_SIZE",
    "PAGE_QUERY_PARAM",
    "PAGE_SIZE_QUERY_PARAM",
    # Ordering
    "DEFAULT_ORDERING",
    "ORDERING_QUERY_PARAM",
    # Search
    "SEARCH_QUERY_PARAM",
    "SEARCH_FIELDS",
    # Filter
    "FILTER_QUERY_PARAM",
    # API
    "API_VERSION",
    "API_VERSION_QUERY_PARAM",
    "API_VERSION_HEADER",
    # Date formats
    "DATE_FORMAT",
    "DATETIME_FORMAT",
    "ISO_8601_FORMAT",
    # Page sizes
    "SMALL_PAGE_SIZE",
    "MEDIUM_PAGE_SIZE",
    "LARGE_PAGE_SIZE",
    "EXPORT_PAGE_SIZE",
    # Cache
    "CACHE_TIMEOUT_SHORT",
    "CACHE_TIMEOUT_MEDIUM",
    "CACHE_TIMEOUT_LONG",
    "CACHE_TIMEOUT_DAY",
    # Rate limiting
    "RATE_LIMIT_ANONYMOUS",
    "RATE_LIMIT_AUTHENTICATED",
    "RATE_LIMIT_REQUESTS",
    # File upload
    "MAX_FILE_SIZE",
    "MAX_IMAGE_SIZE",
    "ALLOWED_IMAGE_TYPES",
    "ALLOWED_FILE_TYPES",
    # Email
    "EMAIL_MAX_RECIPIENTS",
    "EMAIL_MAX_ATTACHMENT_SIZE",
    # Session
    "SESSION_TIMEOUT",
    "SESSION_TIMEOUT_EXTENDED",
    # Audit
    "AUDIT_LOG_RETENTION_DAYS",
    "AUDIT_LOG_MAX_ENTRIES",
    # Notification
    "NOTIFICATION_MAX_RETRIES",
    "NOTIFICATION_RETRY_DELAY",
    # Export
    "EXPORT_MAX_ROWS",
    "EXPORT_TIMEOUT",
    # Import
    "IMPORT_MAX_ROWS",
    "IMPORT_TIMEOUT",
    # Validation
    "MAX_STRING_LENGTH",
    "MAX_TEXT_LENGTH",
    "MAX_JSON_LENGTH",
    # UUID
    "UUID_VERSION",
    # Status
    "STATUS_ACTIVE",
    "STATUS_INACTIVE",
    "STATUS_PENDING",
    "STATUS_DRAFT",
    "STATUS_ARCHIVED",
    "STATUS_DELETED",
    # Lifecycle
    "LIFECYCLE_ACTIVE",
    "LIFECYCLE_INACTIVE",
    "LIFECYCLE_DRAFT",
    "LIFECYCLE_ARCHIVED",
    # Record status
    "RECORD_STATUS_ACTIVE",
    "RECORD_STATUS_INACTIVE",
    "RECORD_STATUS_DRAFT",
    "RECORD_STATUS_ARCHIVED",
    "RECORD_STATUS_DELETED",
    # Visibility
    "VISIBILITY_PUBLIC",
    "VISIBILITY_PRIVATE",
    "VISIBILITY_ORGANIZATION",
    "VISIBILITY_TEAM",
    # Priority
    "PRIORITY_LOW",
    "PRIORITY_MEDIUM",
    "PRIORITY_HIGH",
    "PRIORITY_CRITICAL",
    # Permission
    "PERMISSION_READ",
    "PERMISSION_WRITE",
    "PERMISSION_DELETE",
    "PERMISSION_ADMIN",
    # Role
    "ROLE_USER",
    "ROLE_ADMIN",
    "ROLE_OWNER",
    "ROLE_GUEST",
    "ROLE_VIEWER",
    "ROLE_EDITOR",
    # Organization type
    "ORGANIZATION_TYPE_COMPANY",
    "ORGANIZATION_TYPE_TEAM",
    "ORGANIZATION_TYPE_CLUB",
    "ORGANIZATION_TYPE_ASSOCIATION",
    # Department type
    "DEPARTMENT_TYPE_SALES",
    "DEPARTMENT_TYPE_MARKETING",
    "DEPARTMENT_TYPE_ENGINEERING",
    "DEPARTMENT_TYPE_HR",
    "DEPARTMENT_TYPE_FINANCE",
    "DEPARTMENT_TYPE_SUPPORT",
    # Office type
    "OFFICE_TYPE_HEADQUARTERS",
    "OFFICE_TYPE_BRANCH",
    "OFFICE_TYPE_REMOTE",
    "OFFICE_TYPE_HYBRID",
]
