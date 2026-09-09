"""
Deliveries admin module.
"""

from .delivery import (
    DeliveryDestinationAdmin,
    DeliveryPackageAdmin,
    DeliveryVersionRefAdmin,
)

__all__ = [
    "DeliveryPackageAdmin",
    "DeliveryDestinationAdmin",
    "DeliveryVersionRefAdmin",
]
