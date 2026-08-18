#!/usr/bin/env python
"""Script to check Django admin configuration."""
import os
import sys
import django

# Add the backend directory to the path
sys.path.insert(0, '/home/prafull.sakharkar/Repository/github/cricket-iq/backend')

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# Import and check admin
from django.contrib import admin
from django.core.management import call_command

# Run system checks
call_command('check', '--deploy')
