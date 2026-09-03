"""
PublishItem model for DCC publish validation.
"""
from __future__ import annotations

from django.db import models

from apps.core.models.bases.entity import EntityModel
from apps.organization.models.organization import Organization


class PublishItem(EntityModel):
    """
    DCC publish item for validation and export tracking.
    
    Represents a publish operation from DCC tools (Maya, Houdini, etc.)
    with pre-flight validation and export status tracking.
    """
    
    # Status choices
    STATUS_PENDING = "Pending"
    STATUS_VALIDATING = "Validating"
    STATUS_VALIDATED = "Validated"
    STATUS_EXPORTING = "Exporting"
    STATUS_EXPORTED = "Exported"
    STATUS_FAILED = "Failed"
    STATUS_CANCELLED = "Cancelled"
    
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_VALIDATING, "Validating"),
        (STATUS_VALIDATED, "Validated"),
        (STATUS_EXPORTING, "Exporting"),
        (STATUS_EXPORTED, "Exported"),
        (STATUS_FAILED, "Failed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]
    
    # DCC tool types
    TOOL_MAYA = "Maya"
    TOOL_HOUDINI = "Houdini"
    TOOL_BLENDER = "Blender"
    TOOL_NUKE = "Nuke"
    TOOL_MAYA_LIGHT = "Maya Light"
    TOOL_CINEMA_4D = "Cinema 4D"
    TOOL_MAX = "3ds Max"
    
    TOOL_CHOICES = [
        (TOOL_MAYA, "Maya"),
        (TOOL_HOUDINI, "Houdini"),
        (TOOL_BLENDER, "Blender"),
        (TOOL_NUKE, "Nuke"),
        (TOOL_MAYA_LIGHT, "Maya Light"),
        (TOOL_CINEMA_4D, "Cinema 4D"),
        (TOOL_MAX, "3ds Max"),
    ]
    
    # Entity types
    ENTITY_SHOT = "Shot"
    ENTITY_ASSET = "Asset"
    
    ENTITY_CHOICES = [
        (ENTITY_SHOT, "Shot"),
        (ENTITY_ASSET, "Asset"),
    ]
    
    name = models.CharField(
        max_length=255,
        help_text="Publish item name",
    )
    
    code = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Publish code",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="publish_items",
        db_index=True,
        help_text="Organization context",
    )
    
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="publish_items",
        db_index=True,
        help_text="Associated project",
    )
    
    entity_type = models.CharField(
        max_length=20,
        choices=ENTITY_CHOICES,
        db_index=True,
        help_text="Entity type being published",
    )
    
    entity_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="ID of the entity being published",
    )
    
    entity_code = models.CharField(
        max_length=255,
        help_text="Code of the entity being published",
    )
    
    entity_name = models.CharField(
        max_length=255,
        help_text="Name of the entity being published",
    )
    
    dcc_tool = models.CharField(
        max_length=20,
        choices=TOOL_CHOICES,
        help_text="DCC tool used for publish",
    )
    
    dcc_version = models.CharField(
        max_length=50,
        blank=True,
        help_text="DCC tool version",
    )
    
    source_file = models.CharField(
        max_length=500,
        help_text="Source file path",
    )
    
    source_version = models.CharField(
        max_length=50,
        blank=True,
        help_text="Source file version",
    )
    
    export_path = models.CharField(
        max_length=500,
        blank=True,
        help_text="Exported file path",
    )
    
    export_format = models.CharField(
        max_length=50,
        blank=True,
        help_text="Export format (USD, FBX, Alembic, etc.)",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
        help_text="Publish status",
    )
    
    validation_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Validation rules applied",
    )
    
    validation_results = models.JSONField(
        default=dict,
        blank=True,
        help_text="Validation results",
    )
    
    export_options = models.JSONField(
        default=dict,
        blank=True,
        help_text="Export options",
    )
    
    error_message = models.TextField(
        blank=True,
        help_text="Error message if failed",
    )
    
    retry_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of retry attempts",
    )
    
    is_archived = models.BooleanField(
        default=False,
        help_text="Whether this publish is archived",
    )
    
    class Meta:
        db_table = "publishing_item"
        ordering = ("-created_at",)
        verbose_name = "Publish Item"
        verbose_name_plural = "Publish Items"
    
    def __str__(self):
        return f"{self.code}: {self.name}"
    
    @property
    def is_success(self):
        """Check if publish was successful."""
        return self.status in (self.STATUS_VALIDATED, self.STATUS_EXPORTED)
    
    @property
    def is_failed(self):
        """Check if publish failed."""
        return self.status in (self.STATUS_FAILED, self.STATUS_CANCELLED)


class PublishValidationRule(models.Model):
    """
    Validation rule for publish items.
    """
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="publish_validation_rules",
        db_index=True,
        help_text="Organization context",
    )
    
    # Rule types
    RULE_FILE_EXISTS = "file_exists"
    RULE_FILE_SIZE = "file_size"
    RULE_FRAME_RANGE = "frame_range"
    RULE_FILE_FORMAT = "file_format"
    RULE_METADATA = "metadata"
    RULE_DEPENDENCIES = "dependencies"
    RULE_PERMISSIONS = "permissions"
    
    RULE_CHOICES = [
        (RULE_FILE_EXISTS, "File Exists"),
        (RULE_FILE_SIZE, "File Size"),
        (RULE_FRAME_RANGE, "Frame Range"),
        (RULE_FILE_FORMAT, "File Format"),
        (RULE_METADATA, "Metadata"),
        (RULE_DEPENDENCIES, "Dependencies"),
        (RULE_PERMISSIONS, "Permissions"),
    ]
    
    # Rule actions
    ACTION_WARN = "warn"
    ACTION_ERROR = "error"
    ACTION_BLOCK = "block"
    
    ACTION_CHOICES = [
        (ACTION_WARN, "Warn"),
        (ACTION_ERROR, "Error"),
        (ACTION_BLOCK, "Block"),
    ]
    
    name = models.CharField(
        max_length=100,
        help_text="Rule name",
    )
    
    rule_type = models.CharField(
        max_length=50,
        choices=RULE_CHOICES,
        help_text="Type of validation rule",
    )
    
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        default=ACTION_ERROR,
        help_text="Action to take on failure",
    )
    
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Rule configuration",
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this rule is active",
    )
    
    order = models.PositiveIntegerField(
        default=0,
        help_text="Order for rule execution",
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this rule was created",
    )
    
    class Meta:
        db_table = "publishing_validation_rule"
        ordering = ("order", "name")
        verbose_name = "Publish Validation Rule"
        verbose_name_plural = "Publish Validation Rules"
    
    def __str__(self):
        return f"{self.name} ({self.rule_type})"
