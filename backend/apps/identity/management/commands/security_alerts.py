"""
Evaluate security alerts now (cron / deployments without Celery beat; also useful to test the thresholds).

    manage.py security_alerts [--window MINUTES] [--dry-run]
"""

from django.core.management.base import BaseCommand

from apps.identity.services import security_alerts


class Command(BaseCommand):
    help = "Log (and email, if configured) failed-login spikes, lockouts and privileged changes."

    def add_arguments(self, parser):
        parser.add_argument("--window", type=int, default=None, help="Minutes to look back.")
        parser.add_argument(
            "--dry-run", action="store_true", help="Print the alerts; do not log them or send mail."
        )

    def handle(self, *args, **options):
        if options["dry_run"]:
            alerts = security_alerts.evaluate(window_minutes=options["window"])
        else:
            alerts = security_alerts.run(window_minutes=options["window"])

        for alert in alerts:
            self.stdout.write(", ".join(f"{k}={v}" for k, v in alert.items()))
        self.stdout.write(f"{len(alerts)} alert(s).")
