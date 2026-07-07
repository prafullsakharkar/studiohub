from rest_framework import serializers


class MFAEnrollSerializer(serializers.Serializer):
    method = serializers.ChoiceField(
        choices=[
            ("totp", "TOTP"),
        ],
        default="totp",
    )


class MFAEnrollResponseSerializer(serializers.Serializer):
    secret = serializers.CharField(read_only=True)

    provisioning_uri = serializers.CharField(read_only=True)

    qr_code = serializers.CharField(read_only=True)
