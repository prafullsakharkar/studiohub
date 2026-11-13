"""
In-app notifications (docs/review-pipeline RP-6).
"""

from config.env import settings

# Days a notification is kept, read or not; the daily `notifications.purge` deletes older rows (Q-RP-38).
NOTIFICATIONS_RETENTION_DAYS = settings.notifications_retention_days
